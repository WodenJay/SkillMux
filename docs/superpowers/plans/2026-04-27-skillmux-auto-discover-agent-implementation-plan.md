# Auto-Discover Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-discover unknown `.xxx/skills` directories in the user's home directory and auto-register them into `config.json` without manual intervention.

**Architecture:** A new `autoRegisterNewAgents()` module scans `os.homedir()` for dot-prefixed directories containing `skills/`, generates `AgentOverride` entries with `autoDiscovered: true`, and writes them into `config.json`. Called at the top of `discoverAgents()` before building the return list. Cache on 1h interval via config timestamp. A `removedAutoAgentIds` list prevents re-registration of manually removed agents.

**Tech Stack:** TypeScript, Node.js `fs`, Zod

**Pre-requisite reading:** `docs/superpowers/specs/2026-04-27-skillmux-auto-discover-agent-design.md`

---

### Task 1: Update core types and config schema

**Files:**
- Modify: `src/config/load-user-config.ts`

**Changes:**
1. Add `autoDiscovered?: true` to `AgentOverride` type
2. Add `autoDiscover` and `removedAutoAgentIds` fields to `UserConfig` type
3. Update Zod schema (`userConfigSchema` and `agentOverrideSchema`) to accept the new fields with `.optional()` / `.passthrough()` so existing configs still validate
4. Add `autoDiscover` default value and `removedAutoAgentIds` default in `createEmptyUserConfig()`

**Details:**

```typescript
// AgentOverride type — add autoDiscovered
export type AgentOverride = {
  stableName?: string;
  supportedPlatforms?: SupportedPlatform[];
  homeRelativeRootPath?: string;
  skillsDirectoryPath?: string;
  enabledByDefault?: boolean;
  autoDiscovered?: true;
};

// UserConfig type — add autoDiscover + removedAutoAgentIds
export type UserConfig = {
  version: 1;
  agents: Record<string, AgentOverride>;
  autoDiscover?: {
    lastRunAt: string | null;
    intervalMs: number;
  };
  removedAutoAgentIds?: string[];
};
```

- [ ] **Step 1: Update `AgentOverride` type** — add `autoDiscovered?: true` field

```typescript
// In src/config/load-user-config.ts
export type AgentOverride = {
  stableName?: string;
  supportedPlatforms?: SupportedPlatform[];
  homeRelativeRootPath?: string;
  skillsDirectoryPath?: string;
  enabledByDefault?: boolean;
  autoDiscovered?: true;
};
```

- [ ] **Step 2: Update `UserConfig` type** — add `autoDiscover` and `removedAutoAgentIds`

```typescript
export type UserConfig = {
  version: 1;
  agents: Record<string, AgentOverride>;
  autoDiscover?: {
    lastRunAt: string | null;
    intervalMs: number;
  };
  removedAutoAgentIds?: string[];
};
```

- [ ] **Step 3: Update Zod schema** — currently `.strict()` on both schemas prevents unknown fields; switch to `.passthrough()` or add the new fields explicitly

```typescript
// agentOverrideSchema — add autoDiscovered as optional
const agentOverrideSchema = z
  .object({
    stableName: z.string().min(1).optional(),
    supportedPlatforms: z.array(supportedPlatformSchema).min(1).optional(),
    homeRelativeRootPath: z.string().min(1).optional(),
    skillsDirectoryPath: z.string().min(1).optional(),
    enabledByDefault: z.boolean().optional(),
    autoDiscovered: z.literal(true).optional()
  })
  .strict();

// userConfigSchema — add autoDiscover and removedAutoAgentIds
export const userConfigSchema = z
  .object({
    version: z.literal(1),
    agents: z.record(z.string().min(1), agentOverrideSchema),
    autoDiscover: z
      .object({
        lastRunAt: z.string().nullable(),
        intervalMs: z.number().int().nonnegative()
      })
      .optional(),
    removedAutoAgentIds: z.array(z.string().min(1)).optional()
  })
  .strict();
```

- [ ] **Step 4: Update `createEmptyUserConfig()`** to include new fields

```typescript
function createEmptyUserConfig(): UserConfig {
  return {
    version: 1,
    agents: {},
    autoDiscover: {
      lastRunAt: null,
      intervalMs: 3600000
    },
    removedAutoAgentIds: []
  };
}
```

- [ ] **Step 5: Run typecheck to verify**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/config/load-user-config.ts
git commit -m "feat: extend AgentOverride and UserConfig types for auto-discover"
```

---

### Task 2: Create `autoRegisterNewAgents()` module

**Files:**
- Create: `src/config/auto-register-agents.ts`
- Test: `tests/config/auto-register-agents.test.ts`

- [ ] **Step 1: Write failing tests for `autoRegisterNewAgents`**

File: `tests/config/auto-register-agents.test.ts`

```typescript
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { autoRegisterNewAgents } from "../../src/config/auto-register-agents";
import { resolveSkillmuxHome } from "../../src/config/resolve-skillmux-home";
import { loadUserConfig } from "../../src/config/load-user-config";

function tempHome(): string {
  const dir = mkdtempSync(join(tmpdir(), "skillmux-auto-"));
  return dir;
}

function cleanup(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

function writeConfig(dir: string, config: unknown): void {
  const { configPath } = resolveSkillmuxHome(dir);
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}

describe("autoRegisterNewAgents", () => {
  it("registers an unknown .xxx dir with skills/ subdirectory", async () => {
    const homeDir = tempHome();
    try {
      // Create .myagent/skills directory
      mkdirSync(join(homeDir, ".myagent", "skills"), { recursive: true });

      // Start with empty config
      writeConfig(homeDir, {
        version: 1,
        agents: {},
        autoDiscover: { lastRunAt: null, intervalMs: 3600000 },
        removedAutoAgentIds: []
      });

      await autoRegisterNewAgents(homeDir);

      const config = await loadUserConfig(resolveSkillmuxHome(homeDir).skillmuxHome);

      expect(config.agents).toHaveProperty("myagent");
      expect(config.agents.myagent).toMatchObject({
        homeRelativeRootPath: ".myagent",
        skillsDirectoryPath: "skills",
        enabledByDefault: true,
        autoDiscovered: true
      });
      expect(config.autoDiscover?.lastRunAt).not.toBeNull();
    } finally {
      cleanup(homeDir);
    }
  });

  it("skips already-registered agents", async () => {
    const homeDir = tempHome();
    try {
      mkdirSync(join(homeDir, ".myagent", "skills"), { recursive: true });

      writeConfig(homeDir, {
        version: 1,
        agents: {
          myagent: {
            homeRelativeRootPath: ".myagent",
            skillsDirectoryPath: "skills",
            enabledByDefault: true
          }
        },
        autoDiscover: { lastRunAt: null, intervalMs: 3600000 },
        removedAutoAgentIds: []
      });

      await autoRegisterNewAgents(homeDir);

      const config = await loadUserConfig(resolveSkillmuxHome(homeDir).skillmuxHome);

      // Should only have the original entry, no autoDiscovered
      expect(config.agents.myagent).not.toHaveProperty("autoDiscovered");
    } finally {
      cleanup(homeDir);
    }
  });

  it("skips agents in removedAutoAgentIds", async () => {
    const homeDir = tempHome();
    try {
      mkdirSync(join(homeDir, ".myagent", "skills"), { recursive: true });

      writeConfig(homeDir, {
        version: 1,
        agents: {},
        autoDiscover: { lastRunAt: null, intervalMs: 3600000 },
        removedAutoAgentIds: ["myagent"]
      });

      await autoRegisterNewAgents(homeDir);

      const config = await loadUserConfig(resolveSkillmuxHome(homeDir).skillmuxHome);

      expect(config.agents).not.toHaveProperty("myagent");
    } finally {
      cleanup(homeDir);
    }
  });

  it("skips built-in agent directories that match known IDs", async () => {
    const homeDir = tempHome();
    try {
      // Create a directory matching a built-in ID
      mkdirSync(join(homeDir, ".codex", "skills"), { recursive: true });

      writeConfig(homeDir, {
        version: 1,
        agents: {},
        autoDiscover: { lastRunAt: null, intervalMs: 3600000 },
        removedAutoAgentIds: []
      });

      await autoRegisterNewAgents(homeDir);

      const config = await loadUserConfig(resolveSkillmuxHome(homeDir).skillmuxHome);

      // codex is already in built-in list, should not be auto-registered
      expect(config.agents).not.toHaveProperty("codex");
    } finally {
      cleanup(homeDir);
    }
  });

  it("respects the cache interval and does not re-scan too soon", async () => {
    const homeDir = tempHome();
    try {
      // Write config with recent lastRunAt
      const recentTimestamp = new Date().toISOString();
      writeConfig(homeDir, {
        version: 1,
        agents: {},
        autoDiscover: { lastRunAt: recentTimestamp, intervalMs: 3600000 },
        removedAutoAgentIds: []
      });

      // Create a new agent directory AFTER the lastRunAt
      mkdirSync(join(homeDir, ".lateragent", "skills"), { recursive: true });

      await autoRegisterNewAgents(homeDir);

      const config = await loadUserConfig(resolveSkillmuxHome(homeDir).skillmuxHome);

      // Should NOT have registered lateragent because cache is still valid
      expect(config.agents).not.toHaveProperty("lateragent");
      expect(config.autoDiscover?.lastRunAt).toBe(recentTimestamp);
    } finally {
      cleanup(homeDir);
    }
  });

  it("scans again when intervalMs is set to 0 (always scan)", async () => {
    const homeDir = tempHome();
    try {
      const recentTimestamp = new Date().toISOString();
      writeConfig(homeDir, {
        version: 1,
        agents: {},
        autoDiscover: { lastRunAt: recentTimestamp, intervalMs: 0 },
        removedAutoAgentIds: []
      });

      mkdirSync(join(homeDir, ".alwaysagent", "skills"), { recursive: true });

      await autoRegisterNewAgents(homeDir);

      const config = await loadUserConfig(resolveSkillmuxHome(homeDir).skillmuxHome);

      expect(config.agents).toHaveProperty("alwaysagent");
      expect(config.autoDiscover?.lastRunAt).not.toBe(recentTimestamp);
    } finally {
      cleanup(homeDir);
    }
  });

  it("skips directories without skills/ subdirectory", async () => {
    const homeDir = tempHome();
    try {
      mkdirSync(join(homeDir, ".emptyagent"), { recursive: true }); // no skills/

      writeConfig(homeDir, {
        version: 1,
        agents: {},
        autoDiscover: { lastRunAt: null, intervalMs: 3600000 },
        removedAutoAgentIds: []
      });

      await autoRegisterNewAgents(homeDir);

      const config = await loadUserConfig(resolveSkillmuxHome(homeDir).skillmuxHome);

      expect(config.agents).not.toHaveProperty("emptyagent");
    } finally {
      cleanup(homeDir);
    }
  });

  it("skips non-dot-prefixed directories", async () => {
    const homeDir = tempHome();
    try {
      mkdirSync(join(homeDir, "normal-folder", "skills"), { recursive: true });

      writeConfig(homeDir, {
        version: 1,
        agents: {},
        autoDiscover: { lastRunAt: null, intervalMs: 3600000 },
        removedAutoAgentIds: []
      });

      await autoRegisterNewAgents(homeDir);

      const config = await loadUserConfig(resolveSkillmuxHome(homeDir).skillmuxHome);

      expect(config.agents).not.toHaveProperty("normal-folder");
    } finally {
      cleanup(homeDir);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --reporter verbose tests/config/auto-register-agents.test.ts`
Expected: FAIL with "Cannot find module" / autoRegisterNewAgents not defined

- [ ] **Step 3: Write minimal implementation in `src/config/auto-register-agents.ts`**

```typescript
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  builtInAgentIds,
  type BuiltInAgentId
} from "./default-agent-rules";
import {
  loadUserConfig,
  type AgentOverride,
  type UserConfig
} from "./load-user-config";
import { resolveSkillmuxHome } from "./resolve-skillmux-home";
import { writeUserConfig } from "./write-user-config";

function isDotDir(name: string): boolean {
  return name.startsWith(".");
}

function isValidAgentId(name: string): boolean {
  // Must start with a dot, then have at least one valid character
  if (name.length < 2) return false;

  const stem = name.slice(1); // strip leading "."
  // Agent IDs use lowercase alphanumeric + hyphens
  return /^[a-z][a-z0-9-]*$/u.test(stem);
}

function dirExists(dirPath: string): boolean {
  try {
    return statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

function isBuiltInAgentId(id: string): id is BuiltInAgentId {
  return (builtInAgentIds as readonly string[]).includes(id);
}

function makeAutoDiscoveredOverride(dirName: string): AgentOverride {
  const stem = dirName.slice(1);

  return {
    stableName: stem.charAt(0).toUpperCase() + stem.slice(1),
    supportedPlatforms: ["win32", "linux", "darwin"],
    homeRelativeRootPath: dirName,
    skillsDirectoryPath: "skills",
    enabledByDefault: true,
    autoDiscovered: true
  };
}

export async function autoRegisterNewAgents(
  homeDir?: string
): Promise<void> {
  const resolvedHomeDir = homeDir ?? homedir();
  const { skillmuxHome } = resolveSkillmuxHome(resolvedHomeDir);
  const config = await loadUserConfig(skillmuxHome);

  // Cache check: skip if lastRunAt + intervalMs > now
  const autoDiscover = config.autoDiscover ?? {
    lastRunAt: null,
    intervalMs: 3600000
  };

  if (autoDiscover.lastRunAt !== null && autoDiscover.intervalMs > 0) {
    const elapsed = Date.now() - new Date(autoDiscover.lastRunAt).getTime();
    if (elapsed < autoDiscover.intervalMs) {
      return; // cache still valid
    }
  }

  const removedIds = new Set(config.removedAutoAgentIds ?? []);
  let changed = false;

  // Scan home dir level-1 for dot directories
  let entries: string[];
  try {
    entries = readdirSync(resolvedHomeDir);
  } catch {
    return; // home dir not readable
  }

  const nextAgents: Record<string, AgentOverride> = { ...config.agents };

  for (const name of entries) {
    if (!isDotDir(name)) continue;
    if (!isValidAgentId(name)) continue;

    const agentId = name.slice(1).toLowerCase().replace(/[^a-z0-9]+/g, "-");

    // Skip if already known
    if (agentId in nextAgents) continue;
    if (isBuiltInAgentId(agentId)) continue;
    if (removedIds.has(agentId)) continue;

    const skillsDir = join(resolvedHomeDir, name, "skills");
    if (!dirExists(skillsDir)) continue;

    nextAgents[agentId] = makeAutoDiscoveredOverride(name);
    changed = true;
  }

  if (!changed && autoDiscover.lastRunAt !== null) {
    // No new agents, but update lastRunAt so we don't re-scan
    // Don't write if nothing changed and we already have a recent timestamp
    return;
  }

  if (!changed && autoDiscover.lastRunAt === null) {
    // First scan, nothing found — still write to set lastRunAt
    // So we don't re-scan on next call
  }

  const nextConfig: UserConfig = {
    ...config,
    agents: nextAgents,
    autoDiscover: {
      ...autoDiscover,
      lastRunAt: new Date().toISOString()
    },
    removedAutoAgentIds: [...removedIds]
  };

  await writeUserConfig(skillmuxHome, nextConfig);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run --reporter verbose tests/config/auto-register-agents.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/config/auto-register-agents.ts tests/config/auto-register-agents.test.ts
git commit -m "feat: add auto-register agents scanning module"
```

---

### Task 3: Integrate `autoRegisterNewAgents()` into discovery pipeline

**Files:**
- Modify: `src/discovery/discover-agents.ts` — call `autoRegisterNewAgents()` at the top, before reading config
- Modify: `src/commands/agents.ts` — show `auto` in `DISCOVERY` column for auto-discovered agents
- Test: `tests/discovery/discover-agents.test.ts` — add scenario with auto-registered agents

- [ ] **Step 1: Add `autoRegisterNewAgents()` call at the start of `discoverAgents()`**

```typescript
// In src/discovery/discover-agents.ts, add import at top
import { autoRegisterNewAgents } from "../config/auto-register-agents";

// At the beginning of discoverAgents(), after resolving homeDir:
export async function discoverAgents(
  options: DiscoverAgentsOptions
): Promise<DiscoveredAgent[]> {
  const platform = options.platform ?? process.platform;
  const homeDir = resolve(options.homeDir);
  const skillmuxHome =
    options.skillmuxHome ?? resolveSkillmuxHome(homeDir).skillmuxHome;

  // Auto-register unknown dot-dirs with skills/ subdirectory
  await autoRegisterNewAgents(homeDir);

  const userConfig = await loadUserConfig(skillmuxHome);

  // ... rest unchanged
}
```

- [ ] **Step 2: Write test that verifies auto-registered agents appear in discovery results**

Add to `tests/discovery/discover-agents.test.ts`:

```typescript
it("discovers auto-registered agents from unknown dot directories", async () => {
  const homeDir = createTempHomeDir();

  try {
    // Create an unknown .dot dir with skills/
    ensureDirectory(join(homeDir, ".autofound", "skills"));

    // Config starts with just built-ins, no custom overrides
    writeSkillmuxConfig(homeDir, {
      version: 1,
      agents: {},
      autoDiscover: { lastRunAt: null, intervalMs: 0 },
      removedAutoAgentIds: []
    });

    const agents = await discoverAgents({
      homeDir,
      platform: "win32"
    });

    const autoAgent = agents.find((a) => a.id === "autofound");
    expect(autoAgent).toBeDefined();
    expect(autoAgent?.discovery).toBe("custom");
    expect(autoAgent?.homeRelativeRootPath).toBe(".autofound");
    expect(autoAgent?.skillsDirectoryPath).toBe("skills");
    expect(autoAgent?.exists).toBe(true);
    expect(autoAgent?.supportedOnPlatform).toBe(true);
  } finally {
    cleanupTempHomeDir(homeDir);
  }
});
```

- [ ] **Step 3: Update `agents.ts` to show `auto` in DISCOVERY column**

Need to pass `autoDiscovered` info through `DiscoveredAgent`. Since auto-registered agents end up as config overrides, we need to detect them. The simplest approach: extend `DiscoveredAgent` with an optional `autoDiscovered` flag.

In `src/discovery/discover-agents.ts`, add `autoDiscovered` to `DiscoveredAgent` type:

```typescript
export type DiscoveredAgent = AgentRule & {
  absoluteRootPath: string;
  absoluteSkillsDirectoryPath: string;
  exists: boolean;
  supportedOnPlatform: boolean;
  autoDiscovered?: boolean;
};
```

When building custom rules, check if the override has `autoDiscovered: true`:

```typescript
// In the custom-agent loop inside discoverAgents()
const customRule = buildCustomRule(agentId, override);
const resolvedPaths = resolveAgentRulePaths(homeDir, customRule);

discoveredAgents.push({
  ...customRule,
  ...resolvedPaths,
  exists: await pathExists(resolvedPaths.absoluteSkillsDirectoryPath),
  supportedOnPlatform: customRule.supportedPlatforms.some(
    (supportedPlatform) => supportedPlatform === platform
  ),
  autoDiscovered: override.autoDiscovered === true || undefined
});
```

Then in `src/commands/agents.ts`:

```typescript
// In buildTableOutput(), change the discovery display
discovery: agent.autoDiscovered ? "auto" : agent.discovery
```

- [ ] **Step 4: Run discover-agents tests**

Run: `npx vitest run --reporter verbose tests/discovery/discover-agents.test.ts`
Expected: PASS (existing + new scenario)

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/discovery/discover-agents.ts src/commands/agents.ts tests/discovery/discover-agents.test.ts
git commit -m "feat: integrate auto-register into discovery pipeline"
```

---

### Task 4: Update CLI commands for auto-discovered agent lifecycle

**Files:**
- Modify: `src/commands/config-remove-agent.ts` — append ID to `removedAutoAgentIds` when removing auto-discovered agent
- Modify: `src/commands/config-update-agent.ts` — clear `autoDiscovered` when user updates an auto-discovered agent

- [ ] **Step 1: Add `removedAutoAgentIds` tracking to `config-remove-agent.ts`**

When removing an agent that has `autoDiscovered: true`, push its ID to `removedAutoAgentIds`:

```typescript
// In runConfigRemoveAgent(), after building nextConfig

// If the removed agent was auto-discovered, track it to prevent re-registration
const removedOverride = config.agents[agentId];
const wasAutoDiscovered = removedOverride?.autoDiscovered === true;

const removedAutoAgentIds = wasAutoDiscovered
  ? [...(config.removedAutoAgentIds ?? []), agentId]
  : config.removedAutoAgentIds;

const nextConfig: UserConfig = {
  ...config,
  agents: Object.fromEntries(
    Object.entries(config.agents).filter(
      ([currentAgentId]) => currentAgentId !== agentId
    )
  ),
  ...(wasAutoDiscovered && removedAutoAgentIds !== undefined
    ? { removedAutoAgentIds }
    : {})
};
```

- [ ] **Step 2: Add test for removing auto-discovered agent**

In `tests/commands/config-remove-agent.test.ts`, look for existing test patterns and add a scenario that:
1. Creates config with an autoDiscovered agent
2. Calls `runConfigRemoveAgent`
3. Verifies `removedAutoAgentIds` contains the agent ID

- [ ] **Step 3: Clear `autoDiscovered` flag in `config-update-agent.ts`**

When updating an agent that has `autoDiscovered: true`, set `autoDiscovered: false` so it becomes a normal custom agent:

```typescript
// In runConfigUpdateAgent(), after building the merged agent:
const agent: AgentOverride = {
  ...previous,
  ...buildAgentPatch(options)
};

// If the agent was auto-discovered, clear the flag on any user update
if (previous.autoDiscovered === true) {
  delete agent.autoDiscovered;
}

const changed = JSON.stringify(previous) !== JSON.stringify(agent);
```

- [ ] **Step 4: Add test for updating auto-discovered agent**

In `tests/commands/config-update-agent.test.ts`, add a scenario that:
1. Creates config with an autoDiscovered agent
2. Calls `runConfigUpdateAgent` with a name change
3. Verifies `autoDiscovered` is no longer present in the result

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/commands/config-remove-agent.ts src/commands/config-update-agent.ts
git commit -m "feat: handle auto-discovered agent lifecycle in CLI commands"
```

---

### Task 5: Final integration — add `autoDiscovered` to `buildDashboardModel`

**Files:**
- Modify: `src/tui/dashboard-model.ts` — pass `autoDiscovered` flag into `TuiAgentRow`

- [ ] **Step 1: Add `autoDiscovered` to `TuiAgentRow`**

```typescript
export type TuiAgentRow = {
  // ... existing fields
  discovery: "builtin" | "custom";
  autoDiscovered?: boolean;
  // ... rest of existing fields
};
```

- [ ] **Step 2: Set `autoDiscovered` from the `agentOverride` in `buildAgentRows()`**

```typescript
// In buildAgentRows(), when constructing the row:
const agentOverride = input.agentOverrides?.[agent.id];

return {
  // ... existing fields
  autoDiscovered: agentOverride?.autoDiscovered === true || undefined,
  // ...
};
```

- [ ] **Step 3: Add `autoDiscovered` to `BuildDashboardModelInput` type**

```typescript
export type BuildDashboardModelInput = {
  // ... existing fields
  agentOverrides?: Record<string, AgentOverride>;
  // ... (already there, just verify)
};
```

- [ ] **Step 4: Run typecheck & tests**

Run: `npm run typecheck && npm test -- --run tests/tui/dashboard-model.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tui/dashboard-model.ts
git commit -m "feat: add autoDiscovered flag to TUI dashboard model"
```

---

### Task 6: Full verification gate

- [ ] **Step 1: Run build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Run existing unit tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Run new auto-register tests specifically**

Run: `npx vitest run --reporter verbose tests/config/auto-register-agents.test.ts`
Expected: PASS

- [ ] **Step 5: Run discover-agents tests specifically**

Run: `npx vitest run --reporter verbose tests/discovery/discover-agents.test.ts`
Expected: PASS

- [ ] **Step 6: Run TUI E2E tests if applicable**

Run: `npm run test:tui-e2e`
Expected: PASS (or pre-existing failures unrelated to this change)

- [ ] **Step 7: Check for whitespace/trailing issues**

Run: `git diff --check`
Expected: PASS

- [ ] **Step 8: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: final verification gate for auto-discover agent"
```

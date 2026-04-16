# SkillMux TUI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `skillmux tui`, an agent-first terminal dashboard for inspecting agents, toggling managed skills with `Space`, adopting unmanaged skills with `a`, removing disabled managed skills with `r`, and explicitly refreshing state with `s`.

**Architecture:** The TUI is a presentation layer over the existing command and discovery modules. Initial load uses a new read-only dashboard loader and must not call `runScan`, `runList`, or any helper that writes manifest state. Mutating key actions call the existing `runEnable`, `runDisable`, `runAdopt`, `runRemove`, and `runScan` helpers, then reload dashboard state.

**Tech Stack:** Node.js, TypeScript, Commander, Ink, React, Zod, Vitest, tsup

---

## Required Skills During Implementation

- Use `$terminal-ui` before implementing Ink components, keyboard input, terminal rendering, or TTY behavior.
- Use `superpowers:test-driven-development` for each task.
- Use `superpowers:subagent-driven-development` for task execution unless the user chooses inline execution.
- Use `superpowers:verification-before-completion` before any commit or completion claim.

## Planned File Structure

### Dependencies And Config

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tsconfig.json`
- Modify: `vitest.config.ts`

### CLI Surface

- Modify: `src/index.ts`
- Create: `src/commands/tui.ts`

### TUI Core

- Create: `src/tui/launch-tui.tsx`
- Create: `src/tui/app.tsx`
- Create: `src/tui/dashboard-model.ts`
- Create: `src/tui/load-dashboard-state.ts`
- Create: `src/tui/actions.ts`
- Create: `src/tui/state.ts`
- Create: `src/tui/tty.ts`

### TUI Components

- Create: `src/tui/components/Dashboard.tsx`
- Create: `src/tui/components/AgentList.tsx`
- Create: `src/tui/components/SkillList.tsx`
- Create: `src/tui/components/DetailPane.tsx`
- Create: `src/tui/components/Footer.tsx`
- Create: `src/tui/components/StatusLine.tsx`
- Create: `src/tui/components/HelpOverlay.tsx`
- Create: `src/tui/components/ConfirmDialog.tsx`

### Manifest And Diagnostics

- Create: `src/manifest/read-manifest-snapshot.ts`
- Create: `src/diagnostics/collect-doctor-issues.ts`
- Modify: `src/commands/doctor.ts`

### Tests

- Create: `tests/commands/tui.test.ts`
- Create: `tests/manifest/read-manifest-snapshot.test.ts`
- Create: `tests/tui/load-dashboard-state.test.ts`
- Create: `tests/tui/dashboard-model.test.ts`
- Create: `tests/tui/actions.test.ts`
- Create: `tests/tui/state.test.ts`
- Create: `tests/tui/components.test.tsx`
- Modify: `tests/smoke/cli-smoke.test.ts`

### Docs And Tracking

- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `PROJECT_STATUS.md`
- Modify: `NEXT_ACTIONS.md`
- Modify: `DECISIONS.md`
- Modify: `docs/superpowers/plans/2026-04-16-skillmux-tui-implementation-plan.md`

## Implementation Order

Build the TUI in eight slices. Each slice should end with targeted tests, `npm run typecheck` when TypeScript surface changes, and a commit.

### Task 1: Add TUI Dependencies And CLI Shell

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tsconfig.json`
- Modify: `vitest.config.ts`
- Modify: `src/index.ts`
- Create: `src/commands/tui.ts`
- Create: `src/tui/launch-tui.tsx`
- Create: `src/tui/tty.ts`
- Test: `tests/commands/tui.test.ts`
- Test: `tests/smoke/cli-smoke.test.ts`

- [x] **Step 1: Install runtime and test dependencies**

Run:

```powershell
npm install ink react
```

Run:

```powershell
npm install -D @types/react ink-testing-library
```

Expected: `package.json` has `ink` and `react` under `dependencies`; `@types/react` and `ink-testing-library` are dev dependencies; `package-lock.json` is updated.

- [x] **Step 2: Add TSX coverage to TypeScript and Vitest config**

Modify `tsconfig.json` compiler options:

```json
{
  "jsx": "react-jsx"
}
```

Modify `tsconfig.json` include patterns:

```json
[
  "src/**/*.ts",
  "src/**/*.tsx",
  "tests/**/*.ts",
  "tests/**/*.tsx",
  "vitest.config.ts",
  "tsup.config.ts"
]
```

Modify `vitest.config.ts` include:

```ts
include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"]
```

- [x] **Step 3: Write failing CLI registration and non-TTY tests**

Add `tests/commands/tui.test.ts`:

```ts
import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";
import { runTui } from "../../src/commands/tui";
import { buildCli } from "../../src/index";

describe("tui command", () => {
  it("is registered on the CLI", () => {
    const cli = buildCli();

    expect(cli.commands.map((command) => command.name())).toContain("tui");
  });

  it("does not launch when stdio is not interactive", async () => {
    const launch = vi.fn();
    const stderr = { write: vi.fn() };

    await expect(
      runTui({
        stdin: { isTTY: false },
        stdout: { isTTY: true },
        stderr,
        launch
      })
    ).rejects.toThrow(/interactive terminal/i);

    expect(launch).not.toHaveBeenCalled();
    expect(stderr.write).toHaveBeenCalledWith(
      expect.stringContaining("skillmux list")
    );
  });
});
```

Update `tests/smoke/cli-smoke.test.ts` to expect `tui` in the command list.

- [x] **Step 4: Run tests to verify the red state**

Run:

```powershell
npm test -- --run tests/smoke/cli-smoke.test.ts tests/commands/tui.test.ts
```

Expected: FAIL because `src/commands/tui.ts` and `tui` registration do not exist.

- [x] **Step 5: Implement the minimal TUI command shell**

Create `src/tui/tty.ts`:

```ts
export type TtyLike = {
  isTTY?: boolean;
};

export function isInteractiveTerminal(
  stdin: TtyLike,
  stdout: TtyLike
): boolean {
  return stdin.isTTY === true && stdout.isTTY === true;
}
```

Create `src/tui/launch-tui.tsx` as a temporary launcher:

```tsx
export type LaunchTuiOptions = {
  homeDir?: string;
  skillmuxHome?: string;
};

export async function launchTui(_options: LaunchTuiOptions = {}): Promise<void> {
  throw new Error("TUI launch is not implemented yet");
}
```

Create `src/commands/tui.ts`:

```ts
import { launchTui, type LaunchTuiOptions } from "../tui/launch-tui";
import { isInteractiveTerminal, type TtyLike } from "../tui/tty";

export type RunTuiOptions = LaunchTuiOptions & {
  stdin?: TtyLike;
  stdout?: TtyLike;
  stderr?: { write: (message: string) => unknown };
  launch?: (options: LaunchTuiOptions) => Promise<void>;
};

export async function runTui(options: RunTuiOptions = {}): Promise<void> {
  const stdin = options.stdin ?? process.stdin;
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;

  if (!isInteractiveTerminal(stdin, stdout)) {
    const message =
      "skillmux tui requires an interactive terminal. Use skillmux list, skillmux scan, or skillmux doctor for non-interactive output.\n";
    stderr.write(message);
    throw new Error("skillmux tui requires an interactive terminal");
  }

  await (options.launch ?? launchTui)({
    homeDir: options.homeDir,
    skillmuxHome: options.skillmuxHome
  });
}
```

Modify `src/index.ts`:

```ts
import { runTui } from "./commands/tui";
```

Register:

```ts
program
  .command("tui")
  .description("Open the interactive SkillMux dashboard")
  .action(async () => {
    await runTui();
  });
```

- [x] **Step 6: Run targeted tests**

Run:

```powershell
npm test -- --run tests/smoke/cli-smoke.test.ts tests/commands/tui.test.ts
```

Expected: PASS.

- [x] **Step 7: Typecheck and commit**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

Commit:

```powershell
git add package.json package-lock.json tsconfig.json vitest.config.ts src/index.ts src/commands/tui.ts src/tui/launch-tui.tsx src/tui/tty.ts tests/commands/tui.test.ts tests/smoke/cli-smoke.test.ts
git commit -m "feat: add tui command shell"
```

### Task 2: Add Read-Only Manifest Snapshot And Shared Diagnostics

**Files:**
- Create: `src/manifest/read-manifest-snapshot.ts`
- Create: `src/diagnostics/collect-doctor-issues.ts`
- Modify: `src/commands/doctor.ts`
- Test: `tests/manifest/read-manifest-snapshot.test.ts`
- Test: `tests/commands/doctor.test.ts`

- [x] **Step 1: Write failing read-only manifest tests**

Add `tests/manifest/read-manifest-snapshot.test.ts`:

```ts
import * as fs from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readManifestSnapshot } from "../../src/manifest/read-manifest-snapshot";
import { cleanupTempHomeDir, createTempHomeDir } from "../helpers/temp-env";

describe("readManifestSnapshot", () => {
  it("returns an empty manifest without creating manifest.json", async () => {
    const home = createTempHomeDir();

    try {
      const result = await readManifestSnapshot(home);

      expect(result.manifest.skills).toEqual({});
      await expect(fs.lstat(join(home, "manifest.json"))).rejects.toMatchObject({
        code: "ENOENT"
      });
    } finally {
      cleanupTempHomeDir(home);
    }
  });
});
```

- [x] **Step 2: Run test to verify the red state**

Run:

```powershell
npm test -- --run tests/manifest/read-manifest-snapshot.test.ts
```

Expected: FAIL because `readManifestSnapshot` does not exist.

- [x] **Step 3: Implement read-only manifest snapshot**

Create `src/manifest/read-manifest-snapshot.ts`:

```ts
import * as fs from "node:fs/promises";
import { join, resolve } from "node:path";
import { ManifestValidationError } from "../core/errors";
import type { Manifest } from "../core/types";
import { buildEmptyManifest } from "./build-empty-manifest";
import { manifestSchema } from "./manifest-schema";

export type ManifestSnapshot = {
  manifest: Manifest;
  exists: boolean;
};

function normalizeHomePath(home: string): string {
  const resolvedHome = resolve(home);
  return process.platform === "win32" ? resolvedHome.toLowerCase() : resolvedHome;
}

export async function readManifestSnapshot(home: string): Promise<ManifestSnapshot> {
  const manifestPath = join(home, "manifest.json");

  try {
    const contents = await fs.readFile(manifestPath, "utf8");
    const parsed = manifestSchema.safeParse(JSON.parse(contents) as unknown);

    if (!parsed.success) {
      throw new ManifestValidationError(`Invalid manifest at ${manifestPath}`);
    }

    if (normalizeHomePath(parsed.data.skillmuxHome) !== normalizeHomePath(home)) {
      throw new ManifestValidationError(
        `Invalid manifest at ${manifestPath}: skillmuxHome must match ${home}`
      );
    }

    return { manifest: parsed.data, exists: true };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return { manifest: buildEmptyManifest(home), exists: false };
    }

    if (error instanceof SyntaxError) {
      throw new ManifestValidationError(
        `Invalid manifest at ${manifestPath}: malformed JSON`
      );
    }

    throw error;
  }
}
```

- [x] **Step 4: Extract shared doctor issue collection**

Move the read-only issue helpers from `src/commands/doctor.ts` into `src/diagnostics/collect-doctor-issues.ts`:

```ts
export type CollectDoctorIssuesInput = {
  manifest: Manifest;
  agents: DiscoveredAgent[];
  entries: ScannedSkillEntry[];
};

export async function collectDoctorIssues(
  input: CollectDoctorIssuesInput
): Promise<ScanIssue[]> {
  const issues: ScanIssue[] = [];

  await addUnmanagedDirectoryIssues(input.entries, issues);
  await addMissingManagedSkillIssues(input.manifest, issues);
  addConflictingAgentPathIssues(input.agents, issues);

  return dedupeAndSortIssues(issues);
}
```

Keep `runDoctor` behavior unchanged by calling `collectDoctorIssues` after it gathers scan entries.

- [x] **Step 5: Run targeted tests**

Run:

```powershell
npm test -- --run tests/manifest/read-manifest-snapshot.test.ts tests/commands/doctor.test.ts
```

Expected: PASS.

- [x] **Step 6: Typecheck and commit**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

Commit:

```powershell
git add src/manifest/read-manifest-snapshot.ts src/diagnostics/collect-doctor-issues.ts src/commands/doctor.ts tests/manifest/read-manifest-snapshot.test.ts tests/commands/doctor.test.ts
git commit -m "feat: add read-only manifest snapshot"
```

### Task 3: Build Read-Only Dashboard State Loader

**Files:**
- Create: `src/tui/dashboard-model.ts`
- Create: `src/tui/load-dashboard-state.ts`
- Test: `tests/tui/load-dashboard-state.test.ts`
- Test: `tests/tui/dashboard-model.test.ts`

- [x] **Step 1: Write failing dashboard loader tests**

Add `tests/tui/load-dashboard-state.test.ts`:

```ts
import * as fs from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runDisable } from "../../src/commands/disable";
import { runImport } from "../../src/commands/import";
import { loadDashboardState } from "../../src/tui/load-dashboard-state";
import { cleanupTempHomeDir, createTempHomeDir } from "../helpers/temp-env";

async function createSkillSource(homeDir: string, name: string): Promise<string> {
  const sourcePath = join(homeDir, "sources", name);
  await fs.mkdir(sourcePath, { recursive: true });
  await fs.writeFile(join(sourcePath, "SKILL.md"), `# ${name}\n`, "utf8");
  return sourcePath;
}

describe("loadDashboardState", () => {
  it("does not create manifest.json during initial load", async () => {
    const homeDir = createTempHomeDir();

    try {
      await loadDashboardState({ homeDir, platform: "win32" });

      await expect(
        fs.lstat(join(homeDir, ".skillmux", "manifest.json"))
      ).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      cleanupTempHomeDir(homeDir);
    }
  });

  it("lists every managed skill as disabled when selected agent has no enabled activation", async () => {
    const homeDir = createTempHomeDir();

    try {
      const sourcePath = await createSkillSource(homeDir, "terminal-ui");
      await runImport({ homeDir, sourcePath, skillName: "terminal-ui" });
      await runDisable({ homeDir, skill: "terminal-ui", agent: "codex" });

      const state = await loadDashboardState({
        homeDir,
        platform: "win32",
        selectedAgentId: "claude"
      });

      expect(state.skills).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            skillId: "terminal-ui",
            state: "disabled",
            marker: "○"
          })
        ])
      );
    } finally {
      cleanupTempHomeDir(homeDir);
    }
  });
});
```

- [x] **Step 2: Write failing model tests**

Add `tests/tui/dashboard-model.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildDashboardModel } from "../../src/tui/dashboard-model";

describe("buildDashboardModel", () => {
  it("maps enabled, disabled, unmanaged, and issue rows to visible markers", () => {
    const model = buildDashboardModel({
      manifest: {
        version: 1,
        skillmuxHome: "/tmp/.skillmux",
        skills: {
          "using-superpowers": {
            id: "using-superpowers",
            name: "using-superpowers",
            path: "/tmp/.skillmux/skills/using-superpowers",
            source: { kind: "imported", path: "/tmp/source" },
            importedAt: "2026-04-16T00:00:00.000Z"
          },
          "terminal-ui": {
            id: "terminal-ui",
            name: "terminal-ui",
            path: "/tmp/.skillmux/skills/terminal-ui",
            source: { kind: "imported", path: "/tmp/source-terminal" },
            importedAt: "2026-04-16T00:00:00.000Z"
          }
        },
        agents: {},
        activations: [
          {
            skillId: "using-superpowers",
            agentId: "codex",
            linkPath: "/tmp/.codex/skills/using-superpowers",
            state: "enabled",
            updatedAt: "2026-04-16T00:00:00.000Z"
          }
        ],
        lastScan: { at: null, issues: [] }
      },
      agents: [
        {
          id: "codex",
          stableName: "codex",
          absoluteRootPath: "/tmp/.codex",
          absoluteSkillsDirectoryPath: "/tmp/.codex/skills",
          discovery: "builtin",
          exists: true,
          supportedOnPlatform: true
        }
      ],
      entries: [
        {
          agentId: "codex",
          agentName: "codex",
          skillName: "local-draft",
          kind: "unmanaged-directory",
          path: "/tmp/.codex/skills/local-draft"
        }
      ],
      issues: [
        {
          code: "broken-link",
          severity: "warning",
          message: "Broken link",
          path: "/tmp/.codex/skills/broken"
        }
      ],
      selectedAgentId: "codex"
    });

    expect(model.skills.map((row) => row.marker)).toEqual(
      expect.arrayContaining(["●", "○", "?", "!"])
    );
  });
});
```

- [x] **Step 3: Run tests to verify the red state**

Run:

```powershell
npm test -- --run tests/tui/load-dashboard-state.test.ts tests/tui/dashboard-model.test.ts
```

Expected: FAIL because dashboard modules do not exist.

- [x] **Step 4: Define dashboard view models**

Create `src/tui/dashboard-model.ts` with exported types:

```ts
export type TuiAgentRow = {
  id: string;
  name: string;
  path: string;
  discovery: "builtin" | "custom";
  exists: boolean;
  supported: boolean;
  enabledCount: number;
  disabledCount: number;
  unmanagedCount: number;
  issueCount: number;
};

export type TuiSkillRow =
  | {
      marker: "●";
      state: "enabled";
      skillId: string;
      name: string;
      managed: true;
      agentId: string;
      path: string;
      updatedAt: string | null;
    }
  | {
      marker: "○";
      state: "disabled";
      skillId: string;
      name: string;
      managed: true;
      agentId: string;
      path: string;
      updatedAt: string | null;
    }
  | {
      marker: "?";
      state: "unmanaged";
      skillId: string;
      name: string;
      adoptable: boolean;
      agentId: string;
      path: string;
      kind: string;
    }
  | {
      marker: "!";
      state: "issue";
      skillId: string;
      name: string;
      agentId: string;
      issueCode: string;
      severity: "info" | "warning" | "error";
      message: string;
      path?: string;
    };

export type DashboardModel = {
  agents: TuiAgentRow[];
  skills: TuiSkillRow[];
  selectedAgentId: string | null;
  selectedSkillId: string | null;
  lastScanAt: string | null;
  issueCount: number;
};
```

`buildDashboardModel` must:

- sort agents by id
- default selection to the requested agent, then first available agent, then first agent
- list every `manifest.skills` row for the selected agent
- mark a managed row enabled only when the selected agent has an activation with `state: "enabled"`
- mark all other managed rows disabled
- add unmanaged rows from live entries for the selected agent
- add issue rows related to the selected agent
- compute counts for the agent list

- [x] **Step 5: Implement the read-only loader**

Create `src/tui/load-dashboard-state.ts`:

```ts
export type LoadDashboardStateOptions = {
  homeDir?: string;
  skillmuxHome?: string;
  platform?: NodeJS.Platform;
  selectedAgentId?: string;
  selectedSkillId?: string;
};
```

Implementation rules:

- resolve default SkillMux home with `resolveSkillmuxHome`
- call `readManifestSnapshot`, not `readManifest`
- call `discoverAgents`
- call `scanAgentSkills` for each discovered agent
- call `collectDoctorIssues`
- merge scan issues and doctor issues
- call `buildDashboardModel`
- do not write `manifest.json`, links, config, or managed skill files

- [x] **Step 6: Run targeted tests**

Run:

```powershell
npm test -- --run tests/tui/load-dashboard-state.test.ts tests/tui/dashboard-model.test.ts
```

Expected: PASS.

- [x] **Step 7: Typecheck and commit**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

Commit:

```powershell
git add src/tui/dashboard-model.ts src/tui/load-dashboard-state.ts tests/tui/load-dashboard-state.test.ts tests/tui/dashboard-model.test.ts
git commit -m "feat: add tui dashboard state loader"
```

### Task 4: Add TUI Action Dispatcher

**Files:**
- Create: `src/tui/actions.ts`
- Test: `tests/tui/actions.test.ts`

- [x] **Step 1: Write failing action dispatcher tests**

Add `tests/tui/actions.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { dispatchTuiAction } from "../../src/tui/actions";

describe("dispatchTuiAction", () => {
  it("enables a disabled managed row with Space", async () => {
    const runEnable = vi.fn().mockResolvedValue({ output: "Enabled terminal-ui for codex\n" });
    const reload = vi.fn().mockResolvedValue({ agents: [], skills: [] });

    const result = await dispatchTuiAction({
      action: "toggle",
      selectedAgentId: "codex",
      selectedSkill: {
        marker: "○",
        state: "disabled",
        skillId: "terminal-ui",
        name: "terminal-ui",
        managed: true,
        agentId: "codex",
        path: "/tmp/.skillmux/skills/terminal-ui",
        updatedAt: null
      },
      services: { runEnable, reload }
    });

    expect(runEnable).toHaveBeenCalledWith({
      skill: "terminal-ui",
      agent: "codex"
    });
    expect(result.statusMessage).toContain("Enabled terminal-ui");
  });
});
```

- [x] **Step 2: Run tests to verify the red state**

Run:

```powershell
npm test -- --run tests/tui/actions.test.ts
```

Expected: FAIL because `dispatchTuiAction` does not exist.

- [x] **Step 3: Implement action dispatch with service injection**

Create `src/tui/actions.ts`:

```ts
export type TuiAction = "toggle" | "adopt" | "remove" | "scan";
```

Implementation rules:

- `toggle` calls `runDisable({ skill, agent })` for enabled rows
- `toggle` calls `runEnable({ skill, agent })` for disabled rows
- `adopt` calls `runAdopt({ agent, skill })` only for adoptable unmanaged rows
- `remove` calls `runRemove({ skill })` only for disabled managed rows
- `scan` calls `runScan`, then reloads state
- all actions return `{ model, statusMessage }`
- on error, keep the previous model and return a short status message
- strip trailing newlines from command output before showing it in status
- do not show stack traces in status messages

- [x] **Step 4: Add tests for invalid rows and errors**

Extend `tests/tui/actions.test.ts` to cover:

- `Space` disables an enabled row through `runDisable`
- `a` ignores or reports a non-adoptable row without calling `runAdopt`
- `r` refuses enabled rows without calling `runRemove`
- command rejection preserves the current model and returns `Adopt failed: <reason>` style text
- `s` calls `runScan` and `reload`

- [x] **Step 5: Run targeted tests and commit**

Run:

```powershell
npm test -- --run tests/tui/actions.test.ts
```

Expected: PASS.

Run:

```powershell
npm run typecheck
```

Expected: PASS.

Commit:

```powershell
git add src/tui/actions.ts tests/tui/actions.test.ts
git commit -m "feat: add tui action dispatcher"
```

### Task 5: Add Pure TUI State, Navigation, Search, And Modals

**Files:**
- Create: `src/tui/state.ts`
- Test: `tests/tui/state.test.ts`

- [ ] **Step 1: Write failing reducer tests**

Add `tests/tui/state.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createInitialTuiState, updateTuiState } from "../../src/tui/state";

describe("tui state", () => {
  it("cycles focus with Tab", () => {
    const state = createInitialTuiState({
      agents: [],
      skills: [],
      selectedAgentId: null,
      selectedSkillId: null,
      lastScanAt: null,
      issueCount: 0
    });

    expect(updateTuiState(state, { type: "focus-next" }).focus).toBe("skills");
  });

  it("opens a remove confirmation for disabled managed rows", () => {
    const state = createInitialTuiState({
      agents: [],
      selectedAgentId: "codex",
      selectedSkillId: "terminal-ui",
      lastScanAt: null,
      issueCount: 0,
      skills: [
        {
          marker: "○",
          state: "disabled",
          skillId: "terminal-ui",
          name: "terminal-ui",
          managed: true,
          agentId: "codex",
          path: "/tmp/.skillmux/skills/terminal-ui",
          updatedAt: null
        }
      ]
    });

    expect(updateTuiState(state, { type: "request-remove" }).modal?.kind).toBe(
      "confirm-remove"
    );
  });
});
```

- [ ] **Step 2: Run tests to verify the red state**

Run:

```powershell
npm test -- --run tests/tui/state.test.ts
```

Expected: FAIL because `src/tui/state.ts` does not exist.

- [ ] **Step 3: Implement pure state transitions**

Create `src/tui/state.ts` with:

```ts
export type TuiFocus = "agents" | "skills" | "detail";
export type TuiModal =
  | { kind: "help" }
  | { kind: "confirm-adopt"; skillId: string; agentId: string }
  | { kind: "confirm-remove"; skillId: string };

export type TuiState = {
  model: DashboardModel;
  focus: TuiFocus;
  agentCursor: number;
  skillCursor: number;
  search: { panel: "agents" | "skills"; query: string } | null;
  statusMessage: string | null;
  modal: TuiModal | null;
  busy: boolean;
};
```

Reducer rules:

- `Tab` cycles agents -> skills -> detail -> agents
- `Shift+Tab` cycles backward
- `j`/`Down` and `k`/`Up` move inside the focused list
- `g` and `G` jump to top and bottom
- `/` opens search for Agents or Skills only
- search filters only the focused list
- `?` opens help
- `Esc` closes search or modal
- `a` opens adopt confirmation only for unmanaged/adoptable rows
- `r` opens remove confirmation only for disabled managed rows
- `Space` maps to action intent only for managed skill rows

- [ ] **Step 4: Add reducer coverage for search and help**

Extend `tests/tui/state.test.ts` for:

- `/` opens search on focused list
- `Esc` closes search
- `?` opens help
- footer/action availability changes by selected row state

- [ ] **Step 5: Run targeted tests and commit**

Run:

```powershell
npm test -- --run tests/tui/state.test.ts
```

Expected: PASS.

Run:

```powershell
npm run typecheck
```

Expected: PASS.

Commit:

```powershell
git add src/tui/state.ts tests/tui/state.test.ts
git commit -m "feat: add tui state reducer"
```

### Task 6: Build Ink Dashboard Components

**Files:**
- Create: `src/tui/app.tsx`
- Create: `src/tui/components/Dashboard.tsx`
- Create: `src/tui/components/AgentList.tsx`
- Create: `src/tui/components/SkillList.tsx`
- Create: `src/tui/components/DetailPane.tsx`
- Create: `src/tui/components/Footer.tsx`
- Create: `src/tui/components/StatusLine.tsx`
- Create: `src/tui/components/HelpOverlay.tsx`
- Create: `src/tui/components/ConfirmDialog.tsx`
- Test: `tests/tui/components.test.tsx`

- [ ] **Step 1: Load `$terminal-ui` before this task**

Read the terminal UI guidance before writing Ink components. Follow its rules for stable layout, keyboard handling, rendering cost, and terminal compatibility.

- [ ] **Step 2: Write failing component render tests**

Add `tests/tui/components.test.tsx`:

```tsx
import React from "react";
import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { Dashboard } from "../../src/tui/components/Dashboard";

describe("Dashboard", () => {
  it("renders the three panel titles, markers, and footer", () => {
    const { lastFrame } = render(
      <Dashboard
        state={{
          model: {
            agents: [
              {
                id: "codex",
                name: "codex",
                path: "/tmp/.codex/skills",
                discovery: "builtin",
                exists: true,
                supported: true,
                enabledCount: 1,
                disabledCount: 1,
                unmanagedCount: 1,
                issueCount: 0
              }
            ],
            skills: [
              {
                marker: "●",
                state: "enabled",
                skillId: "using-superpowers",
                name: "using-superpowers",
                managed: true,
                agentId: "codex",
                path: "/tmp/.skillmux/skills/using-superpowers",
                updatedAt: null
              }
            ],
            selectedAgentId: "codex",
            selectedSkillId: "using-superpowers",
            lastScanAt: null,
            issueCount: 0
          },
          focus: "skills",
          agentCursor: 0,
          skillCursor: 0,
          search: null,
          statusMessage: null,
          modal: null,
          busy: false
        }}
      />
    );

    expect(lastFrame()).toContain("Agents");
    expect(lastFrame()).toContain("Skills for codex");
    expect(lastFrame()).toContain("Detail");
    expect(lastFrame()).toContain("● using-superpowers");
    expect(lastFrame()).toContain("[Space]toggle");
  });
});
```

- [ ] **Step 3: Run tests to verify the red state**

Run:

```powershell
npm test -- --run tests/tui/components.test.tsx
```

Expected: FAIL because components do not exist.

- [ ] **Step 4: Implement presentational components**

Component rules:

- components receive view models and callbacks only
- no component reads or writes the filesystem
- use marker symbols plus text; color only reinforces meaning
- keep layout stable at 80x24
- show `Terminal too small. Resize to at least 80x24.` below the minimum size
- detail panel must not duplicate footer action lists
- footer shows only currently available shortcuts
- help overlay groups Navigation, Actions, Search, and Safety
- confirmation dialogs show `[y] confirm   [Esc] cancel`

- [ ] **Step 5: Implement `App` keyboard wiring**

Create `src/tui/app.tsx`:

- load initial model on mount
- call `useInput`
- send pure navigation events to `updateTuiState`
- open confirmations for `a` and `r`
- execute `dispatchTuiAction` for `Space`, confirmed `a`, confirmed `r`, and `s`
- show `scanning...` while refresh is running
- keep old dashboard content visible during failed actions
- call `exit()` on `q` and `Ctrl+C`

- [ ] **Step 6: Add component coverage for modal and too-small message**

Extend `tests/tui/components.test.tsx` for:

- help overlay contains filesystem-writing explanation
- adopt confirmation text
- remove confirmation text
- too-small terminal fallback
- no action duplication inside `DetailPane`

- [ ] **Step 7: Run targeted tests and commit**

Run:

```powershell
npm test -- --run tests/tui/components.test.tsx tests/tui/state.test.ts tests/tui/actions.test.ts
```

Expected: PASS.

Run:

```powershell
npm run typecheck
```

Expected: PASS.

Commit:

```powershell
git add src/tui/app.tsx src/tui/components tests/tui/components.test.tsx
git commit -m "feat: render tui dashboard"
```

### Task 7: Connect Real Ink Launch And End-To-End Command Behavior

**Files:**
- Modify: `src/tui/launch-tui.tsx`
- Modify: `src/commands/tui.ts`
- Test: `tests/commands/tui.test.ts`

- [ ] **Step 1: Write failing launch integration tests**

Extend `tests/commands/tui.test.ts`:

```ts
it("passes home options into the injected launcher", async () => {
  const launch = vi.fn().mockResolvedValue(undefined);

  await runTui({
    stdin: { isTTY: true },
    stdout: { isTTY: true },
    stderr: { write: vi.fn() },
    homeDir: "C:/tmp/home",
    skillmuxHome: "C:/tmp/home/.skillmux",
    launch
  });

  expect(launch).toHaveBeenCalledWith({
    homeDir: "C:/tmp/home",
    skillmuxHome: "C:/tmp/home/.skillmux"
  });
});
```

- [ ] **Step 2: Run tests to verify behavior before final launch wiring**

Run:

```powershell
npm test -- --run tests/commands/tui.test.ts
```

Expected: PASS for injected launcher tests. If it fails, fix command plumbing before touching Ink launch.

- [ ] **Step 3: Implement real Ink launch**

Modify `src/tui/launch-tui.tsx`:

```tsx
import React from "react";
import { render } from "ink";
import { App } from "./app";

export type LaunchTuiOptions = {
  homeDir?: string;
  skillmuxHome?: string;
};

export async function launchTui(options: LaunchTuiOptions = {}): Promise<void> {
  const instance = render(<App {...options} />);
  await instance.waitUntilExit();
}
```

- [ ] **Step 4: Confirm CLI help describes the TUI without launching it**

Add or extend a test using `buildCli()` and `parseAsync(["node", "skillmux", "tui", "--help"])` with `exitOverride()`. Expected output should include `Open the interactive SkillMux dashboard`. Do not require a launcher injection assertion unless `buildCli` has gained an explicit injection seam; Commander help exits before the action handler runs.

- [ ] **Step 5: Run command and package verification**

Run:

```powershell
npm test -- --run tests/commands/tui.test.ts tests/smoke/cli-smoke.test.ts
```

Expected: PASS.

Run:

```powershell
npm run typecheck
```

Expected: PASS.

Run:

```powershell
npm run build
```

Expected: PASS and `dist/cli.js` imports the bundled TUI path without missing module errors.

Commit:

```powershell
git add src/tui/launch-tui.tsx src/commands/tui.ts tests/commands/tui.test.ts
git commit -m "feat: connect tui launch"
```

### Task 8: Documentation, Manual Checks, And Release Readiness

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `PROJECT_STATUS.md`
- Modify: `NEXT_ACTIONS.md`
- Modify: `DECISIONS.md`
- Modify: `docs/superpowers/plans/2026-04-16-skillmux-tui-implementation-plan.md`

- [ ] **Step 1: Update README with additive user-facing TUI docs**

Add a new README section without removing existing CLI documentation:

````md
## Interactive Dashboard

Run:

```sh
skillmux tui
```

Use the dashboard when you want to inspect one agent and manage the skills it can see.

- `Space` enables or disables the selected managed skill.
- `a` adopts an unmanaged skill after confirmation.
- `r` removes a disabled managed skill after confirmation.
- `s` scans local agent folders and refreshes the dashboard.
- `/` searches the focused list.
- `?` opens help.

The dashboard needs an interactive terminal. For scripts or redirected output, use `skillmux list`, `skillmux scan`, or `skillmux doctor`.
````

- [ ] **Step 2: Update tracking docs**

Update:

- `PROJECT_STATUS.md`: TUI implementation status and accepted slices
- `NEXT_ACTIONS.md`: mark completed plan tasks and next verification/release steps
- `DECISIONS.md`: record Ink choice, read-only launch loader, and action key behavior
- `AGENTS.md`: record accepted TUI implementation state and any active worktree cleanup

- [ ] **Step 3: Mark this plan's completed task checkboxes**

As each task is accepted, update this plan's task checkboxes from `[ ]` to `[x]`. Do not mark a task complete before its tests, review, and commit are done.

- [ ] **Step 4: Run full automated verification**

Run:

```powershell
npm test
```

Expected: PASS.

Run:

```powershell
npm run typecheck
```

Expected: PASS.

Run:

```powershell
npm run build
```

Expected: PASS.

Run:

```powershell
npm pack --dry-run
```

Expected: package includes `dist/` and no scratch `.superpowers/` files.

- [ ] **Step 5: Run manual terminal checks**

Manual checks:

- `skillmux tui` in Windows Terminal at 80x24
- `skillmux tui` in Windows Terminal at 120x40
- `NO_COLOR=1` equivalent in PowerShell:

```powershell
$env:NO_COLOR = "1"
npm run build
node dist\cli.js tui
Remove-Item Env:\NO_COLOR
```

- `Ctrl+C` exits and returns terminal control
- redirected output does not launch:

```powershell
node dist\cli.js tui > tui-output.txt
```

Expected: command reports the non-interactive terminal error instead of drawing ANSI UI.

- [ ] **Step 6: Commit docs and readiness updates**

Commit:

```powershell
git add README.md AGENTS.md PROJECT_STATUS.md NEXT_ACTIONS.md DECISIONS.md docs/superpowers/plans/2026-04-16-skillmux-tui-implementation-plan.md
git commit -m "docs: document tui dashboard"
```

## Final Verification Before Acceptance

Run from the root accepted state:

```powershell
npm test
```

Expected: PASS.

```powershell
npm run typecheck
```

Expected: PASS.

```powershell
npm run build
```

Expected: PASS.

```powershell
npm pack --dry-run
```

Expected: package preview contains only intended npm files.

## Execution Handoff

Recommended execution mode: **Subagent-Driven**.

Use a fresh worker per task. After each task:

1. Run the targeted verification listed in the task.
2. Dispatch a spec compliance reviewer for that task.
3. Dispatch a code quality reviewer after spec compliance passes.
4. Update this plan's checkboxes.
5. Commit the accepted slice.

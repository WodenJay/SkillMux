# SkillMux v0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable SkillMux CLI that can discover supported agent skill directories, import local skills into a managed store, enable and disable skills by agent, and detect broken local state safely.

**Architecture:** SkillMux v0 is a Node.js + TypeScript CLI organized around a small set of domain modules: configuration and path resolution, agent discovery, manifest persistence, filesystem link operations, and command handlers. The CLI does not download remote skills; it manages local skills by moving real content into a SkillMux-managed store and exposing them to agents through links.

**Tech Stack:** Node.js, TypeScript, Commander, Zod, Vitest, tsup

---

## Planned File Structure

### Root Tooling

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `.gitignore`
- Create: `vitest.config.ts`
- Create: `README.md`

### Source Entry Points

- Create: `src/index.ts`
- Create: `src/cli.ts`

### Core Domain

- Create: `src/core/types.ts`
- Create: `src/core/errors.ts`
- Create: `src/core/ids.ts`

### Configuration And Paths

- Create: `src/config/default-agent-rules.ts`
- Create: `src/config/load-user-config.ts`
- Create: `src/config/resolve-skillmux-home.ts`

### Persistence

- Create: `src/manifest/manifest-schema.ts`
- Create: `src/manifest/read-manifest.ts`
- Create: `src/manifest/write-manifest.ts`
- Create: `src/manifest/build-empty-manifest.ts`

### Filesystem

- Create: `src/fs/path-utils.ts`
- Create: `src/fs/link-ops.ts`
- Create: `src/fs/safe-copy.ts`
- Create: `src/fs/safe-remove-link.ts`

### Discovery And State Inspection

- Create: `src/discovery/discover-agents.ts`
- Create: `src/discovery/scan-agent-skills.ts`
- Create: `src/discovery/infer-skill-entry.ts`

### Commands

- Create: `src/commands/scan.ts`
- Create: `src/commands/list.ts`
- Create: `src/commands/import.ts`
- Create: `src/commands/enable.ts`
- Create: `src/commands/disable.ts`
- Create: `src/commands/agents.ts`
- Create: `src/commands/doctor.ts`
- Create: `src/commands/config.ts`

### Output

- Create: `src/output/print-table.ts`
- Create: `src/output/print-json.ts`
- Create: `src/output/format-issue.ts`

### Tests

- Create: `tests/helpers/temp-env.ts`
- Create: `tests/helpers/create-agent-fixture.ts`
- Create: `tests/discovery/discover-agents.test.ts`
- Create: `tests/manifest/read-write-manifest.test.ts`
- Create: `tests/commands/scan.test.ts`
- Create: `tests/commands/import.test.ts`
- Create: `tests/commands/enable-disable.test.ts`
- Create: `tests/commands/doctor.test.ts`

## Implementation Order

Build the system from the bottom up:

1. Tooling and test harness
2. Domain types and manifest persistence
3. Path discovery and filesystem safety helpers
4. Agent discovery and scan
5. Import flow
6. Enable and disable flows
7. Doctor and reporting
8. Packaging and README

This order keeps the first executable vertical slice small and testable.

### Task 1: Bootstrap The CLI Workspace

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `.gitignore`
- Create: `vitest.config.ts`
- Create: `src/index.ts`
- Create: `src/cli.ts`
- Test: `tests/smoke/cli-smoke.test.ts`

- [x] **Step 1: Write the failing smoke test**

```ts
import { describe, expect, it } from "vitest";
import { buildCli } from "../../src/cli";

describe("buildCli", () => {
  it("registers the scan command", () => {
    const program = buildCli();
    const names = program.commands.map((command) => command.name());
    expect(names).toContain("scan");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/smoke/cli-smoke.test.ts`
Expected: FAIL with module or symbol not found errors

- [x] **Step 3: Create the minimal package and CLI setup**

```json
{
  "name": "skillmux",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "skillmux": "./dist/index.js"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit"
  }
}
```

```ts
// src/cli.ts
import { Command } from "commander";

export function buildCli(): Command {
  const program = new Command();
  program.name("skillmux");
  program.command("scan");
  return program;
}
```

- [x] **Step 4: Run the smoke test and typecheck**

Run: `npm test -- --run tests/smoke/cli-smoke.test.ts`
Expected: PASS

Run: `npm run lint`
Expected: PASS with no TypeScript errors

- [x] **Step 5: Commit**

```bash
git add package.json tsconfig.json tsup.config.ts vitest.config.ts .gitignore src/index.ts src/cli.ts tests/smoke/cli-smoke.test.ts
git commit -m "chore: bootstrap skillmux cli workspace"
```

### Task 2: Define Core Types, Errors, And Manifest Schema

**Files:**
- Create: `src/core/types.ts`
- Create: `src/core/errors.ts`
- Create: `src/core/ids.ts`
- Create: `src/manifest/manifest-schema.ts`
- Create: `src/manifest/build-empty-manifest.ts`
- Test: `tests/manifest/manifest-schema.test.ts`

- [x] **Step 1: Write the failing schema tests**

```ts
import { describe, expect, it } from "vitest";
import { manifestSchema } from "../../src/manifest/manifest-schema";
import { buildEmptyManifest } from "../../src/manifest/build-empty-manifest";

describe("manifestSchema", () => {
  it("accepts a new empty manifest", () => {
    const parsed = manifestSchema.parse(buildEmptyManifest("C:/skillmux"));
    expect(parsed.version).toBe(1);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/manifest/manifest-schema.test.ts`
Expected: FAIL because schema helpers do not exist yet

- [x] **Step 3: Implement the manifest model and helpers**

```ts
export type Manifest = {
  version: 1;
  skillmuxHome: string;
  skills: Record<string, ManagedSkill>;
  agents: Record<string, AgentRecord>;
  activations: ActivationRecord[];
  lastScan: {
    at: string | null;
    issues: ScanIssue[];
  };
};
```

Use Zod to validate the on-disk format and keep one builder for empty state.

- [x] **Step 4: Run schema tests and full typecheck**

Run: `npm test -- --run tests/manifest/manifest-schema.test.ts`
Expected: PASS

Run: `npm run lint`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/core/types.ts src/core/errors.ts src/core/ids.ts src/manifest/manifest-schema.ts src/manifest/build-empty-manifest.ts tests/manifest/manifest-schema.test.ts
git commit -m "feat: define manifest schema and domain types"
```

### Task 3: Implement Manifest Read And Write Persistence

**Files:**
- Create: `src/manifest/read-manifest.ts`
- Create: `src/manifest/write-manifest.ts`
- Modify: `src/manifest/build-empty-manifest.ts`
- Test: `tests/manifest/read-write-manifest.test.ts`

- [x] **Step 1: Write the failing persistence test**

```ts
import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildEmptyManifest } from "../../src/manifest/build-empty-manifest";
import { readManifest } from "../../src/manifest/read-manifest";
import { writeManifest } from "../../src/manifest/write-manifest";

describe("manifest persistence", () => {
  it("round-trips a manifest on disk", async () => {
    const home = mkdtempSync(join(tmpdir(), "skillmux-"));
    const manifest = buildEmptyManifest(home);
    await writeManifest(home, manifest);
    const loaded = await readManifest(home);
    expect(loaded.skillmuxHome).toBe(home);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/manifest/read-write-manifest.test.ts`
Expected: FAIL because manifest persistence does not exist yet

- [x] **Step 3: Implement safe read and atomic write**

```ts
export async function writeManifest(home: string, manifest: Manifest): Promise<void> {
  const manifestPath = join(home, "manifest.json");
  const tmpPath = `${manifestPath}.tmp`;
  await fs.mkdir(home, { recursive: true });
  await fs.writeFile(tmpPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await fs.rename(tmpPath, manifestPath);
}
```

`readManifest` should:

- create an empty manifest if the file does not exist
- validate the file with Zod
- throw a typed error on invalid data

- [x] **Step 4: Run persistence tests**

Run: `npm test -- --run tests/manifest/read-write-manifest.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/manifest/read-manifest.ts src/manifest/write-manifest.ts src/manifest/build-empty-manifest.ts tests/manifest/read-write-manifest.test.ts
git commit -m "feat: add manifest persistence"
```

### Task 4: Add Path Resolution And Agent Discovery Rules

**Files:**
- Create: `src/config/default-agent-rules.ts`
- Create: `src/config/load-user-config.ts`
- Create: `src/config/resolve-skillmux-home.ts`
- Create: `src/discovery/discover-agents.ts`
- Create: `tests/helpers/temp-env.ts`
- Create: `tests/discovery/discover-agents.test.ts`

- [x] **Step 1: Write the failing discovery tests**

```ts
import { describe, expect, it } from "vitest";
import { discoverAgents } from "../../src/discovery/discover-agents";

describe("discoverAgents", () => {
  it("finds supported agent directories from built-in rules", async () => {
    const result = await discoverAgents({
      homeDir: "/tmp/user-home",
      platform: "linux"
    });
    expect(result.some((agent) => agent.name === "codex")).toBe(true);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/discovery/discover-agents.test.ts`
Expected: FAIL because discovery code does not exist yet

- [x] **Step 3: Implement built-in rules and user overrides**

Define built-in agent rules for at least:

- `codex`
- `claude`
- `gemini`
- `agents`
- `openclaw`

Model each rule with:

- stable agent name
- supported platforms
- home-relative root path
- skills directory path
- enabled by default flag

`discoverAgents` should merge built-in rules with user overrides and return resolved absolute paths plus existence status.

- [x] **Step 4: Run discovery tests**

Run: `npm test -- --run tests/discovery/discover-agents.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/config/default-agent-rules.ts src/config/load-user-config.ts src/config/resolve-skillmux-home.ts src/discovery/discover-agents.ts tests/helpers/temp-env.ts tests/discovery/discover-agents.test.ts
git commit -m "feat: add agent discovery and config loading"
```

### Task 5: Add Filesystem Safety And Link Operations

**Files:**
- Create: `src/fs/path-utils.ts`
- Create: `src/fs/link-ops.ts`
- Create: `src/fs/safe-copy.ts`
- Create: `src/fs/safe-remove-link.ts`
- Test: `tests/fs/link-ops.test.ts`

- [x] **Step 1: Write the failing filesystem tests**

```ts
import { describe, expect, it } from "vitest";
import { createManagedLink, isManagedLinkTarget } from "../../src/fs/link-ops";

describe("link-ops", () => {
  it("creates a link from an agent skill entry to the managed store", async () => {
    expect(typeof createManagedLink).toBe("function");
    expect(typeof isManagedLinkTarget).toBe("function");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/fs/link-ops.test.ts`
Expected: FAIL because filesystem helpers do not exist yet

- [x] **Step 3: Implement safe filesystem primitives**

Implement helpers that:

- normalize and compare absolute paths safely
- create directory links using `fs.symlink`
- verify that an existing link points into SkillMux home
- remove links without deleting normal directories
- copy skill contents into the managed store without following dangerous paths

Keep all platform branching inside `src/fs`.

- [x] **Step 4: Run filesystem tests**

Run: `npm test -- --run tests/fs/link-ops.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/fs/path-utils.ts src/fs/link-ops.ts src/fs/safe-copy.ts src/fs/safe-remove-link.ts tests/fs/link-ops.test.ts
git commit -m "feat: add filesystem safety and link helpers"
```

### Task 6: Implement Scan And List Commands

**Files:**
- Create: `src/discovery/scan-agent-skills.ts`
- Create: `src/discovery/infer-skill-entry.ts`
- Create: `src/output/print-table.ts`
- Create: `src/output/print-json.ts`
- Create: `src/output/format-issue.ts`
- Create: `src/commands/scan.ts`
- Create: `src/commands/list.ts`
- Modify: `src/cli.ts`
- Test: `tests/helpers/create-agent-fixture.ts`
- Test: `tests/commands/scan.test.ts`

- [x] **Step 1: Write the failing scan command tests**

```ts
import { describe, expect, it } from "vitest";
import { runScan } from "../../src/commands/scan";

describe("runScan", () => {
  it("records discovered agents and issues in the manifest", async () => {
    const result = await runScan({ json: true });
    expect(result.lastScan).toBeDefined();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/commands/scan.test.ts`
Expected: FAIL because scan and list command handlers do not exist yet

- [x] **Step 3: Implement scan and list**

`runScan` should:

- discover agents
- inspect each skills directory
- classify entries as managed link, unmanaged directory, broken link, or unknown
- update `lastScan`
- refresh known agent records in the manifest

`runList` should:

- support all records, by agent, and by skill views
- emit either table output or JSON

- [x] **Step 4: Run targeted tests**

Run: `npm test -- --run tests/commands/scan.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/discovery/scan-agent-skills.ts src/discovery/infer-skill-entry.ts src/output/print-table.ts src/output/print-json.ts src/output/format-issue.ts src/commands/scan.ts src/commands/list.ts src/cli.ts tests/helpers/create-agent-fixture.ts tests/commands/scan.test.ts
git commit -m "feat: add scan and list commands"
```

### Task 7: Implement Import Command And Managed Store Migration

**Files:**
- Create: `src/commands/import.ts`
- Modify: `src/fs/safe-copy.ts`
- Modify: `src/manifest/read-manifest.ts`
- Modify: `src/manifest/write-manifest.ts`
- Test: `tests/commands/import.test.ts`

- [x] **Step 1: Write the failing import tests**

```ts
import { describe, expect, it } from "vitest";
import { runImport } from "../../src/commands/import";

describe("runImport", () => {
  it("copies a local skill into the managed store and records it", async () => {
    const result = await runImport({
      sourcePath: "/tmp/existing-skill",
      skillName: "find-skills"
    });
    expect(result.skill.name).toBe("find-skills");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/commands/import.test.ts`
Expected: FAIL because import behavior does not exist yet

- [x] **Step 3: Implement safe import**

`runImport` should:

- validate the source path exists
- compute a stable `skillId`
- copy the source into `<skillmux-home>/skills/<skillId>`
- record source metadata in the manifest
- refuse to overwrite a conflicting managed skill

Keep `v0` conservative:

- default to copy, not move
- do not delete the original source path
- error on ambiguous source layouts

- [x] **Step 4: Run import tests**

Run: `npm test -- --run tests/commands/import.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/commands/import.ts src/fs/safe-copy.ts src/manifest/read-manifest.ts src/manifest/write-manifest.ts tests/commands/import.test.ts
git commit -m "feat: add managed skill import"
```

### Task 8: Implement Enable And Disable Commands

**Files:**
- Create: `src/commands/enable.ts`
- Create: `src/commands/disable.ts`
- Modify: `src/fs/link-ops.ts`
- Modify: `src/cli.ts`
- Test: `tests/commands/enable-disable.test.ts`

- [x] **Step 1: Write the failing activation tests**

```ts
import { describe, expect, it } from "vitest";
import { runEnable } from "../../src/commands/enable";
import { runDisable } from "../../src/commands/disable";

describe("activation commands", () => {
  it("enables and disables a managed skill for one agent idempotently", async () => {
    const enableResult = await runEnable({ skill: "find-skills", agent: "codex" });
    expect(enableResult.changed).toBe(true);
    const disableResult = await runDisable({ skill: "find-skills", agent: "codex" });
    expect(disableResult.changed).toBe(true);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/commands/enable-disable.test.ts`
Expected: FAIL because activation handlers do not exist yet

- [x] **Step 3: Implement activation behavior**

`runEnable` should:

- load manifest
- validate the managed skill and target agent
- ensure the agent skills directory exists
- create the managed link
- upsert the activation record

`runDisable` should:

- validate that the target entry is a removable managed link
- remove only the link
- mark the activation as disabled or remove it from the active set

Both commands must be idempotent.

- [x] **Step 4: Run activation tests**

Run: `npm test -- --run tests/commands/enable-disable.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/commands/enable.ts src/commands/disable.ts src/fs/link-ops.ts src/cli.ts tests/commands/enable-disable.test.ts
git commit -m "feat: add enable and disable commands"
```

### Task 9: Implement Doctor And Config Commands

**Files:**
- Create: `src/commands/doctor.ts`
- Create: `src/commands/config.ts`
- Modify: `src/output/format-issue.ts`
- Modify: `src/config/load-user-config.ts`
- Test: `tests/commands/doctor.test.ts`

- [x] **Step 1: Write the failing doctor tests**

```ts
import { describe, expect, it } from "vitest";
import { runDoctor } from "../../src/commands/doctor";

describe("runDoctor", () => {
  it("reports broken links and unmanaged skill directories", async () => {
    const result = await runDoctor({ json: true });
    expect(Array.isArray(result.issues)).toBe(true);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/commands/doctor.test.ts`
Expected: FAIL because doctor behavior does not exist yet

- [x] **Step 3: Implement doctor and config surfaces**

`runDoctor` should report:

- broken managed links
- manifest entries whose paths are missing
- unmanaged directories that look like skills
- duplicate or conflicting agent entries

`config` only needs a minimal `v0` surface:

- show resolved config
- validate user override file

Do not add config mutation subcommands in `v0`.

- [x] **Step 4: Run doctor tests**

Run: `npm test -- --run tests/commands/doctor.test.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/commands/doctor.ts src/commands/config.ts src/output/format-issue.ts src/config/load-user-config.ts tests/commands/doctor.test.ts
git commit -m "feat: add doctor and config commands"
```

### Task 10: Finalize Packaging, Documentation, And End-To-End Verification

**Files:**
- Modify: `src/cli.ts`
- Modify: `README.md`
- Modify: `package.json`
- Create: `tests/e2e/managed-flow.test.ts`

- [x] **Step 1: Write the failing end-to-end test**

```ts
import { describe, expect, it } from "vitest";

describe("managed flow", () => {
  it("scans, imports, enables, lists, disables, and diagnoses one managed skill", async () => {
    expect(true).toBe(false);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/e2e/managed-flow.test.ts`
Expected: FAIL with the intentional false assertion

- [x] **Step 3: Replace the placeholder with the full end-to-end scenario**

Cover this flow in one temporary test environment:

- create fake `codex` and `claude` skill directories
- seed one unmanaged local skill
- run import
- enable into two agents
- verify list output and manifest state
- disable from one agent
- create one broken link
- verify doctor reports it

Update `README.md` with:

- install and build commands
- supported commands
- SkillMux home layout
- safe usage notes

- [x] **Step 4: Run the full verification suite**

Run: `npm test`
Expected: PASS

Run: `npm run lint`
Expected: PASS

Run: `npm run build`
Expected: PASS and emit `dist/index.js`

- [x] **Step 5: Commit**

```bash
git add src/cli.ts README.md package.json tests/e2e/managed-flow.test.ts
git commit -m "feat: complete skillmux v0 managed cli flow"
```

## Suggested Defaults To Use During Implementation

Use these defaults unless a later implementation checkpoint proves they are wrong:

- Node target: current active LTS
- Module format: ESM
- Test runner: Vitest
- Build tool: tsup
- CLI parser: Commander
- Config file path: `<skillmux-home>/config.json`
- Managed store path: `<skillmux-home>/skills/<skill-id>`
- Import mode: copy by default
- Output mode: human-readable text by default, `--json` optional

## Risks To Watch During Execution

- Windows link creation may require privilege handling or alternative link strategies
- Some agent ecosystems may use directory layouts that differ from `skills.sh`
- Scanning must not mistake normal directories for removable managed links
- Manifest drift is likely if users modify agent directories outside SkillMux

## Definition Of Done

SkillMux v0 is done when all of the following are true:

- a fresh install builds and runs as an npm CLI
- `scan`, `list`, `import`, `enable`, `disable`, `agents`, `doctor`, and `config` all exist
- managed skills are stored in one SkillMux home
- at least two agents can reference one managed skill through links
- broken links and unmanaged directories are reported safely
- tests, typecheck, and build all pass

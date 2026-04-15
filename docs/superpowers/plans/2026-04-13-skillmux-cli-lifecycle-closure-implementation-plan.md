# SkillMux CLI Lifecycle Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining CLI lifecycle gaps in SkillMux by adding safe skill removal, first-class adoption of already-installed skills, fuller config maintenance commands, and batch operations before any TUI work.

**Architecture:** This phase keeps the existing SkillMux model intact. `npx skills` remains the remote install entrypoint, while SkillMux expands only the local-management layer. The work should land in narrow CLI slices: first a conservative `remove` command, then a dedicated `adopt` flow for externally installed skills, then config completion, and finally batch orchestration built on top of already-stable single-item commands.

**Tech Stack:** Node.js, TypeScript, Commander, Zod, Vitest, tsup

---

## Planned File Structure

### Commands

- Create: `src/commands/remove.ts`
- Create: `src/commands/adopt.ts`
- Create: `src/commands/config-update-agent.ts`

### Filesystem And Discovery

- Modify: `src/fs/safe-remove-link.ts`
- Modify: `src/fs/safe-copy.ts`
- Modify: `src/fs/link-ops.ts`
- Modify: `src/discovery/scan-agent-skills.ts`
- Modify: `src/discovery/infer-skill-entry.ts`

### Manifest And Domain Helpers

- Modify: `src/manifest/read-manifest.ts`
- Modify: `src/manifest/write-manifest.ts`
- Modify: `src/core/errors.ts`
- Modify: `src/core/types.ts`

### CLI Surface

- Modify: `src/index.ts`

### Tests

- Create: `tests/commands/remove.test.ts`
- Create: `tests/commands/adopt.test.ts`
- Create: `tests/commands/config-update-agent.test.ts`
- Create: `tests/commands/batch-operations.test.ts`
- Modify: `tests/e2e/managed-flow.test.ts`

### Docs

- Modify: `README.md`
- Modify: `PROJECT_STATUS.md`
- Modify: `NEXT_ACTIONS.md`
- Modify: `DECISIONS.md`

## Implementation Order

Build this phase in four product slices:

1. `remove skill`
2. `adopt` already-installed skills
3. `config` completion
4. batch operations

Each slice should end with a full verification pass and a commit before the next slice begins.

### Task 1: Add Safe Managed Skill Removal

**Files:**
- Create: `src/commands/remove.ts`
- Modify: `src/index.ts`
- Modify: `src/manifest/read-manifest.ts`
- Modify: `src/manifest/write-manifest.ts`
- Modify: `src/core/errors.ts`
- Test: `tests/commands/remove.test.ts`

- [x] **Step 1: Write the failing remove-command tests**

```ts
import { describe, expect, it } from "vitest";
import { runRemove } from "../../src/commands/remove";

describe("runRemove", () => {
  it("removes a managed skill that is disabled everywhere", async () => {
    const result = await runRemove({
      skill: "find-skills"
    });

    expect(result.changed).toBe(true);
    expect(result.removedSkillId).toBe("find-skills");
  });

  it("refuses to remove a skill that is still enabled for an agent", async () => {
    await expect(
      runRemove({
        skill: "find-skills"
      })
    ).rejects.toThrow(/still enabled/i);
  });
});
```

- [x] **Step 2: Run the remove tests to verify the red state**

Run: `npm test -- --run tests/commands/remove.test.ts`  
Expected: FAIL because `runRemove` does not exist yet

- [x] **Step 3: Implement the minimal safe remove behavior**

`runRemove` should:

- resolve the target managed skill by name or id
- reject removal if any activation for that skill is still enabled
- delete only the managed directory under `<skillmux-home>/skills/<skill-id>`
- remove the skill record from `manifest.skills`
- remove related activation records from `manifest.activations`
- return structured output with `changed`, `removedSkillId`, and `configPath`-style location context

The initial implementation should not include `--force`.

- [x] **Step 4: Wire the CLI command**

Add:

```ts
program
  .command("remove")
  .requiredOption("--skill <skill>", "Managed skill name or id")
  .option("--json", "Emit structured JSON output")
```

- [x] **Step 5: Run the targeted remove tests again**

Run: `npm test -- --run tests/commands/remove.test.ts`  
Expected: PASS

- [x] **Step 6: Run the full verification suite**

Run: `npm test`  
Expected: PASS

Run: `npm run typecheck`  
Expected: PASS

Run: `npm run build`  
Expected: PASS

- [x] **Step 7: Commit**

```bash
git add src/commands/remove.ts src/index.ts src/manifest/read-manifest.ts src/manifest/write-manifest.ts src/core/errors.ts tests/commands/remove.test.ts
git commit -m "feat: add managed skill removal"
```

### Task 2: Add First-Class Adoption For Already-Installed Skills

**Files:**
- Create: `src/commands/adopt.ts`
- Modify: `src/index.ts`
- Modify: `src/discovery/scan-agent-skills.ts`
- Modify: `src/discovery/infer-skill-entry.ts`
- Modify: `src/fs/safe-copy.ts`
- Modify: `src/fs/link-ops.ts`
- Modify: `src/core/errors.ts`
- Test: `tests/commands/adopt.test.ts`

- [x] **Step 1: Write the failing adopt-command tests**

```ts
import { describe, expect, it } from "vitest";
import { runAdopt } from "../../src/commands/adopt";

describe("runAdopt", () => {
  it("adopts one externally installed skill for one agent", async () => {
    const result = await runAdopt({
      agent: "codex",
      skill: "find-skills"
    });

    expect(result.adopted).toHaveLength(1);
    expect(result.adopted[0]?.skillId).toBe("find-skills");
  });

  it("adopts every eligible skill under one agent when no skill filter is provided", async () => {
    const result = await runAdopt({
      agent: "codex"
    });

    expect(result.adopted.length).toBeGreaterThan(0);
  });
});
```

- [x] **Step 2: Run the adopt tests to verify the red state**

Run: `npm test -- --run tests/commands/adopt.test.ts`  
Expected: FAIL because `runAdopt` does not exist yet

- [x] **Step 3: Implement single-agent adoption**

`runAdopt` should:

- resolve the target agent
- scan that agent's skills directory for adoptable entries
- treat only linked or directory entries with a root `SKILL.md` as eligible
- copy real content into `<skillmux-home>/skills/<skill-id>`
- preserve provenance in the manifest
- replace the agent-side live entry with a SkillMux-managed link when needed
- skip already-managed entries cleanly

Start with one-agent semantics. Do not add cross-agent batch support in this task.

- [x] **Step 4: Wire the CLI command**

Add:

```ts
program
  .command("adopt")
  .requiredOption("--agent <agent>", "Source agent id")
  .option("--skill <skill>", "One installed skill to adopt")
  .option("--json", "Emit structured JSON output")
```

- [x] **Step 5: Run the targeted adopt tests again**

Run: `npm test -- --run tests/commands/adopt.test.ts`  
Expected: PASS

- [x] **Step 6: Extend the managed-flow test if needed**

Update `tests/e2e/managed-flow.test.ts` so at least one scenario covers `npx skills`-style preinstalled local state entering SkillMux through `adopt`.

- [x] **Step 7: Run the full verification suite**

Run: `npm test`  
Expected: PASS

Run: `npm run typecheck`  
Expected: PASS

Run: `npm run build`  
Expected: PASS

- [x] **Step 8: Commit**

```bash
git add src/commands/adopt.ts src/index.ts src/discovery/scan-agent-skills.ts src/discovery/infer-skill-entry.ts src/fs/safe-copy.ts src/fs/link-ops.ts src/core/errors.ts tests/commands/adopt.test.ts tests/e2e/managed-flow.test.ts
git commit -m "feat: add adoption flow for installed skills"
```

### Task 3: Complete The `config` Command Family

**Files:**
- Create: `src/commands/config-update-agent.ts`
- Modify: `src/index.ts`
- Modify: `src/config/load-user-config.ts`
- Modify: `src/config/write-user-config.ts`
- Test: `tests/commands/config-update-agent.test.ts`

- [x] **Step 1: Write the failing config-update tests**

```ts
import { describe, expect, it } from "vitest";
import { runConfigUpdateAgent } from "../../src/commands/config-update-agent";

describe("runConfigUpdateAgent", () => {
  it("updates one existing agent override without deleting unspecified fields", async () => {
    const result = await runConfigUpdateAgent({
      id: "antigravity",
      name: "Updated Name"
    });

    expect(result.changed).toBe(true);
    expect(result.agent.stableName).toBe("Updated Name");
  });
});
```

- [x] **Step 2: Run the config-update tests to verify the red state**

Run: `npm test -- --run tests/commands/config-update-agent.test.ts`  
Expected: FAIL because `runConfigUpdateAgent` does not exist yet

- [x] **Step 3: Implement narrow update semantics**

`runConfigUpdateAgent` should:

- update only one existing override
- preserve unspecified fields
- reject attempts to update an override that does not exist
- reuse the same path-safety rules as `config add-agent`

This task should not create a general-purpose config editor.

- [x] **Step 4: Wire the CLI subcommand**

Add:

```ts
configCommand
  .command("update-agent")
  .requiredOption("--id <id>", "Agent id")
```

Include only the flags that match supported fields.

- [x] **Step 5: Run the targeted config-update tests again**

Run: `npm test -- --run tests/commands/config-update-agent.test.ts`  
Expected: PASS

- [x] **Step 6: Run the full verification suite**

Run: `npm test`  
Expected: PASS

Run: `npm run typecheck`  
Expected: PASS

Run: `npm run build`  
Expected: PASS

- [x] **Step 7: Commit**

```bash
git add src/commands/config-update-agent.ts src/index.ts src/config/load-user-config.ts src/config/write-user-config.ts tests/commands/config-update-agent.test.ts
git commit -m "feat: add config update-agent command"
```

### Task 4: Add Batch Operations On Stable Single-Item Commands

**Files:**
- Modify: `src/commands/enable.ts`
- Modify: `src/commands/disable.ts`
- Modify: `src/commands/adopt.ts`
- Modify: `src/commands/remove.ts`
- Modify: `src/index.ts`
- Test: `tests/commands/batch-operations.test.ts`

- [x] **Step 1: Write the failing batch-operation tests**

```ts
import { describe, expect, it } from "vitest";
import { runEnable } from "../../src/commands/enable";

describe("batch operations", () => {
  it("enables one skill for multiple agents", async () => {
    const result = await runEnable({
      skill: "find-skills",
      agents: ["codex", "claude"]
    });

    expect(result.changedAgents).toEqual(["codex", "claude"]);
  });
});
```

- [x] **Step 2: Run the batch tests to verify the red state**

Run: `npm test -- --run tests/commands/batch-operations.test.ts`  
Expected: FAIL because batch inputs are not supported yet

- [x] **Step 3: Implement one batch shape at a time**

Start with the smallest high-value shape:

- enable one skill for multiple agents
- disable one skill for multiple agents

After that passes, extend to:

- adopt multiple skills under one agent
- remove multiple disabled skills

Each batch path should call the existing single-item logic instead of duplicating it.

- [x] **Step 4: Add CLI flags that map cleanly to batch semantics**

Example shapes:

```ts
.option("--agent <agent>", "Repeatable target agent", collectValues, [])
.option("--skill <skill>", "Repeatable target skill", collectValues, [])
```

Do not overload one command with ambiguous mixed modes.

- [x] **Step 5: Run the targeted batch tests again**

Run: `npm test -- --run tests/commands/batch-operations.test.ts`  
Expected: PASS

- [x] **Step 6: Run the full verification suite**

Run: `npm test`  
Expected: PASS

Run: `npm run typecheck`  
Expected: PASS

Run: `npm run build`  
Expected: PASS

- [x] **Step 7: Commit**

```bash
git add src/commands/enable.ts src/commands/disable.ts src/commands/adopt.ts src/commands/remove.ts src/index.ts tests/commands/batch-operations.test.ts
git commit -m "feat: add batch lifecycle operations"
```

### Task 5: Final Documentation And Release Readiness

**Files:**
- Modify: `README.md`
- Modify: `PROJECT_STATUS.md`
- Modify: `NEXT_ACTIONS.md`
- Modify: `DECISIONS.md`

- [x] **Step 1: Update the README only after the new UX exists**

Document:

- `remove`
- `adopt`
- `config update-agent`
- the intended workflow split between `npx skills` and SkillMux
- the most useful batch operation shapes

- [x] **Step 2: Refresh the project state docs**

Update:

- accepted status in `PROJECT_STATUS.md`
- completed tasks and next steps in `NEXT_ACTIONS.md`
- any command-semantics decisions in `DECISIONS.md`

- [x] **Step 3: Run the full verification suite one last time**

Run: `npm test`  
Expected: PASS

Run: `npm run typecheck`  
Expected: PASS

Run: `npm run build`  
Expected: PASS

- [x] **Step 4: Commit**

```bash
git add README.md PROJECT_STATUS.md NEXT_ACTIONS.md DECISIONS.md
git commit -m "docs: record lifecycle closure updates"
```

## Suggested Defaults To Use During Implementation

Use these defaults unless a later checkpoint proves they are wrong:

- keep destructive behavior opt-in and conservative
- keep one managed skill directory per `skillId`
- keep `npx skills` outside SkillMux runtime logic
- keep batch flows as wrappers around single-item commands
- keep output human-readable by default and `--json` optional

## Risks To Watch During Execution

- removal may accidentally target directories that are not SkillMux-managed if path checks are loose
- adoption may misclassify non-skill directories if `SKILL.md` validation is too weak
- config update commands may drift into a generic editor if the surface is not kept narrow
- batch operations may become ambiguous if CLI flags overload single-item and multi-item modes poorly

## Definition Of Done

This lifecycle-closure phase is done when all of the following are true:

- `skillmux remove --skill <skill>` safely deletes disabled managed skills
- `skillmux adopt` provides a first-class path for bringing already-installed local skills under SkillMux management
- custom agent config maintenance is complete enough for real use at the CLI level
- common multi-target workflows no longer require users to write shell loops
- the command surface is stable enough that a later TUI can present it without redesign

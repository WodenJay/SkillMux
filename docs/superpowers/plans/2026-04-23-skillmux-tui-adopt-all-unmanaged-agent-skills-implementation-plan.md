# SkillMux TUI Adopt All Unmanaged Skills For Current Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `Shift+A` bulk action in `skillmux tui` that adopts all unmanaged skills for the currently selected agent while preserving the existing lowercase `a` single-row adopt flow.

**Architecture:** Keep the dashboard agent-first and implement bulk adopt as a thin TUI orchestration feature, not a new lifecycle engine. The reducer exposes a new bulk-adopt intent and confirmation modal, the action dispatcher maps that intent to the existing `runAdopt({ agent })` helper, and the UI surfaces the shortcut in the footer/help plus one focused PTY scenario that proves the real filesystem side effects.

**Tech Stack:** TypeScript, Ink, Vitest, existing SkillMux TUI reducer/action architecture, existing PTY explorer harness in `tests/tui-e2e/`

---

## Required Skills During Implementation

- Use `$terminal-ui` before changing TUI keyboard handling, confirmation dialogs, or footer/help behavior.
- Use `superpowers:test-driven-development` before each code task.
- Use `superpowers:systematic-debugging` if the new shortcut or PTY scenario behaves unexpectedly.
- Use `superpowers:verification-before-completion` before accepting each task or commit.

## Planned File Structure

### State And Action Contract

- Modify: `src/tui/state.ts`
- Modify: `src/tui/actions.ts`

### App And Presentational Components

- Modify: `src/tui/app.tsx`
- Modify: `src/tui/components/Footer.tsx`
- Modify: `src/tui/components/HelpOverlay.tsx`
- Modify: `src/tui/components/ConfirmDialog.tsx`

### Tests

- Modify: `tests/tui/state.test.ts`
- Modify: `tests/tui/actions.test.ts`
- Modify: `tests/tui/components.test.tsx`
- Modify: `tests/tui-e2e/explorer.ts`
- Create: `tests/tui-e2e/scenarios/bulk-adopt-flow.test.ts`

### Tracking Docs

- Modify: `AGENTS.md`
- Modify: `PROJECT_STATUS.md`
- Modify: `NEXT_ACTIONS.md`
- Modify: `DECISIONS.md`
- Modify: `docs/superpowers/plans/2026-04-23-skillmux-tui-adopt-all-unmanaged-agent-skills-implementation-plan.md`

## Task 1: Add The Bulk-Adopt Reducer And Dispatcher Contract

**Files:**
- Modify: `src/tui/state.ts`
- Modify: `src/tui/actions.ts`
- Modify: `tests/tui/state.test.ts`
- Modify: `tests/tui/actions.test.ts`

- [x] **Step 1: Write the failing reducer tests**

Extend `tests/tui/state.test.ts` with focused cases for:

- `getAvailableActions()` exposes `adoptAll: true` when the selected agent has `unmanagedCount > 0`
- `adoptAll: false` when no selected agent exists or the selected agent has no unmanaged skills
- `request-adopt-all` opens a `confirm-adopt-all` modal even when focus is `agents`
- `request-adopt-all` leaves lowercase `request-adopt` behavior unchanged for a focused unmanaged row
- `request-adopt-all` refuses the action with a short status when the current agent has no unmanaged skills

Use model shapes already present in the test file. The new modal should be asserted directly:

```ts
expect(updateTuiState(withUnmanagedAgent, { type: "request-adopt-all" }).modal).toEqual({
  kind: "confirm-adopt-all",
  agentId: "codex",
  unmanagedCount: 2
});
```

- [x] **Step 2: Write the failing dispatcher tests**

Extend `tests/tui/actions.test.ts` with focused cases for:

- `dispatchTuiAction({ action: "adopt-all" })` calls `runAdopt({ agent })` without `skill`
- successful bulk adopt reloads the dashboard and trims trailing newlines
- bulk adopt refuses to run when there is no selected agent

Target assertion:

```ts
expect(services.runAdopt).toHaveBeenCalledWith({
  homeDir: undefined,
  skillmuxHome: undefined,
  agent: "codex"
});
```

- [x] **Step 3: Run the targeted tests to verify the red state**

Run:

```powershell
npm test -- --run tests/tui/state.test.ts tests/tui/actions.test.ts
```

Expected: FAIL because `state.ts` and `actions.ts` do not yet define the bulk-adopt event, modal, availability flag, or dispatcher action.

- [x] **Step 4: Implement the reducer-side bulk-adopt contract**

Update `src/tui/state.ts` so it adds:

- a new modal shape:

```ts
| { kind: "confirm-adopt-all"; agentId: string; unmanagedCount: number }
```

- a new event:

```ts
| { type: "request-adopt-all" }
```

- a new available action flag:

```ts
adoptAll: boolean;
```

Reducer rules:

- `request-adopt-all` works when the selected agent has unmanaged skills, even if focus is `agents`
- the selected agent is the current scope; no row-level unmanaged selection is required
- the status message on refusal should be concise and user-facing, for example `No unmanaged skills to adopt for this agent`
- existing lowercase `request-adopt` row behavior must remain unchanged

- [x] **Step 5: Implement the dispatcher-side bulk-adopt contract**

Update `src/tui/actions.ts` so:

- `TuiAction` includes `"adopt-all"`
- `TuiActionServices["runAdopt"]` accepts an omitted `skill`
- the dispatcher resolves the currently selected agent from `model.selectedAgentId`
- `"adopt-all"` calls:

```ts
const result = await services.runAdopt({
  homeDir: input.homeDir,
  skillmuxHome: input.skillmuxHome,
  agent: input.model.selectedAgentId
});
```

- missing selected-agent state returns a short refusal, not a thrown exception
- reload behavior matches the existing `toggle` / `adopt` / `scan` contract

- [x] **Step 6: Run targeted verification**

Run:

```powershell
npm test -- --run tests/tui/state.test.ts tests/tui/actions.test.ts
```

Expected: PASS.

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [x] **Step 7: Commit Task 1**

```powershell
git add src/tui/state.ts src/tui/actions.ts tests/tui/state.test.ts tests/tui/actions.test.ts
git commit -m "feat: add tui bulk adopt action contract"
```

## Task 2: Wire Shift+A Into App And User-Facing TUI Copy

**Files:**
- Modify: `src/tui/app.tsx`
- Modify: `src/tui/components/Footer.tsx`
- Modify: `src/tui/components/HelpOverlay.tsx`
- Modify: `src/tui/components/ConfirmDialog.tsx`
- Modify: `tests/tui/components.test.tsx`

- [x] **Step 1: Write the failing component and app tests**

Extend `tests/tui/components.test.tsx` with cases for:

- footer shows `[Shift+A]adopt all` when `actions.adoptAll` is true
- footer hides the shortcut when `adoptAll` is false
- help overlay explains `Shift+A` as current-agent bulk adopt
- confirm dialog renders explicit bulk-adopt copy, for example:

```ts
<ConfirmDialog
  modal={{ kind: "confirm-adopt-all", agentId: "codex", unmanagedCount: 2 }}
/>
```

- `App` sends the new reducer event when uppercase `A` is pressed
- once the confirm dialog is open, pressing `y` dispatches `action: "adopt-all"` exactly once

- [x] **Step 2: Run the targeted component test to verify the red state**

Run:

```powershell
npm test -- --run tests/tui/components.test.tsx
```

Expected: FAIL because the footer/help/confirm components and `App` keyboard wiring do not yet know about `Shift+A`.

- [x] **Step 3: Implement the user-facing bulk-adopt UI**

Update the components so the user contract is explicit:

- `Footer.tsx`
  - insert `[Shift+A]adopt all` when `actions.adoptAll` is true
  - keep lowercase `[a]adopt` as the row-level action
- `HelpOverlay.tsx`
  - change the actions line to mention both `a` and `Shift+A`
- `ConfirmDialog.tsx`
  - accept the new `confirm-adopt-all` modal
  - render copy like:

```ts
Adopt all unmanaged skills for codex?
2 unmanaged skills will be moved under SkillMux management.
```

- `app.tsx`
  - map uppercase `"A"` to `request-adopt-all`
  - on `y`, dispatch `runAction("adopt-all", ...)` for the bulk modal
  - preserve the existing duplicate-confirmation guard and lowercase `a` flow

- [x] **Step 4: Run targeted verification**

Run:

```powershell
npm test -- --run tests/tui/components.test.tsx
```

Expected: PASS.

Run:

```powershell
npm run build
```

Expected: PASS.

- [x] **Step 5: Commit Task 2**

```powershell
git add src/tui/app.tsx src/tui/components/Footer.tsx src/tui/components/HelpOverlay.tsx src/tui/components/ConfirmDialog.tsx tests/tui/components.test.tsx
git commit -m "feat: add tui shift-a bulk adopt flow"
```

## Task 3: Prove The Real PTY Bulk-Adopt Flow

**Files:**
- Modify: `tests/tui-e2e/explorer.ts`
- Create: `tests/tui-e2e/scenarios/bulk-adopt-flow.test.ts`

- [x] **Step 1: Write the failing PTY scenario**

Create `tests/tui-e2e/scenarios/bulk-adopt-flow.test.ts` with one real scenario:

- fixture has agent `codex`
- fixture seeds at least two unmanaged skills, for example `find-skills` and `terminal-ui`
- explorer launches on `codex`
- explorer presses bulk adopt once
- confirm dialog is asserted before `y`
- after confirm, both skills exist in managed storage and both agent-side paths are managed links

Use the existing fixture and explorer style:

```ts
await explorer.bulkAdopt();
await explorer.waitForText("Adopt all unmanaged skills for codex?");
await explorer.confirm();
await expect(explorer.fs.isSymlink(explorer.paths.agentSkill("codex", "find-skills"))).resolves.toBe(true);
await expect(explorer.fs.isSymlink(explorer.paths.agentSkill("codex", "terminal-ui"))).resolves.toBe(true);
```

- [x] **Step 2: Extend the explorer API for the new shortcut**

Update `tests/tui-e2e/explorer.ts` to add:

```ts
bulkAdopt(): Promise<void>;
```

and implement it with:

```ts
bulkAdopt() {
  return session.press("A");
}
```

- [x] **Step 3: Run the targeted PTY scenario to verify the red state**

Run:

```powershell
npm test -- --run tests/tui-e2e/scenarios/bulk-adopt-flow.test.ts
```

Expected: FAIL until the real TUI input and confirm flow support `Shift+A` end to end.

- [x] **Step 4: Fix any PTY-only gaps exposed by the scenario**

Keep changes narrow. Likely causes are:

- uppercase `A` not reaching the reducer path
- confirmation copy mismatch
- status text or reload timing needing the same confirm-dialog synchronization already used by other PTY lifecycle tests

Do not widen this into unrelated TUI polish.

- [x] **Step 5: Run targeted verification**

Run:

```powershell
npm test -- --run tests/tui-e2e/scenarios/bulk-adopt-flow.test.ts
```

Expected: PASS.

Run:

```powershell
npm run test:tui-e2e
```

Expected: PASS.

- [x] **Step 6: Commit Task 3**

```powershell
git add tests/tui-e2e/explorer.ts tests/tui-e2e/scenarios/bulk-adopt-flow.test.ts
git commit -m "test: cover tui bulk adopt flow"
```

## Task 4: Final Tracking Sync And Root Verification

**Files:**
- Modify: `AGENTS.md`
- Modify: `PROJECT_STATUS.md`
- Modify: `NEXT_ACTIONS.md`
- Modify: `DECISIONS.md`
- Modify: `docs/superpowers/plans/2026-04-23-skillmux-tui-adopt-all-unmanaged-agent-skills-implementation-plan.md`

- [ ] **Step 1: Update tracking docs as each task lands**

Record:

- the accepted `Shift+A` user contract
- the fact that lowercase `a` is unchanged
- the root commits for each accepted implementation task
- the focused verification status

- [ ] **Step 2: Mark completed checkboxes in this plan**

As each task is accepted, update only the completed boxes from `[ ]` to `[x]`.

- [ ] **Step 3: Run the full verification gate from root**

Run:

```powershell
npm run build
```

Expected: PASS.

Run:

```powershell
npm run test:tui-e2e
```

Expected: PASS.

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
git diff --check
```

Expected: no whitespace or merge-marker errors.

- [ ] **Step 4: Commit the accepted tracking state**

```powershell
git add AGENTS.md PROJECT_STATUS.md NEXT_ACTIONS.md DECISIONS.md docs/superpowers/plans/2026-04-23-skillmux-tui-adopt-all-unmanaged-agent-skills-implementation-plan.md
git commit -m "docs: record tui bulk adopt plan progress"
```

## Final Verification Before Acceptance

Run from the root accepted state:

```powershell
npm run build
```

Expected: PASS.

```powershell
npm run test:tui-e2e
```

Expected: PASS.

```powershell
npm test
```

Expected: PASS.

```powershell
npm run typecheck
```

Expected: PASS.

```powershell
git diff --check
```

Expected: no whitespace or unresolved merge-marker errors.

## Execution Handoff

Recommended execution mode: **Subagent-Driven**.

Use a fresh worker per task. After each accepted task:

1. Run the targeted verification listed in the task.
2. Review spec compliance for that task.
3. Review code quality for that task.
4. Update this plan and the four tracking docs.
5. Commit the accepted slice before moving to the next task.

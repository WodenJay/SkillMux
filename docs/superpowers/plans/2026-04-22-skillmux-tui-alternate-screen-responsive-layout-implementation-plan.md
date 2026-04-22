# SkillMux TUI Alternate Screen And Responsive Fullscreen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `skillmux tui` enter the terminal alternate screen by default, render as a responsive fullscreen dashboard, and restore the original shell screen cleanly on exit.

**Architecture:** Add a small terminal-session wrapper around the existing TUI launch path so alternate-screen entry and teardown are centralized instead of being scattered across input handlers. Keep the existing three-panel dashboard, but replace fixed-width pane sizing with responsive ratios and minimum-size fallback logic, then lock the behavior down with focused lifecycle, layout, and PTY tests.

**Tech Stack:** TypeScript, Ink, Commander, Vitest, existing PTY harness in `tests/tui-e2e/`

---

## Required Skills During Implementation

- Use `$terminal-ui` before changing TUI runtime behavior, rendering, or keyboard/exit handling.
- Use `superpowers:test-driven-development` before each task that changes code.
- Use `superpowers:systematic-debugging` if alternate-screen teardown or PTY assertions fail unexpectedly.
- Use `superpowers:verification-before-completion` before each task acceptance or commit.

## Planned File Structure

### Runtime And Launch Path

- Modify: `src/tui/launch-tui.ts`
- Modify: `src/tui/app.tsx`
- Modify: `src/tui/tty.ts`
- Create or modify a focused terminal-session helper if needed under `src/tui/`

### Responsive Dashboard Layout

- Modify: `src/tui/components/Dashboard.tsx`
- Modify: `src/tui/components/AgentList.tsx`
- Modify: `src/tui/components/SkillList.tsx`
- Modify: `src/tui/components/DetailPane.tsx`
- Modify: `src/tui/components/HelpOverlay.tsx`
- Modify: `src/tui/components/ConfirmDialog.tsx`

### Tests

- Modify: `tests/tui/launch-tui.test.ts`
- Modify: `tests/tui/components.test.tsx`
- Modify: `tests/tui-e2e/scenarios/smoke.test.ts`
- Modify: `tests/tui-e2e/scenarios/usability-probes.test.ts`

### Tracking Docs

- Modify: `AGENTS.md`
- Modify: `PROJECT_STATUS.md`
- Modify: `NEXT_ACTIONS.md`
- Modify: `DECISIONS.md`
- Modify: `docs/superpowers/plans/2026-04-22-skillmux-tui-alternate-screen-responsive-layout-implementation-plan.md`

## Implementation Order

Build this slice in four tasks. Keep the paused Round 8 search-cancel WIP out of scope while implementing these tasks.

### Task 1: Add Alternate-Screen Session Lifecycle

**Files:**
- Modify: `src/tui/launch-tui.ts`
- Modify: `tests/tui/launch-tui.test.ts`
- Modify: `tests/tui-e2e/scenarios/smoke.test.ts`

- [x] **Step 1: Write the failing launch lifecycle tests**

Extend `tests/tui/launch-tui.test.ts` to assert that interactive launch writes the alternate-screen enter sequence before the app session begins and always writes the restore sequence on normal exit and failure.

Cover:

- normal launch/exit
- thrown launch/render failure after alternate-screen entry
- cursor restoration alongside screen restoration

- [x] **Step 2: Run the targeted launch test to verify the red state**

Run:

```powershell
npm test -- --run tests/tui/launch-tui.test.ts
```

Expected: FAIL because the current launch path does not own alternate-screen entry/restore.

- [x] **Step 3: Implement centralized alternate-screen entry and teardown**

Update `src/tui/launch-tui.ts` so the launch path:

- writes alternate-screen enter + cursor-hide on startup
- launches Ink inside that wrapped session
- restores main screen + cursor-show in a single `finally` path
- preserves the existing non-interactive guard behavior outside this helper

Implementation note: this logic belongs in the launch/runtime boundary, not in reducer state or dashboard components.

- [x] **Step 4: Add a real PTY smoke assertion for alternate-screen behavior**

Update `tests/tui-e2e/scenarios/smoke.test.ts` to verify the real CLI session:

- reaches the dashboard in PTY
- exits cleanly on `q`
- records the expected alternate-screen lifecycle events or output markers without leaving the dashboard frame as a final static shell residue

- [x] **Step 5: Run targeted verification**

Run:

```powershell
npm run build
```

Expected: PASS.

Run:

```powershell
npm test -- --run tests/tui/launch-tui.test.ts tests/tui-e2e/scenarios/smoke.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit Task 1**

```powershell
git add src/tui/launch-tui.ts tests/tui/launch-tui.test.ts tests/tui-e2e/scenarios/smoke.test.ts
git commit -m "feat: add tui alternate-screen lifecycle"
```

### Task 2: Replace Fixed Column Widths With Responsive Fullscreen Layout

**Files:**
- Modify: `src/tui/app.tsx`
- Modify: `src/tui/components/Dashboard.tsx`
- Modify: `src/tui/components/AgentList.tsx`
- Modify: `src/tui/components/SkillList.tsx`
- Modify: `src/tui/components/DetailPane.tsx`
- Modify: `tests/tui/components.test.tsx`

- [ ] **Step 1: Write the failing responsive layout tests**

Extend `tests/tui/components.test.tsx` with cases for:

- wide terminal: all three panes grow beyond the old fixed widths
- normal supported terminal: proportional three-column layout remains readable
- below-minimum terminal: fullscreen resize prompt renders instead of the dashboard

The tests should assert layout behavior through rendered text/structure, not through private implementation variables alone.

- [ ] **Step 2: Run the targeted component test to verify the red state**

Run:

```powershell
npm test -- --run tests/tui/components.test.tsx
```

Expected: FAIL because `Dashboard.tsx` still hardcodes `agentWidth = 24` and `skillWidth = 28`.

- [ ] **Step 3: Implement responsive pane sizing in the dashboard**

Refactor `src/tui/components/Dashboard.tsx` so:

- pane widths derive from current terminal width using ratios plus minimum guards
- the Detail pane yields width first as the screen narrows, while Agents and Skills remain usable
- the `80x24` threshold remains the hard minimum supported size
- the fallback message uses the full screen region instead of reading like an inline one-liner inside a partially rendered dashboard

- [ ] **Step 4: Align child components with the new fullscreen layout**

Update pane components only as needed so they behave well under wider and narrower responsive widths. Keep the current information architecture and focus model unchanged.

- [ ] **Step 5: Run targeted verification**

Run:

```powershell
npm run build
```

Expected: PASS.

Run:

```powershell
npm test -- --run tests/tui/components.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```powershell
git add src/tui/app.tsx src/tui/components/Dashboard.tsx src/tui/components/AgentList.tsx src/tui/components/SkillList.tsx src/tui/components/DetailPane.tsx tests/tui/components.test.tsx
git commit -m "feat: make tui layout responsive"
```

### Task 3: Lock Resize And Exit Semantics In PTY

**Files:**
- Modify: `tests/tui-e2e/scenarios/usability-probes.test.ts`
- Modify: `tests/tui-e2e/scenarios/smoke.test.ts`
- Modify: `src/tui/launch-tui.ts` and/or `src/tui/app.tsx` only if PTY verification exposes real terminal-semantics defects

- [ ] **Step 1: Extend the PTY usability probes with resize and restore assertions**

Update `tests/tui-e2e/scenarios/usability-probes.test.ts` so the real PTY path verifies:

- alternate-screen startup remains stable under the real built CLI
- resizing to a wider terminal preserves the fullscreen dashboard
- resizing down to the supported floor still renders correctly
- resizing below the supported floor shows the resize prompt
- exiting via `q` or `Ctrl+C` restores the session cleanly

- [ ] **Step 2: Run the targeted PTY scenarios to verify the red state**

Run:

```powershell
npm test -- --run tests/tui-e2e/scenarios/smoke.test.ts tests/tui-e2e/scenarios/usability-probes.test.ts
```

Expected: FAIL until the responsive/fullscreen runtime behavior is fully aligned with the PTY contract.

- [ ] **Step 3: Fix any real PTY-only defects exposed by the scenarios**

Keep fixes narrow. Only change runtime/rendering code where the PTY path proves the behavior is still wrong.

Likely examples:

- cleanup not running on one exit path
- resize prompt not replacing the full dashboard cleanly
- residual frame content still visible after exit in the PTY capture

- [ ] **Step 4: Run targeted verification**

Run:

```powershell
npm run build
```

Expected: PASS.

Run:

```powershell
npm test -- --run tests/tui-e2e/scenarios/smoke.test.ts tests/tui-e2e/scenarios/usability-probes.test.ts
```

Expected: PASS.

Run:

```powershell
npm run test:tui-e2e
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```powershell
git add tests/tui-e2e/scenarios/smoke.test.ts tests/tui-e2e/scenarios/usability-probes.test.ts src/tui/launch-tui.ts src/tui/app.tsx
git commit -m "test: verify tui fullscreen pty behavior"
```

### Task 4: Finalize Tracking And Run Repository Verification Gate

**Files:**
- Modify: `AGENTS.md`
- Modify: `PROJECT_STATUS.md`
- Modify: `NEXT_ACTIONS.md`
- Modify: `DECISIONS.md`
- Modify: `docs/superpowers/plans/2026-04-22-skillmux-tui-alternate-screen-responsive-layout-implementation-plan.md`

- [ ] **Step 1: Update tracking docs as each task lands**

Record:

- the accepted runtime model change
- the alternate-screen/default-fullscreen behavior
- the verification status for each accepted task
- the next follow-up slice: bulk adopt for unmanaged skills

- [ ] **Step 2: Mark completed steps in this plan**

As each task is accepted, change only its completed checkboxes from `[ ]` to `[x]`.

- [ ] **Step 3: Run the full verification gate from the root repo**

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

- [ ] **Step 4: Commit the accepted docs/tracking state**

```powershell
git add AGENTS.md PROJECT_STATUS.md NEXT_ACTIONS.md DECISIONS.md docs/superpowers/plans/2026-04-22-skillmux-tui-alternate-screen-responsive-layout-implementation-plan.md
git commit -m "docs: record tui alternate-screen plan progress"
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

Expected: no whitespace or unresolved-merge-marker errors.

## Execution Handoff

Recommended execution mode: **Subagent-Driven**.

Use a fresh worker per task. After each task:

1. Run the targeted verification listed in the task.
2. Review spec compliance for that task.
3. Review code quality for that task.
4. Update this plan's checkboxes and the root tracking docs.
5. Commit the accepted slice before moving to the next task.

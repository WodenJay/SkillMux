# SkillMux TUI Usability Follow-Up Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved post-review TUI usability corrections so the dashboard feels like it takes over the current terminal session, stays easier to read, and is easier to navigate with arrow keys.

**Architecture:** Keep the existing Ink dashboard and reducer architecture, but simplify the focus model and visual language. The follow-up should stay additive to the accepted TUI foundation: adjust layout ownership, panel rendering, reducer focus rules, and help text without reopening unrelated lifecycle behavior.

**Tech Stack:** Node.js, TypeScript, Commander, Ink, React, Vitest, tsup

---

## Requested Changes To Implement

1. Entering `skillmux tui` should visually occupy the whole terminal and feel like the current terminal has been taken over by the dashboard, rather than showing a small floating region inside the terminal.
2. Left and right arrow keys should switch focus between panels. `Tab` should no longer be the primary focus control.
3. Remove the `E0`, `D1` style counters beside agent rows because they read as noise.
4. Keep the user-facing status icons, but explain their meaning in the footer or help area so users can decode them without guessing.
5. When focus moves from Agents to Skills, the selected agent should remain clearly highlighted so users always know which agent is driving the Skills panel.
6. The Detail pane should not be focusable because it has no direct interaction.

## Scope Boundaries

- Do not change lifecycle command semantics.
- Do not redesign the dashboard into a different information architecture.
- Keep `Space` for enable/disable and `a` / `r` for adopt/remove.
- Preserve the accepted enabled/disabled state markers for skill rows: green filled circle when enabled, hollow circle when disabled.
- Keep the remaining status icons user-visible, but add visible legend/help text that explains them.
- Keep footer help and modal safety behavior unless needed to match the new focus model.

## Planned File Surface

### Likely Code Changes

- Modify: `src/tui/app.tsx`
- Modify: `src/tui/state.ts`
- Modify: `src/tui/components/Dashboard.tsx`
- Modify: `src/tui/components/AgentList.tsx`
- Modify: `src/tui/components/SkillList.tsx`
- Modify: `src/tui/components/DetailPane.tsx`
- Modify: `src/tui/components/Footer.tsx`
- Modify: `src/tui/components/HelpOverlay.tsx`
- Modify: `tests/tui/state.test.ts`
- Modify: `tests/tui/components.test.tsx`

### Tracking And Docs

- Modify: `AGENTS.md`
- Modify: `PROJECT_STATUS.md`
- Modify: `NEXT_ACTIONS.md`
- Modify: `DECISIONS.md`

## Implementation Order

### Task 1: Simplify Focus Model And Keyboard Contract

**Files:**
- Modify: `src/tui/state.ts`
- Modify: `src/tui/app.tsx`
- Modify: `tests/tui/state.test.ts`

- [x] **Step 1: Write failing reducer tests for the new focus contract**

Cover:

- left/right arrows switch focus between Agents and Skills
- the Detail pane is excluded from focus rotation
- selected agent remains visually selected even when Skills has focus
- `Tab` is either removed from focus switching or treated as a no-op, depending on the narrow implementation choice during execution

- [x] **Step 2: Run the targeted red test**

Run:

```powershell
npm test -- --run tests/tui/state.test.ts
```

Expected: FAIL before the reducer and keyboard wiring are updated.

- [x] **Step 3: Update reducer focus rules and keyboard event wiring**

Implementation goals:

- focusable panels become `agents` and `skills` only
- `LeftArrow` and `RightArrow` become the primary focus switch keys
- the App event handler and help text use the same contract

- [x] **Step 4: Re-run the targeted state test and typecheck**

Run:

```powershell
npm test -- --run tests/tui/state.test.ts
```

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [x] **Step 5: Commit**

```powershell
git add src/tui/state.ts src/tui/app.tsx tests/tui/state.test.ts
git commit -m "fix: simplify tui focus navigation"
```

### Task 2: Clean Up Panel Rendering And Visual Noise

**Files:**
- Modify: `src/tui/components/Dashboard.tsx`
- Modify: `src/tui/components/AgentList.tsx`
- Modify: `src/tui/components/SkillList.tsx`
- Modify: `src/tui/components/DetailPane.tsx`
- Modify: `src/tui/components/Footer.tsx`
- Modify: `src/tui/components/HelpOverlay.tsx`
- Modify: `tests/tui/components.test.tsx`

- [x] **Step 1: Write failing component tests for the new presentation rules**

Cover:

- no `E0` / `D1` counters in agent rows
- visible status icons are explained in footer/help text instead of being left unexplained
- the selected agent stays highlighted when Skills has focus
- the dashboard renders as a full-terminal layout that reads like the active terminal session, not a visibly shrunken inner block
- the Detail pane renders content without a focus affordance

- [x] **Step 2: Run the targeted red test**

Run:

```powershell
npm test -- --run tests/tui/components.test.tsx
```

Expected: FAIL before the presentation updates land.

- [x] **Step 3: Update the dashboard and panel components**

Implementation goals:

- make the root dashboard container own the full terminal frame so the app reads like it has taken over the current terminal session
- simplify agent rows to readable names and state, without noisy count abbreviations
- keep skill state markers only where they are user-meaningful
- add visible legend/help text for the remaining status icons instead of removing them
- remove focus chrome from the Detail pane
- keep the footer and help overlay aligned with the new left/right navigation model

- [x] **Step 4: Re-run component tests and typecheck**

Run:

```powershell
npm test -- --run tests/tui/components.test.tsx
```

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [x] **Step 5: Commit**

```powershell
git add src/tui/components src/tui/app.tsx tests/tui/components.test.tsx
git commit -m "fix: polish tui dashboard layout"
```

### Task 3: Verify Integrated Behavior And Refresh Documentation

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `PROJECT_STATUS.md`
- Modify: `NEXT_ACTIONS.md`
- Modify: `DECISIONS.md`
- Modify: `docs/superpowers/plans/2026-04-19-skillmux-tui-usability-follow-up-plan.md`

- [x] **Step 1: Run focused integration verification**

Run:

```powershell
npm test -- --run tests/tui/state.test.ts tests/tui/components.test.tsx tests/commands/tui.test.ts
```

Expected: PASS.

- [x] **Step 2: Run full verification**

Run:

```powershell
npm test
```

Run:

```powershell
npm run typecheck
```

Run:

```powershell
npm run build
```

Expected: PASS.

- [x] **Step 3: Update user-facing docs only if keyboard/help text changed**

If the visible keybinding contract changes in the shipped UI, update `README.md` additively so it matches the new interaction model.

- [x] **Step 4: Mark completed checklist items in this plan and tracking docs**

Keep `AGENTS.md`, `PROJECT_STATUS.md`, `NEXT_ACTIONS.md`, and `DECISIONS.md` synchronized with accepted state.

- [x] **Step 5: Commit**

```powershell
git add README.md AGENTS.md PROJECT_STATUS.md NEXT_ACTIONS.md DECISIONS.md docs/superpowers/plans/2026-04-19-skillmux-tui-usability-follow-up-plan.md
git commit -m "docs: record tui usability follow-up"
```

Date: 2026-04-23
Status: Approved in design review, pending written-spec review

# SkillMux TUI Adopt All Unmanaged Skills For Current Agent Design

## Purpose

The current TUI can adopt one unmanaged skill at a time with `a`. That works for sparse cleanup, but it becomes slow when one agent has several unmanaged skills that all need to enter SkillMux management.

This slice adds one explicit bulk action for the current selected agent:

- `Shift+A` adopts all unmanaged skills for the selected agent in one operation

This is a TUI usability and lifecycle slice. It does not change the underlying CLI lifecycle rules.

## User Goals

The accepted user goals for this slice are:

1. When the selected agent has several unmanaged skills, the user should not need to move row by row and press `a` repeatedly.
2. The bulk action should stay agent-scoped, matching the current agent-first dashboard model.
3. The action should remain explicit and safe, with confirmation before filesystem changes begin.
4. The existing single-row `a` adopt flow must remain available.

## Scope

This slice covers:

- one-key bulk adoption for the currently selected agent
- a dedicated confirmation dialog for the bulk action
- footer/help/status updates so the shortcut is discoverable
- reducer, action-dispatch, component, and PTY coverage for the new action

This slice does not cover:

- a global all-agents bulk adoption mode
- a new CLI command
- reworking the existing `skillmux adopt` filesystem behavior
- new list rows or other dashboard layout changes

## Interaction Model

The bulk action is bound to `Shift+A`.

Behavior:

- `Shift+A` is available when the currently selected agent has at least one unmanaged skill row
- the action may be triggered while focus is on either the Agents panel or the Skills panel
- the user does not need to highlight a specific unmanaged row first
- pressing `Shift+A` opens a confirmation dialog
- confirming runs one bulk adoption for the selected agent

The existing lowercase `a` behavior remains unchanged:

- `a` still adopts only the currently selected unmanaged row
- `a` still requires Skills focus and a focused unmanaged row

This split keeps the interaction predictable:

- lowercase `a` means one selected item
- uppercase `A` means all unmanaged skills for the current agent

## Execution Model

The TUI should not add a second implementation of bulk adoption.

Instead, the bulk action should reuse the existing CLI command helper:

- single-row adopt continues to call `runAdopt({ agent, skill })`
- bulk adopt calls `runAdopt({ agent })` with no `skill`

This matches the current CLI contract, where omitting `--skill` for one agent adopts every eligible unmanaged skill under that agent.

The TUI remains a thin orchestration layer over the accepted lifecycle command semantics.

## Confirmation And Feedback

`Shift+A` should open a dedicated confirmation dialog rather than silently starting work.

The dialog should make the scope explicit:

- selected agent id
- the fact that all unmanaged skills for that agent will be adopted
- the number of unmanaged skills that will be affected

Example shape:

- `Adopt all unmanaged skills for codex?`
- `3 unmanaged skills will be moved under SkillMux management.`

After confirmation:

- the modal closes
- the dashboard enters busy state
- the action result reloads the dashboard through the existing TUI reload path
- status text uses the command output on success
- failures stay one-line and non-stack-trace, consistent with the current TUI action contract

## State And UI Boundaries

This slice should stay within the existing TUI architecture.

Expected changes:

- `state.ts`
  - add a `request-adopt-all` event
  - add a `confirm-adopt-all` modal shape
  - expose bulk-adopt availability through the state-derived action contract
- `actions.ts`
  - add a TUI action for bulk adopt
  - dispatch it through `runAdopt({ agent })`
- `app.tsx`
  - map `Shift+A` to the bulk-adopt request
  - confirm with `y`
- footer/help/dialog components
  - describe `Shift+A` as the bulk action for the current agent

The Skills list itself should not gain a synthetic `adopt all` row. The action belongs to the command layer of the dashboard, not to the data rows.

## Error Handling

The TUI should preserve existing action behavior:

- if there is no selected agent, bulk adopt is unavailable
- if the selected agent has no unmanaged skills, `Shift+A` should not start work and should report a short refusal message
- command failures preserve the current model and show only the first-line error reason
- reload after success follows the existing selected-agent reload path

No new partial-failure policy is introduced here. Bulk adopt inherits the existing `runAdopt({ agent })` behavior.

## Test Strategy

This slice should extend the existing TUI coverage at four levels.

1. Reducer/state tests
   - bulk action availability only when the selected agent has unmanaged rows
   - `Shift+A` opens bulk confirmation without requiring Skills focus
   - refusal behavior when the selected agent has no unmanaged skills

2. Action dispatcher tests
   - bulk adopt calls `runAdopt({ agent })` without `skill`
   - success reloads and reports trimmed command output

3. Component tests
   - footer/help text exposes `Shift+A`
   - bulk confirm dialog copy is explicit and user-facing

4. PTY lifecycle scenario
   - a fixture with one agent and multiple unmanaged skills
   - one `Shift+A` confirmation adopts all of them
   - real filesystem assertions confirm they become managed links

## Non-Goals

This slice intentionally does not:

- invent a cross-agent bulk adopt action
- merge bulk adopt into the alternate-screen/fullscreen runtime slice
- change the existing `a` / `r` / `Space` contract
- redesign panel focus or list ordering

## Output

The durable outputs of this slice are:

- updated TUI interaction semantics for current-agent bulk adopt
- regression coverage for reducer, dispatcher, components, and PTY flow
- synchronized tracking in `AGENTS.md`, `PROJECT_STATUS.md`, `NEXT_ACTIONS.md`, and `DECISIONS.md`
- a follow-up implementation plan for this slice

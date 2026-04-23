Date: 2026-04-23
Status: Approved in design review, pending written-spec review

# SkillMux TUI CLI Parity Design

## Purpose

The current TUI covers the core lifecycle loop for already-known agents and skills, but it still falls short of the CLI surface in several important places.

The missing gap is no longer just polish. It blocks full TUI-based management because users still need to drop back to the CLI for configuration and setup tasks such as:

- `config add-agent`
- `config update-agent`
- `config remove-agent`
- `import`
- `doctor`

This slice makes the TUI a complete local-management entrypoint by covering the current CLI management surface inside the fullscreen dashboard.

## User Goals

The accepted user goals for this slice are:

1. A user should be able to add, edit, and remove custom managed agents without leaving the TUI.
2. A user should be able to import a local skill into SkillMux-managed storage from the TUI.
3. A user should be able to run doctor diagnostics from the TUI and review the results there.
4. The TUI should stay keyboard-first and fullscreen, not bounce out into separate prompt flows or shell commands.
5. The TUI should reuse the same lifecycle and validation rules as the CLI instead of creating a second behavioral model.

## Scope

This slice covers:

- TUI entrypoints for `config add-agent`, `config update-agent`, `config remove-agent`, `import`, and `doctor`
- direct keyboard shortcuts for those actions
- modal forms for add, edit, and import
- modal confirmation for remove-agent
- a read-only diagnostic modal or page for doctor results
- reducer, action-dispatch, component, and PTY coverage for the new workflows

This slice does not cover:

- a command palette or alternate command-mode UI
- remote skill installation or update behavior
- redesigning the existing dashboard information architecture
- replacing the underlying CLI command helpers
- new host-terminal automation outside SkillMux's own TUI

## Interaction Model

New actions are entered directly through keyboard shortcuts instead of a command palette.

Accepted shortcuts:

- `n` opens `Add Agent`
- `e` opens `Edit Agent` for the selected agent
- `X` opens `Remove Agent` for the selected agent
- `i` opens `Import Skill`
- `d` opens `Doctor`

The current dashboard remains visible behind the modal, but modal state traps input until it closes.

The interaction split is:

- form modals for add, edit, and import
- confirmation modal for remove-agent
- read-only diagnostic modal for doctor

This preserves the current dashboard mental model while keeping setup and configuration work inside the same fullscreen TUI session.

## Form Model

This slice uses single-page modal forms, not a multi-step wizard.

That choice is intentional:

- it matches the full CLI parameter surface more directly
- it is faster for repeated edits to existing agent overrides
- it keeps field visibility high, so users can review the whole payload before submitting

Form navigation contract:

- `Up` / `Down` move between fields
- text fields accept direct typed input
- `Space` toggles boolean fields and multi-select platform options
- `Enter` submits only when the form's submit row is focused
- `Esc` closes the modal; if the form is dirty, the TUI asks for confirmation before discarding edits

The new form layer does not reuse `Tab` as focus navigation. The accepted dashboard interaction already moved panel focus to left/right arrows, and this slice keeps that contract stable.

## Field Coverage

The TUI should fully match the current CLI parameter surface for these operations.

`Add Agent` fields:

- `id` required
- `root` required
- `skills` required, defaulting to `skills`
- `name` optional
- `platforms[]` multi-select
- `disabledByDefault` boolean

`Edit Agent` fields:

- `id` is the selected target and is not edited in-place
- `root`
- `skills`
- `name`
- `platforms[]`
- `enabledByDefault`
- `disabledByDefault`

For edit, `enabledByDefault` and `disabledByDefault` remain logically equivalent to the CLI flags, but the form should represent them as a mutually exclusive state so the user cannot submit both at once.

`Remove Agent`:

- targets the selected agent only
- uses an explicit confirmation modal

`Import Skill` fields:

- `source`
- `name`

`Doctor`:

- no user form fields
- renders read-only diagnostic results

## Command Reuse And Architecture

The TUI should not create a second implementation of these features.

It should reuse the existing command helpers:

- `runConfigAddAgent`
- `runConfigUpdateAgent`
- `runConfigRemoveAgent`
- `runImport`
- `runDoctor`

The TUI remains an orchestration layer over accepted CLI semantics:

- the command helpers stay the source of truth for normalization, validation, and write behavior
- the TUI owns input collection, modal state, busy state, reload flow, and user-facing error presentation

Expected architectural changes:

- `state.ts`
  - new modal variants for add, edit, import, remove-agent, doctor, and dirty-discard confirmation
  - new reducer events for opening forms, editing fields, submitting, confirming discard, and scrolling doctor results
- `actions.ts`
  - new TUI action variants that wrap the existing CLI command helpers
- `app.tsx`
  - keyboard routing for the new shortcuts
  - submit and modal-close behavior
- `components/`
  - shared form-modal rendering
  - remove-agent confirmation
  - doctor result view

The existing dashboard layout remains the underlying shell for these overlays.

## Validation And Error Handling

The TUI should use a two-stage validation model.

First stage: lightweight local validation before submit

- required fields must be present
- the edit form cannot represent both enabled-by-default and disabled-by-default simultaneously
- obvious malformed local state should be blocked in-form before dispatch

Second stage: command-layer validation

- path normalization, id normalization, platform normalization, source layout checks, and config mutation rules stay in the existing CLI helpers
- failures from command helpers keep the modal open and surface a short, actionable error summary

Behavioral rules:

- `e` and `X` require a selected editable custom agent override; built-in or non-overridden agents refuse with a short status message
- `n`, `i`, and `d` are globally available
- successful write actions close the modal, reload the dashboard, and show one-line status text
- successful doctor runs do not mutate dashboard state; they only refresh the diagnostic modal content
- reload failures after a successful write follow the current stable-model rollback approach instead of leaving the dashboard in a misleading empty state

## Doctor Presentation

`doctor` belongs in the TUI, but not as raw CLI text pasted into the dashboard.

The TUI should call the structured `runDoctor()` result and render:

- issue severity
- issue code
- path when present
- user-facing message

Expected behavior:

- empty result shows `No doctor issues found.`
- the doctor view is read-only
- it supports vertical scrolling with `j` / `k` and arrow keys
- it sits outside the normal dashboard focus cycle

This keeps diagnostics inside the TUI while preserving the dashboard's main navigation model.

## State Restoration And Selection Behavior

Successful actions should return the user to a meaningful dashboard state.

- after `add-agent`, the new agent becomes selected
- after `update-agent`, the edited agent remains selected
- after `remove-agent`, selection falls back to a neighboring visible agent
- after `import`, the dashboard reloads and reports the imported managed skill clearly even if the current agent view does not immediately show it
- after closing doctor, the prior agent and skill selection stay intact

This slice should not silently reset the dashboard to a generic first-row state after modal-driven work.

## Test Strategy

This slice should extend the existing TUI coverage at four levels.

1. Reducer/state tests
   - shortcut availability and refusal states
   - modal open/close behavior
   - field edits, dirty-state handling, and submit intent behavior

2. Action dispatcher tests
   - add/update/remove/import/doctor dispatch through the existing command helpers
   - command outputs and failures map to short status text and the expected reload rules

3. Component tests
   - form layout and field copy
   - footer/help discoverability for the new shortcuts
   - remove-agent confirmation and doctor rendering behavior

4. PTY scenarios
   - add custom agent through the real TUI
   - edit the custom agent and observe the persisted result
   - remove the custom agent through confirmation
   - import a local skill from a temporary sandbox path
   - open doctor and verify visible issue rendering or empty-state rendering

The PTY layer remains the main behavioral acceptance path because these changes are interaction-heavy and modal-driven.

## Non-Goals

This slice intentionally does not:

- add a command palette
- replace the existing three-panel dashboard
- implement remote install/update flows
- change the accepted key contracts for lifecycle actions such as `Space`, `a`, `r`, `Shift+A`, `s`, `/`, `?`, and `q`
- redefine CLI command semantics

## Output

The durable outputs of this slice are:

- a TUI surface that covers the current local-management CLI features
- direct-key modal workflows for add/edit/remove agent, import, and doctor
- regression coverage for reducer, dispatcher, components, and PTY scenarios
- synchronized tracking in `AGENTS.md`, `PROJECT_STATUS.md`, `NEXT_ACTIONS.md`, and `DECISIONS.md`
- a follow-up implementation plan for this slice

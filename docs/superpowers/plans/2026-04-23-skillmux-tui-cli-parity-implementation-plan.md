# SkillMux TUI CLI Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the current local-management CLI surface into `skillmux tui` so users can add/update/remove agent overrides, import local skills, and run doctor diagnostics without leaving the fullscreen TUI.

**Architecture:** Keep the existing dashboard agent-first and implement parity as a modal workflow layer on top of it. The dashboard model exposes enough agent metadata to know when edit/remove are allowed, the reducer owns modal/form/doctor state plus payload-bearing submit intents, and the action layer reuses the existing CLI command helpers instead of reimplementing validation or filesystem rules.

**Tech Stack:** TypeScript, Ink, Vitest, existing SkillMux TUI reducer/action architecture, existing command helpers in `src/commands/`, existing PTY explorer harness in `tests/tui-e2e/`

---

## Required Skills During Implementation

- Use `$terminal-ui` before changing modal layout, keyboard input handling, or footer/help behavior.
- Use `superpowers:test-driven-development` before each code task.
- Use `superpowers:systematic-debugging` if modal input, doctor loading, or PTY flows behave unexpectedly.
- Use `superpowers:verification-before-completion` before accepting each task or commit.

## Planned File Structure

### Dashboard Metadata And Reducer Contract

- Modify: `src/tui/dashboard-model.ts`
- Modify: `src/tui/load-dashboard-state.ts`
- Modify: `src/tui/state.ts`

### Workflow Payloads And Action Dispatch

- Create: `src/tui/forms.ts`
- Modify: `src/tui/actions.ts`

### App And Presentational Components

- Modify: `src/tui/app.tsx`
- Modify: `src/tui/components/Dashboard.tsx`
- Modify: `src/tui/components/Footer.tsx`
- Modify: `src/tui/components/HelpOverlay.tsx`
- Create: `src/tui/components/FormDialog.tsx`
- Create: `src/tui/components/DoctorDialog.tsx`

### Tests

- Modify: `tests/tui/dashboard-model.test.ts`
- Modify: `tests/tui/state.test.ts`
- Modify: `tests/tui/actions.test.ts`
- Modify: `tests/tui/components.test.tsx`
- Modify: `tests/tui-e2e/sandbox.ts`
- Modify: `tests/tui-e2e/explorer.ts`
- Create: `tests/tui-e2e/scenarios/agent-config-flow.test.ts`
- Create: `tests/tui-e2e/scenarios/import-doctor-flow.test.ts`

### Tracking Docs

- Modify: `AGENTS.md`
- Modify: `PROJECT_STATUS.md`
- Modify: `NEXT_ACTIONS.md`
- Modify: `DECISIONS.md`
- Modify: `docs/superpowers/plans/2026-04-23-skillmux-tui-cli-parity-implementation-plan.md`

## Task 1: Add Dashboard Metadata And Reducer Scaffolding For Parity Workflows

**Files:**
- Modify: `src/tui/dashboard-model.ts`
- Modify: `src/tui/load-dashboard-state.ts`
- Modify: `src/tui/state.ts`
- Modify: `tests/tui/dashboard-model.test.ts`
- Modify: `tests/tui/state.test.ts`

- [ ] **Step 1: Write the failing dashboard-model tests**

Extend `tests/tui/dashboard-model.test.ts` with focused cases for:

- the selected agent row exposing whether it has a user override
- built-in agents without a user override staying non-editable/non-removable
- custom agents created from config staying editable/removable

Use a targeted row assertion such as:

```ts
expect(model.agents.find((row) => row.id === "codex")).toEqual(
  expect.objectContaining({
    id: "codex",
    hasUserOverride: true,
    canEditOverride: true,
    canRemoveOverride: true
  })
);
```

- [ ] **Step 2: Write the failing reducer tests**

Extend `tests/tui/state.test.ts` with focused cases for:

- `getAvailableActions()` exposing new global actions:
  - `addAgent`
  - `editAgent`
  - `removeAgent`
  - `importSkill`
  - `doctor`
- `editAgent` / `removeAgent` only becoming available when the selected agent has a user override
- new modal open events for:
  - add agent
  - edit agent
  - remove agent
  - import
  - doctor
- refusal status text when `e` or `X` is requested for an agent without a user override

Target assertions:

```ts
expect(getAvailableActions(withOverrideAgent)).toEqual(
  expect.objectContaining({
    addAgent: true,
    editAgent: true,
    removeAgent: true,
    importSkill: true,
    doctor: true
  })
);
```

```ts
expect(updateTuiState(withBuiltinOnlyAgent, { type: "open-edit-agent" }).statusMessage).toBe(
  "Select an agent override first"
);
```

- [ ] **Step 3: Run the targeted tests to verify the red state**

Run:

```powershell
npm test -- --run tests/tui/dashboard-model.test.ts tests/tui/state.test.ts
```

Expected: FAIL because the dashboard model and reducer do not yet expose override metadata, modal variants, or the new action-availability flags.

- [ ] **Step 4: Extend the dashboard model with agent override metadata**

Update `src/tui/dashboard-model.ts` and `src/tui/load-dashboard-state.ts` so the dashboard model receives enough config context to distinguish:

- a built-in agent with no user override
- a built-in agent with a user override
- a custom configured agent

Add explicit agent-row fields:

```ts
hasUserOverride: boolean;
canEditOverride: boolean;
canRemoveOverride: boolean;
```

`loadDashboardState()` should load user config once and pass the configured agent ids into `buildDashboardModel()` instead of forcing the reducer to infer editability from list text.

- [ ] **Step 5: Extend reducer state for parity workflow entrypoints**

Update `src/tui/state.ts` so it adds:

- new modal kinds for:
  - add agent form
  - edit agent form
  - remove agent confirm
  - import form
  - doctor view
  - discard-dirty-form confirm
- new reducer events for opening those modals
- new `TuiAvailableActions` booleans:

```ts
addAgent: boolean;
editAgent: boolean;
removeAgent: boolean;
importSkill: boolean;
doctor: boolean;
```

Reducer rules:

- `n`, `i`, and `d` are always available when the dashboard is not busy and no modal is open
- `e` and `X` require `selectedAgent.hasUserOverride === true`
- background dashboard input remains blocked while a modal is open
- this task only opens workflow shells; it does not yet implement field editing or submit payloads

- [ ] **Step 6: Run targeted verification**

Run:

```powershell
npm test -- --run tests/tui/dashboard-model.test.ts tests/tui/state.test.ts
```

Expected: PASS.

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit Task 1**

```powershell
git add src/tui/dashboard-model.ts src/tui/load-dashboard-state.ts src/tui/state.ts tests/tui/dashboard-model.test.ts tests/tui/state.test.ts
git commit -m "feat: add tui parity workflow scaffolding"
```

## Task 2: Add Form Payloads And Command Dispatcher Support

**Files:**
- Create: `src/tui/forms.ts`
- Modify: `src/tui/state.ts`
- Modify: `src/tui/actions.ts`
- Modify: `tests/tui/state.test.ts`
- Modify: `tests/tui/actions.test.ts`

- [ ] **Step 1: Write the failing reducer and action tests**

Extend `tests/tui/state.test.ts` with cases for:

- field updates inside add/edit/import forms
- dirty-form tracking
- submit intents carrying a payload instead of only a bare action string
- mutual exclusion for edit-form `enabledByDefault` vs `disabledByDefault`
- doctor modal loading/result transitions

Extend `tests/tui/actions.test.ts` with focused cases for:

- `config-add-agent` calling `runConfigAddAgent()` with the exact normalized form payload
- `config-update-agent` calling `runConfigUpdateAgent()`
- `config-remove-agent` calling `runConfigRemoveAgent()`
- `import-skill` calling `runImport()`
- `doctor` calling `runDoctor()`
- successful write commands reloading the dashboard and preserving/setting the expected selected agent
- doctor returning structured issue data without forcing a dashboard reload

Target dispatcher assertions:

```ts
expect(services.runConfigAddAgent).toHaveBeenCalledWith({
  homeDir: undefined,
  skillmuxHome: undefined,
  id: "openclaw",
  root: ".openclaw",
  skills: "skills",
  name: "OpenClaw",
  platforms: ["win32"],
  disabledByDefault: false
});
```

```ts
expect(result.doctorReport?.issues).toEqual([
  expect.objectContaining({ code: "broken-link", severity: "error" })
]);
```

- [ ] **Step 2: Run the targeted tests to verify the red state**

Run:

```powershell
npm test -- --run tests/tui/state.test.ts tests/tui/actions.test.ts
```

Expected: FAIL because there is no form-state helper, no payload-bearing submit intent, and no dispatcher support for the parity commands.

- [ ] **Step 3: Add focused form-state helpers**

Create `src/tui/forms.ts` with small, explicit helpers for:

- add-agent form state
- edit-agent form state
- import form state
- field-level updates
- lightweight pre-submit validation
- conversion from form state to command-helper input

Keep these helpers deterministic and serializable. They should not read the filesystem or call command helpers directly.

Suggested exported shapes:

```ts
export type AddAgentFormState = { ... };
export type EditAgentFormState = { ... };
export type ImportSkillFormState = { ... };
export function buildAddAgentForm(): AddAgentFormState;
export function buildEditAgentForm(agent: TuiAgentRow): EditAgentFormState;
export function validateAddAgentForm(form: AddAgentFormState): string | null;
```

- [ ] **Step 4: Upgrade reducer submit intents from bare actions to payload-bearing commands**

Update `src/tui/state.ts` so form submit no longer relies on `pendingAction: TuiAction | null`.

Introduce a payload-bearing pending command union such as:

```ts
type TuiPendingCommand =
  | { kind: "config-add-agent"; input: RunConfigAddAgentOptions }
  | { kind: "config-update-agent"; input: RunConfigUpdateAgentOptions }
  | { kind: "config-remove-agent"; input: RunConfigRemoveAgentOptions }
  | { kind: "import-skill"; input: RunImportOptions }
  | { kind: "doctor" };
```

Reducer rules:

- add/edit/import submit validates locally first
- local validation failures stay inside the modal and show a short form error
- successful local validation stages a pending command
- `Esc` on a dirty form opens discard confirmation instead of dropping the modal immediately
- doctor modal can enter `loading`, `ready`, and `error` states

- [ ] **Step 5: Extend the dispatcher for parity commands**

Update `src/tui/actions.ts` so it adds service methods for:

- `runConfigAddAgent`
- `runConfigUpdateAgent`
- `runConfigRemoveAgent`
- `runImport`
- `runDoctor`

Extend the dispatcher result shape so it can return either:

- a reloaded dashboard model plus status text for write actions
- a structured doctor report plus status text for diagnostics

The write-path contract should remain thin:

- command helper is called with the staged payload
- successful writes trim trailing newlines in status text
- successful writes reload the dashboard through `loadDashboardState()`
- add-agent should reload with the new agent selected
- update-agent should reload with the edited agent selected
- remove-agent should reload with `selectedAgentId` cleared so the loader can choose a neighboring visible agent
- import should reload the current dashboard model and keep status text user-facing

- [ ] **Step 6: Run targeted verification**

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

- [ ] **Step 7: Commit Task 2**

```powershell
git add src/tui/forms.ts src/tui/state.ts src/tui/actions.ts tests/tui/state.test.ts tests/tui/actions.test.ts
git commit -m "feat: add tui parity command payloads"
```

## Task 3: Implement Modal UI, Keyboard Wiring, And Doctor Presentation

**Files:**
- Modify: `src/tui/app.tsx`
- Modify: `src/tui/components/Dashboard.tsx`
- Modify: `src/tui/components/Footer.tsx`
- Modify: `src/tui/components/HelpOverlay.tsx`
- Create: `src/tui/components/FormDialog.tsx`
- Create: `src/tui/components/DoctorDialog.tsx`
- Modify: `tests/tui/components.test.tsx`

- [ ] **Step 1: Write the failing component and app tests**

Extend `tests/tui/components.test.tsx` with focused cases for:

- footer showing the new shortcuts when actionable:
  - `[n]add agent`
  - `[e]edit agent`
  - `[X]remove agent`
  - `[i]import`
  - `[d]doctor`
- help overlay teaching the new shortcut contract
- add/edit/import forms rendering the expected field labels
- remove-agent confirmation rendering selected-agent-specific copy
- doctor dialog rendering loading, empty, issue-list, and error states
- `App` routing:
  - `n` opens add-agent
  - `e` opens edit-agent only when the selected agent has an override
  - `X` opens remove-agent confirm only when the selected agent has an override
  - `i` opens import
  - `d` opens doctor and then populates it asynchronously

Target render assertions:

```ts
expect(frame).toContain("[n]add agent");
expect(frame).toContain("[e]edit agent");
expect(frame).toContain("[X]remove agent");
expect(frame).toContain("[i]import");
expect(frame).toContain("[d]doctor");
```

```ts
expect(frame).toContain("Source path");
expect(frame).toContain("Skill name");
```

- [ ] **Step 2: Run the targeted component test to verify the red state**

Run:

```powershell
npm test -- --run tests/tui/components.test.tsx
```

Expected: FAIL because the app, overlay routing, and modal components do not yet support the parity workflows.

- [ ] **Step 3: Implement dedicated form and doctor dialogs**

Create `src/tui/components/FormDialog.tsx` for add/edit/import workflows and `src/tui/components/DoctorDialog.tsx` for doctor results.

UI contract:

- form dialogs are large centered overlays inside the alternate-screen dashboard
- text content uses normal Ink `Text` components
- boolean and multi-select fields use explicit visible state, not color alone
- doctor dialog supports vertical scrolling and empty-state messaging
- no new focus path is added to the base dashboard while a modal is open

- [ ] **Step 4: Wire app keyboard handling and modal submit flow**

Update `src/tui/app.tsx`, `Dashboard.tsx`, `Footer.tsx`, and `HelpOverlay.tsx` so:

- normal-mode keys `n`, `e`, `X`, `i`, `d` route into reducer events
- modal-mode keys route to:
  - field movement
  - text entry
  - boolean/platform toggles
  - submit
  - discard confirm
  - doctor scrolling
- modal submission dispatches the payload-bearing pending command from Task 2
- write actions close the modal before entering busy state
- doctor stays open and swaps from loading to ready/error content after the async result returns
- footer/help remain concise and only expose currently meaningful shortcuts

- [ ] **Step 5: Run targeted verification**

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

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```powershell
git add src/tui/app.tsx src/tui/components/Dashboard.tsx src/tui/components/Footer.tsx src/tui/components/HelpOverlay.tsx src/tui/components/FormDialog.tsx src/tui/components/DoctorDialog.tsx tests/tui/components.test.tsx
git commit -m "feat: add tui parity modal workflows"
```

## Task 4: Prove Real PTY Agent Config, Import, And Doctor Flows

**Files:**
- Modify: `tests/tui-e2e/sandbox.ts`
- Modify: `tests/tui-e2e/explorer.ts`
- Create: `tests/tui-e2e/scenarios/agent-config-flow.test.ts`
- Create: `tests/tui-e2e/scenarios/import-doctor-flow.test.ts`

- [ ] **Step 1: Write the failing PTY scenarios**

Create `tests/tui-e2e/scenarios/agent-config-flow.test.ts` with one real flow that:

- starts from a clean temporary home
- opens add-agent with `n`
- creates a new custom agent override such as `openclaw`
- verifies the new agent becomes visible/selectable
- opens edit-agent with `e`
- changes one field such as `name` or `skills`
- opens remove-agent with `X`
- confirms removal and verifies the override is gone

Create `tests/tui-e2e/scenarios/import-doctor-flow.test.ts` with one real flow that:

- prepares a temporary local skill source directory with a root `SKILL.md`
- opens import with `i`
- imports the local skill
- verifies the managed store contains the imported skill
- opens doctor with `d`
- asserts either the empty-state string or a visible issue row, depending on the seeded sandbox

Use real side-effect assertions such as:

```ts
await expect(explorer.fs.exists(explorer.paths.managedSkill("find-skills"))).resolves.toBe(true);
await explorer.waitForText("No doctor issues found.");
```

- [ ] **Step 2: Extend PTY sandbox and explorer helpers only as needed**

Update `tests/tui-e2e/sandbox.ts` to add narrow helpers for:

- writing `~/.skillmux/config.json`
- creating a local import-source directory with `SKILL.md`

Update `tests/tui-e2e/explorer.ts` with thin helpers for the new workflows, for example:

```ts
openAddAgent(): Promise<void>;
openEditAgent(): Promise<void>;
openRemoveAgent(): Promise<void>;
openImport(): Promise<void>;
openDoctor(): Promise<void>;
typeText(value: string): Promise<void>;
submitForm(): Promise<void>;
toggleOption(): Promise<void>;
```

Do not add high-level helpers that hide the actual modal interaction entirely. The scenarios should still read like a user driving the TUI.

- [ ] **Step 3: Run the targeted PTY scenarios to verify the red state**

Run:

```powershell
npm test -- --run tests/tui-e2e/scenarios/agent-config-flow.test.ts tests/tui-e2e/scenarios/import-doctor-flow.test.ts
```

Expected: FAIL until the real modal UI and async command flow work end to end.

- [ ] **Step 4: Fix any PTY-only gaps exposed by the scenarios**

Keep fixes narrow. Likely PTY-only issues include:

- modal input focus not matching reducer state
- async doctor loading not waiting for visible content
- import status text or reload timing racing the assertions
- remove-agent selection fallback needing one extra readiness wait

Do not mix unrelated PTY polish into this slice.

- [ ] **Step 5: Run focused PTY verification**

Run:

```powershell
npm test -- --run tests/tui-e2e/scenarios/agent-config-flow.test.ts tests/tui-e2e/scenarios/import-doctor-flow.test.ts
```

Expected: PASS.

Run:

```powershell
npm run test:tui-e2e
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```powershell
git add tests/tui-e2e/sandbox.ts tests/tui-e2e/explorer.ts tests/tui-e2e/scenarios/agent-config-flow.test.ts tests/tui-e2e/scenarios/import-doctor-flow.test.ts
git commit -m "test: cover tui cli parity flows"
```

## Task 5: Final Tracking Sync And Root Verification

**Files:**
- Modify: `AGENTS.md`
- Modify: `PROJECT_STATUS.md`
- Modify: `NEXT_ACTIONS.md`
- Modify: `DECISIONS.md`
- Modify: `docs/superpowers/plans/2026-04-23-skillmux-tui-cli-parity-implementation-plan.md`

- [ ] **Step 1: Update tracking docs as each task lands**

Record:

- the accepted shortcut contract for `n`, `e`, `X`, `i`, and `d`
- the accepted dashboard metadata rule for override editability
- the accepted modal/form/doctor architecture
- the root commit for each accepted task
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
git add AGENTS.md PROJECT_STATUS.md NEXT_ACTIONS.md DECISIONS.md docs/superpowers/plans/2026-04-23-skillmux-tui-cli-parity-implementation-plan.md
git commit -m "docs: record tui cli parity plan progress"
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

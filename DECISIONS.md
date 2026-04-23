# DECISIONS.md

Record key product and implementation decisions so later sessions do not lose the reasoning.

## 2026-04-16

### TUI design process

- The TUI work starts only after the CLI lifecycle surface is complete and published as `skillmux@0.1.2`.
- The design phase must use `$using-superpowers` and `$tui-design`.
- The implementation phase must additionally use `$terminal-ui`.
- The brainstorming hard gate applies: no TUI implementation starts until the design is approved, written as a spec, and reviewed.
- The TUI should reuse the existing command helper functions where possible, rather than duplicating the local filesystem and manifest rules.
- Browser visual companion files are stored under `.superpowers/brainstorm/`, which is ignored by git.
- The first TUI version should prioritize a daily management dashboard over a wizard-first or doctor-first experience.
- The default dashboard should be agent-first: users choose an agent, then manage visible, disabled, unmanaged, or problematic skills for that agent.
- First-version TUI action safety model: `Space` toggles enable/disable for the focused managed skill and reports in the status bar; `a` adopts and `r` removes, both with explicit confirmation because they change ownership or delete managed local copies.
- Enabled/disabled state must not rely on color alone: enabled rows use a filled circle plus text/state, disabled rows use a hollow circle plus text/state, and color only reinforces the marker.
- The right detail panel should not duplicate action shortcuts already shown in the footer. It should explain the selected item and show contextual messages, while the footer remains the single place for shortcut discovery.
- First-version TUI layout uses a persistent multi-panel dashboard: left agents, center skills for the selected agent, right detail/action context.
- Because the browser visual companion is not accessible in this environment, TUI design review continues through terminal text instead of browser mockups.
- The accepted TUI design spec is `docs/superpowers/specs/2026-04-16-skillmux-tui-design.md`.
- Initial TUI launch must use a read-only dashboard loader. It must not call `runScan` or a helper that writes manifest state unless the user explicitly presses `s`.
- For the selected agent, the Skills panel lists every manifest-managed skill; rows without an enabled activation for that agent appear disabled and can be enabled with `Space`.
- Spec review passed after those two points were clarified, and the user approved the written spec.
- The TUI implementation plan is `docs/superpowers/plans/2026-04-16-skillmux-tui-implementation-plan.md`.
- Implementation planning chooses Ink and React for the dashboard, with a new read-only manifest snapshot path because existing `readManifest`, `runList`, and `runScan` can write manifest state.
- The TUI implementation plan review passed. Recommended execution mode remains subagent-driven development, one accepted slice at a time.

### TUI Task 1 sandbox debugging note

- During Task 1, a temporary Vitest preload workaround was tried to diagnose Windows sandbox `EPERM` failures in this environment.
- That workaround was removed after review; the project now uses the normal `vitest run --configLoader runner` test script and the Vitest config only includes the requested `.test.ts` / `.test.tsx` patterns.
- The remaining `spawn EPERM` issue belongs to the sandbox/runtime environment, not to the checked-in TUI command shell.

### TUI Task 2 read-only manifest loading

- The TUI initial-load path needs a manifest reader that does not bootstrap or write `manifest.json`.
- `readManifestSnapshot` returns an empty in-memory manifest when the manifest file is absent and reports `exists: false`; it does not create the file.
- Manifest validation messages are shared with `readManifest` so the read-only path stays actionable and consistent.
- Doctor issue collection is now reusable through `collectDoctorIssues`, while `runDoctor` still combines live scan issues with doctor-derived issues before formatting output.

### TUI Task 3 read-only dashboard state

- `loadDashboardState` is the TUI initial state loader and stays read-only: it uses `readManifestSnapshot`, `discoverAgents`, `scanAgentSkills`, and `collectDoctorIssues`, then builds a dashboard model without calling `runScan`, `runList`, `runDoctor`, `readManifest`, or `writeManifest`.
- The dashboard model is agent-first. Managed skills are listed for the selected agent even when disabled; a row is enabled only when that selected agent has an enabled activation.
- Skill row markers use UTF-8 symbols in the model: `●` for enabled, `○` for disabled, `?` for unmanaged/adoptable entries, and `!` for issues. Later Ink components may add color, but color is only reinforcement.
- Path-related issues attach to every related agent, including shared-path conflict issues. Issues without a path remain global and do not appear in individual agent skill lists.
- The Task 3 model currently uses `selectedSkillId` as a selected row id for unmanaged and issue rows. Task 4 action dispatch must resolve the selected row first and then use `row.skillId` or `row.skillName`, not pass `selectedSkillId` directly to command helpers.

### TUI Task 4 action dispatch

- `dispatchTuiAction` is model-driven. It resolves the selected row from `DashboardModel.skills` using `DashboardModel.selectedSkillId`; callers do not pass a separate selected skill row.
- Toggle maps only managed rows to lifecycle commands: enabled rows call `runDisable`, and disabled rows call `runEnable`.
- Adopt maps only unmanaged rows to `runAdopt` and uses `row.skillName`; remove maps only disabled managed rows to `runRemove` and uses `row.skillId`.
- Scan is explicit and writes through `runScan`; initial TUI loading remains read-only.
- Successful actions reload dashboard state with the previous selected agent and selected row id. Failed actions keep the previous model and return one-line status text without stack traces.
- Task 4 root acceptance required full root verification after sync, not just the worktree targeted test.

### TUI Task 5 pure state reducer

- TUI state is pure and Ink-independent. `state.ts` owns focus, cursors, search state, modal state, busy/status state, and reducer intents.
- Row actions are only available while the Skills panel has focus. `Space` maps to a pending `toggle` action only for managed enabled/disabled rows; `a` and `r` open confirmations only for unmanaged and disabled managed rows.
- Confirmation/help modals trap background reducer events. The modal UI in Task 6 should render confirm/cancel behavior separately.
- `getAvailableActions` is the footer contract. It hides row/global actions while a modal is open or work is busy, so Task 6 should not duplicate availability rules in components.
- `DashboardModel.skills` remains current-agent-only. Agent navigation or agent search changes `model.selectedAgentId` and records `pendingAgentId`; Task 6 must consume that intent and reload dashboard state for the selected agent.

### TUI Task 6 Ink dashboard

- Task 6 should keep filesystem reads and writes inside `App` services/actions. Presentational components receive state-derived view data and callbacks only.
- The detail panel should describe the selected row and paths, but footer shortcuts remain the single action list to avoid duplicate action guidance.
- Agent selection changes must consume the Task 5 pending agent intent and reload dashboard state for that agent, because `DashboardModel.skills` is scoped to the selected agent.
- `Dashboard` owns the minimum terminal fallback and renders exactly `Terminal too small. Resize to at least 80x24.` when either dimension is below the supported size.
- `Footer` derives shortcut visibility from `getAvailableActions`; components do not duplicate the reducer's availability rules.
- `App` uses injected services for tests, loads through `loadDashboardState` on mount, and dispatches only confirmed or reducer-intended actions through `dispatchTuiAction`.
- `App`, not `Dashboard`, owns terminal dimension defaults from `process.stdout`; `Dashboard` receives explicit dimensions and remains presentational.
- Modal rendering hides the normal footer shortcut list because modal input only accepts `y`, `Esc`, and quit handling; confirmation dialogs keep their own `[y] confirm   [Esc] cancel` prompt.
- `StatusLine` shows explicit busy messages such as `working...` or `loading agent...`; it falls back to `scanning...` only when busy has no status message.
- Confirmed adopt/remove actions close the modal before entering busy state, and `App` guards the active action request so a repeated `y` cannot launch duplicate writes while the first write is pending.
- `App` uses monotonically increasing request ids for action and agent reload promises. Only the latest request may apply its result, so stale loads/actions cannot overwrite newer dashboard state.
- Search mode handles printable input before normal-mode quit handling. `q` edits the search query, while Ctrl+C remains a global exit.
- When no agent is selected, visible skills are empty. The reducer must not expose stale current-agent rows as if they were global skills.
- Task 5 worktree acceptance required spec re-review, code-quality re-review, `git diff --check`, full tests, typecheck, and build before root sync.
- Task 5 root acceptance required fresh root verification after sync with `git diff --check`, `npm test`, `npm run typecheck`, and `npm run build`.

## 2026-04-12

### Product scope

- `v0` is CLI only
- distribution is npm-first
- `v0` manages only already-local skills
- `v0` directly modifies the local environment

### Discovery and storage model

- agent discovery uses built-in rules plus user config overrides
- SkillMux storage is anchored at `<user-home>/.skillmux`
- agent directories are always resolved from the user home, not from `skillmuxHome`
- real skill content should be gathered into SkillMux-managed storage

### Command surface for `v0`

- the first command set is:
  - `scan`
  - `list`
  - `import`
  - `enable`
  - `disable`
  - `agents`
  - `doctor`
  - `config`

### Manifest and persistence

- manifest validation is strict at the schema layer
- `readManifest` rejects `skillmuxHome` drift
- manifest writes use unique temp files before rename

### Filesystem safety

- path containment checks must handle Windows drive boundaries explicitly
- filesystem writes must reject symlink or junction ancestors
- SkillMux only removes links, never normal directories, during disable/remove-style flows
- copying into managed storage rejects symlink entries inside the source skill

### Task 6 scan/list behavior

- scan classifies entries into:
  - `managed-link`
  - `unmanaged-directory`
  - `broken-link`
  - `unknown`
- links that point outside the managed store are treated as `unknown`
- broken links are reported as scan issues
- `list` is a live scan projection in `v0`; it does not depend on a separately persisted entry table

### Task 7 import behavior

- `import` is conservative in `v0`
- importing copies source content into `<skillmux-home>/skills/<skill-id>` and leaves the source path untouched
- import requires a root `SKILL.md` in the source directory before copying
- import refuses to overwrite an existing managed skill for the same `skillId`

### Task 8 activation behavior

- `enable` and `disable` are idempotent for one `skillId` and one `agentId`
- activation state is persisted in `manifest.activations` instead of being inferred only from the live filesystem
- `disable` only removes a link when that path points to the exact managed skill target
- `enable` may replace a broken link at the target path before recreating the managed link

### Task 9 doctor and config behavior

- `doctor` is a read-only inspection command in `v0`; it does not rewrite the manifest or mutate agent directories
- unmanaged directories are only promoted to doctor issues when they look like real skills by containing a top-level `SKILL.md`
- user config validation errors should name the resolved config path and normalize malformed JSON into a typed config-validation failure
- conflicting agent path detection is based on the resolved absolute skills directory path, not only agent ids

### Task 10 CLI completion behavior

- the real executable entrypoint must use `parseAsync`, not `parse`, because the command handlers are async
- `v0` must expose `agents` and `import` on the public CLI surface, not just as internal command helpers
- the end-to-end acceptance test for `v0` is one temporary-environment flow that proves one managed skill can be imported, linked into two agents, disabled for one agent, and then diagnosed safely

## 2026-04-13

### README positioning

- `README.md` should be written as a user manual, not as an internal engineering note
- the README should speak to both humans and AI agents that may receive the repository link as setup context
- the README should focus on purpose, target users, installation, commands, and usage flow
- internal phase labels, roadmap language, and version-development framing do not belong in the README

### Follow-up list behavior

- `list --view agents` should include discovered agents even when they currently have zero live skill entries
- `list --view skills` should include managed skills from the manifest even when they are currently disabled everywhere
- `list` may enrich the live scan projection with manifest state for agent/skill-oriented views without changing `records` view semantics

### Real-world CLI bugfixes

- `~/.skillmux/config.json` should accept UTF-8 BOM-prefixed JSON because PowerShell and some editors may emit it by default on Windows
- first-time `disable --skill <name> --agent <id>` should be able to adopt an existing external skill link into SkillMux management instead of forcing the user to import, manually delete the old link, and then retry
- auto-adoption during `disable` is currently limited to existing linked skill entries with a valid root `SKILL.md`; this keeps the behavior safe while matching the real-world `skills.sh` symlink/junction case

### Custom agent config writes

- the first config mutation command is `skillmux config add-agent`
- `config add-agent` writes a normalized `~/.skillmux/config.json` instead of trying to preserve arbitrary user formatting
- `config add-agent` requires `--root` and `--skills` to stay relative; absolute paths and `..` escapes are rejected
- `config add-agent` defaults `--skills` to `skills` and defaults `--platform` to the current platform
- re-running `config add-agent` for the same agent id overwrites only that one override and preserves the other configured agents
- `config remove-agent` is the matching removal command for custom agent overrides
- `config remove-agent` removes only the selected agent override from `~/.skillmux/config.json`
- `config remove-agent` does not delete manifest state, managed skills, or any local symlink/junction entries

### Release versioning

- the post-`config remove-agent` release is published as `skillmux@0.1.1`
- additive CLI features that remain backward-compatible should use a patch version bump unless a larger packaging change justifies otherwise

### Product boundary with `npx skills`

- SkillMux should not reimplement remote fetching, remote source discovery, or remote update logic from `skills.sh`
- `npx skills` remains the standard tool for installing skills from remote repositories
- SkillMux owns the local-management layer after installation:
  - discover locally present skills
  - adopt them into managed storage when needed
  - control visibility per agent
  - report local drift and local breakage
- future work should focus on making SkillMux cooperate cleanly with `npx skills`, not on replacing it with a second installer

### CLI lifecycle-closure order

- the next major CLI phase should close the lifecycle in this order:
  1. `remove skill`
  2. adopt already-installed skills
  3. `config` command-family expansion
  4. batch operations
- TUI should wait until those command semantics are stable
- the ordering is intentional:
  - `remove` closes the lifecycle endpoint first
  - `adopt` closes the handoff from `npx skills`
  - `config` and batch work should build on the stable lifecycle rules instead of inventing them

### Lifecycle-closure execution

- implementation uses the approved lifecycle-closure spec and plan from `docs/superpowers/`
- development work starts in `.worktrees/lifecycle-closure` on branch `lifecycle-closure`
- the root repository remains the stable delivery area; worktree code is accepted only after synchronization and fresh root verification
- the worktree baseline passed `npm test`, `npm run typecheck`, and `npm run build` before Task 1 implementation started
- on this Windows environment, Vitest and tsup may require elevated execution because sandboxing can block child process spawning with `EPERM`

### Remove command safety

- `skillmux remove` does not support `--force` in the initial lifecycle-closure implementation
- removal is allowed only when no activation for the target skill is still `enabled`
- removal refuses manifest paths that do not exactly match `<skillmuxHome>/skills/<skill-id>`
- removal refuses symlink/junction leaf paths and symlink/junction ancestors before any recursive delete
- if the managed skill directory is already absent but the skill is disabled everywhere, removal may still clean the manifest skill and activation records
- removing by direct skill id is deterministic; removing by display name rejects ambiguous normalized-name matches
- lifecycle-closure Task 1 was accepted only after worktree review and fresh root verification; the accepted root commit is `c12d1e3`

### Adopt command execution

- lifecycle-closure Task 2 starts from accepted root commit `8173a49` in `.worktrees/lifecycle-adopt` on branch `lifecycle-adopt`
- `skillmux adopt` should remain a one-agent command in this slice; cross-agent and multi-skill batch orchestration belongs to the later batch task
- adoption should treat only linked or directory entries with a root `SKILL.md` as eligible, then copy real content into `<skillmuxHome>/skills/<skill-id>` and replace the live agent entry with a SkillMux-managed link when needed
- already-managed entries should be skipped cleanly instead of rewritten unnecessarily
- adopted managed links should also reconcile manifest activation state so live managed links do not remain invisible or disabled in persisted state
- adoption validates existing managed targets before replacing a working external live entry; stale manifest targets fail before link replacement
- multi-entry `adopt --agent <agent>` persists each completed adoption or reconciliation before continuing, reducing the partial-failure window without adding a transaction journal
- lifecycle-closure Task 2 was accepted only after worktree implementation, spec review, code-quality re-review, and fresh root verification; the accepted root commit is `3f3c2ee`

### Config update-agent execution

- lifecycle-closure Task 3 starts from root commit `eb412cf` in `.worktrees/lifecycle-config-update` on branch `lifecycle-config-update`
- `skillmux config update-agent` should remain a narrow custom-agent override updater, not a generic config editor
- updates should target one existing override, preserve unspecified fields, and reuse the same id/path/platform validation rules as `config add-agent`
- `config update-agent` exposes only existing override fields from `config add-agent`: `name`, `root`, `skills`, repeated `platform`, and enabled-by-default state toggles
- updating a missing custom agent override is a config validation error instead of silently creating a new override; creation remains owned by `config add-agent`
- shared custom-agent validation now lives in `src/config/agent-override-validation.ts` so `config add-agent` and `config update-agent` do not depend on each other as sibling command modules
- lifecycle-closure Task 3 was accepted only after worktree implementation, spec review, code-quality re-review, and fresh root verification; the accepted root commit is `a645ade`

### Batch operations execution

- lifecycle-closure Task 4 starts from root commit `b233442` in `.worktrees/lifecycle-batch` on branch `lifecycle-batch`
- batch operations should be thin orchestration over the already accepted single-item commands, not a parallel command model
- initial batch shapes are intentionally constrained to avoid ambiguous mixed modes:
  - enable or disable one skill for multiple agents
  - adopt multiple skills under one agent
  - remove multiple disabled skills
- accepted state requires subagent implementation, spec review, code-quality review, sync back to the root repo, and fresh root verification
- lifecycle-closure Task 4 was accepted only after worktree implementation, spec review, code-quality re-review, and fresh root verification; the accepted root commit is `6fcaef7`
- batch CLI flags are repeatable where they map to a supported batch shape, while existing single-item usage remains supported
- batch partial failures throw `BatchOperationError` with the operation, failed item, completed item ids, and original cause; this avoids implying rollback when earlier single-item operations have already persisted

### Final lifecycle documentation execution

- lifecycle-closure Task 5 starts from root commit `476ef72` in `.worktrees/lifecycle-release-docs` on branch `lifecycle-release-docs`
- Task 5 is documentation and release readiness only; it should not change command semantics unless verification exposes a release-blocking bug
- README updates should document the now-existing lifecycle UX: `remove`, `adopt`, `config update-agent`, the `npx skills`/SkillMux boundary, and the supported batch shapes
- accepted state still requires documentation review, sync back to the root repo, and fresh root verification

### Lifecycle README command semantics

- The README should describe `npx skills` as the remote fetch/install path and SkillMux as the local adoption and visibility-management path
- `skillmux adopt --agent <agent>` is the handoff command for already-installed local skills; adding repeated `--skill` values narrows adoption to selected skills under that one agent
- `skillmux remove --skill <skill>` is a managed-store cleanup command, not a remote uninstall command; it refuses skills that are still enabled for any agent
- `skillmux config update-agent` updates existing custom overrides only; `config add-agent` remains the creation path
- README batch examples should stay limited to accepted shapes:
  - enable or disable one skill across multiple agents
  - adopt multiple skills under one agent
  - remove multiple disabled managed skills
- Release-readiness documentation may mention verification results, but it must not claim an npm publish unless publish actually happens
- Task 5 was accepted in root commit `64a0d42` after worktree review, README revision based on user feedback, sync to the root checkout, and fresh root verification with `npm test`, `npm run typecheck`, and `npm run build`
- `.worktrees/lifecycle-release-docs` was removed after root acceptance; the repository is back to root-only accepted state

### Post-lifecycle npm release

- The post-lifecycle release should publish the completed lifecycle CLI surface after final verification.
- npm registry check on 2026-04-16 showed `skillmux@0.1.1` as the latest published version, with versions `0.1.0` and `0.1.1` present.
- The release target is `skillmux@0.1.2` because the lifecycle work adds backward-compatible CLI functionality.
- `npm publish` is an external release action and must wait for explicit user approval after local verification and dry-run packaging pass.
- Release prep is isolated in `.worktrees/post-lifecycle-release` from root commit `75cf4d0`.
- Baseline release-prep verification passed with `npm test`, `npm run typecheck`, and `npm run build` before the `0.1.2` metadata bump.
- Final release-prep verification passed with `git diff --check`, `npm test`, `npm run typecheck`, `npm run build`, and `npm pack --dry-run`; the dry-run tarball filename was `skillmux-0.1.2.tgz`.
- Release prep was accepted in root commit `0f72701` and `.worktrees/post-lifecycle-release` was removed after root verification.
- `skillmux@0.1.2` was published to npm on 2026-04-16 after explicit user approval.
- The first publish attempt failed before login with npm auth errors; the successful publish used a temporary npm userconfig and deleted it after publish.
- npm registry verification after publish returned `0.1.2`.

### TUI Task 6 App input gating

- While an App-level mutating action request is active, normal dashboard inputs that can navigate, search, open actions, or reload agents are ignored.
- `Ctrl+C` remains a global exit route, and `q` still exits from normal or modal state during an active action.
- This conservative Task 6 behavior prevents an agent reload from becoming the latest async request and clearing busy state while the original filesystem write is still running.
- Task 6 worktree acceptance required spec re-review, code-quality re-review, `git diff --check`, targeted TUI tests, full `npm test`, `npm run typecheck`, and `npm run build` before root sync.
- Task 6 was accepted in the root repo at commit `88a5ee2` after fresh root verification with `git diff --check`, `npm test`, `npm run typecheck`, and `npm run build`.
- Task 7 launch wiring should stay minimal: `launchTui` renders `<App {...options} />` with only `homeDir` and `skillmuxHome`, and Commander help should exit before any TUI action runs.
- The default `skillmux tui` launcher must be lazy-loaded from `src/commands/tui.ts`; top-level `Ink`/`App` loading in the shared CLI path is a regression.
- Task 7 worktree acceptance requires both launch behavior coverage and lazy-loading coverage so future non-TUI commands do not accidentally import Ink/App.
- Task 7 root acceptance requires the same full root verification gate as earlier TUI slices before moving to Task 8 documentation and manual checks.
- Source-level dynamic import is not enough if the ESM bundle is flattened; `tsup` splitting must stay enabled so Ink/App live in the launch chunk instead of the shared CLI entry.

### TUI Task 7 launch connection

- `skillmux tui` should keep the command-level interactive terminal guard before Ink starts.
- The real launcher should be a narrow adapter: render `<App {...options} />` with Ink and await `waitUntilExit()`.
- CLI help for `skillmux tui --help` must remain non-mutating and must not launch the dashboard; Commander help exits before the action handler.
- This round prioritizes `gpt-5.4-mini` subagents to conserve quota, with escalation only if review or debugging needs exceed the model.
- TUI Task 8 should keep the README as a user manual, not a status report. The new `skillmux tui` section should explain the dashboard and the fallback commands in plain user-facing language.
- The action key map is part of the user contract: `Space` toggles the selected managed skill, `a` adopts after confirmation, `r` removes after confirmation, `s` refreshes, `/` searches the focused list, `?` opens help, and `q` exits.
- The docs-only Task 8 slice must not claim verification or release completion until those steps actually run.
- Release readiness checks should treat non-interactive `skillmux tui` as a user-facing CLI path, not just a unit-test path. It should write the existing friendly terminal requirement message, set exit code 1, and avoid surfacing a Node stack trace; unexpected TUI errors should still propagate.

## 2026-04-19

### TUI usability follow-up

- Manual user review identified a focused usability pass that should happen before treating the TUI as visually settled.
- The dashboard should feel like a full-terminal workspace that reads like the current terminal session has been taken over, rather than a small inner block.
- Focus switching should move to left/right arrows, and the Detail pane should leave the focus cycle because it has no direct interaction.
- The selected agent must stay clearly highlighted even while the Skills panel has focus.
- User-facing list chrome should be simplified by removing noisy `E0` / `D1` counters, while keeping status icons and explaining them clearly in footer/help text.
- This follow-up is a polish slice on top of the accepted TUI architecture, not a redesign of lifecycle behavior or command semantics.
- The applied follow-up keeps the existing three-panel layout but makes the root dashboard consume the full provided terminal width and height so the session reads like an active terminal workspace.
- The footer and help overlay are now part of the user contract for icon discovery: they explain agent status icons and skill markers instead of removing the symbols entirely.
- Confirm dialogs should expose a shared exported height constant so dashboard overlay budgeting stays aligned with the dialog's actual rendered height.

## 2026-04-21

### TUI PTY exploration harness

- The next TUI design slice is not more component tests. It is a new PTY-driven exploration harness that can drive `skillmux tui` like a real user.
- The testing target is terminal semantics only. Windows Terminal or PowerShell desktop automation is out of scope for the first version because it adds host-terminal noise without helping validate SkillMux's own behavior.
- The first version should prioritize scriptable exploratory sessions over strict snapshot-only regression gates. The agent needs to use the TUI, notice UX problems, and then turn the important findings into stable scenarios.
- Mutating TUI actions such as `toggle`, `adopt`, `remove`, and `scan` should execute for real, but only inside a fresh temporary sandbox that contains test-only home, agent, and SkillMux-store paths.
- Exploration artifacts must include both structured event logs and named screen snapshots, plus filesystem checks for mutating flows.
- The approved written spec for this slice is `docs/superpowers/specs/2026-04-21-skillmux-tui-pty-exploration-design.md`.
- The implementation plan for this slice is `docs/superpowers/plans/2026-04-21-skillmux-tui-pty-exploration-implementation-plan.md`.
- Because this repo does not currently include a TypeScript script runner such as `tsx`, the implementation plan uses a small Node `.mjs` runner that builds first and then launches the PTY scenarios through Vitest.
- Implementation execution mode for this slice is subagent-driven development.
- On the current Windows PowerShell + Vitest setup, passing `tests/tui-e2e/**/*.test.ts` through `npm test -- --run` does not match any tests. The accepted regression runner enumerates concrete `.test.ts` files under `tests/tui-e2e/` instead of relying on that literal glob.
- PTY exploration Task 1 is intentionally a bootstrap red slice: the smoke scenario and regression runner are expected to fail on missing `fixtures.ts` / `explorer.ts` until later tasks land those modules.
- PTY exploration Task 2 hardens artifacts at the file-writer boundary: artifact scenario roots and snapshot names must stay within `.artifacts/tui-e2e/`, blank scenario names are invalid, and each scenario run clears only its own directory before writing fresh outputs.
- PTY exploration Task 3 drives the real built CLI through `node-pty` and uses the screen/artifact primitives directly before any higher-level explorer wrapper exists.
- On this Windows PTY harness path, the spawned TUI environment must include a terminal type. The accepted default is `TERM=xterm-256color` when the parent process does not already provide `TERM`, because without it the harness can spawn `skillmux tui` and still see no rendered dashboard output.
- The real PTY smoke fixture must write a manifest with a concrete `agents.codex` record, not just an activation for `codex`, because `readManifestSnapshot` validates activation agent references before the dashboard loader can render.
- PTY exploration Task 4 introduces a dedicated sandbox/fixture layer on top of the existing temp-home helpers. That layer owns managed-store scaffolding, agent skills directories, and declarative scenario setup for future explorer and lifecycle scenarios.
- Scenario fixtures must fail fast on malformed declarations: every referenced agent must appear in `input.agents`, and duplicate or conflicting `(agentId, skillName)` declarations across enabled/disabled/unmanaged inputs are rejected at fixture-construction time instead of surfacing later as PTY startup failures.
- Accepted Task 4 fixtures write typed manifests through the real `writeManifest` helper and default `lastScan.at` to `null`; an exploratory or regression scenario must opt into a completed scan explicitly rather than inheriting a fake scan timestamp.
- PTY exploration Task 5 adds a high-level explorer wrapper on top of the raw PTY session instead of pushing every scenario down to escape sequences. The wrapper owns key mapping, common waits, path helpers, and lightweight filesystem probes for managed and agent skill paths.
- Task 5 lifecycle scenarios must synchronize on the rendered confirm dialog before sending `y`; relying on immediate modal state after `a` or `r` is too racy for the Windows PTY path.
- The repo-local PTY explorer lock exists to serialize real TUI sessions in this Windows environment, and stale or corrupt `owner.json` metadata must be treated as recoverable rather than wedging later runs.
- PTY serialization belongs at the real session layer, not the explorer wrapper. `createPtySession` must own the repo-local PTY lock so direct callers such as the smoke scenario serialize correctly while mocked explorer unit tests stay lock-free.
- A timed-out PTY `close()` must keep the PTY lock held and leave the session retryable. Releasing the lock before exit is confirmed reopens the race this harness is trying to prevent.
- Under the full Windows suite, the serialized PTY queue can legitimately exceed 15 seconds. The PTY session lock budget is therefore 30000 ms, slow async tests such as `tui-lazy-loading` declare explicit larger per-test budgets instead of relying on Vitest's default 5-second timeout, and the real PTY scenarios use explicit 10000 ms initial-ready waits instead of depending on the harness default.

### TUI PTY audit and polish

- The PTY harness is complete enough to become the primary product-audit tool for `skillmux tui`; the next slice is product polish, not more test scaffolding.
- Audit rounds should scan four areas together: interaction/keys/focus, layout/information density, state feedback, and terminal compatibility/exit behavior.
- Each round should fix only the highest-priority findings from that audit pass, then stop for a compact-ready handoff instead of growing into an unbounded polish branch.
- PTY exploratory artifacts under `.artifacts/tui-e2e/` are diagnostic evidence for this slice, while lasting protection should come from targeted PTY scenarios or the narrowest focused regression tests that cover the repaired behavior.
- Round 1 focused on first-screen readability. The accepted changes rewrote footer/help legend copy into short dedicated lines instead of one long sentence that wrapped badly at the 80x24 baseline.
- Round 1 also tightened focused TUI and PTY smoke coverage around the user's requested circle markers (`●` enabled, `○` disabled) so later polish work does not silently drift away from that contract.
- Round 2 focused on Detail-pane density. The accepted change compresses managed store and agent-link paths into one-line tail summaries with shorter `Store` / `Link` labels so the first screen stays readable under real PTY snapshots.
- Round 3 focused on default agent-list noise. Missing built-in agents should not appear on the first screen just because the shared SkillMux store can theoretically enable a managed skill for them later.
- The accepted Round 3 relevance rule is: show a built-in agent by default when it is present locally, has activation history, has unmanaged entries, has issues, or is currently selected. Explicit agent search still searches the full discovered-agent set.
- Round 4 focused on search interaction and feedback. Empty-result search states must describe the filter result, not pretend the dashboard has no data.
- Search close semantics are now split intentionally: `Esc` cancels search and restores the pre-search selection, while `Enter` commits the currently filtered selection and exits search mode.
- Round 5 focused on pending agent reload feedback. When the selected agent has changed but the async reload for that agent has not returned yet, the dashboard should render loading placeholders instead of misleading empty-state copy.
- Round 6 focused on pending agent reload failure handling. When an agent reload rejects, the dashboard must fall back to the last successfully loaded model instead of leaving the newly selected agent on a misleading empty state.
- Round 7 focused on empty-result search submission. When search has no visible results, pressing `Enter` must restore the previous stable selection instead of committing an empty agent or skill selection.

## 2026-04-22

### TUI alternate screen and fullscreen runtime

- The next TUI runtime/layout slice is not more PTY audit polish. It is a direct product change so `skillmux tui` behaves like a real fullscreen terminal application.
- `skillmux tui` should enter the terminal alternate screen by default in interactive use.
- Exiting the TUI must restore the previous main screen and cursor state so the dashboard does not remain printed in the shell history view.
- The dashboard layout should become responsive to live terminal width and height instead of relying on fixed column widths.
- The supported floor remains `80x24`, but that size is only the lower bound. Below it, the TUI should show a fullscreen resize prompt instead of squeezing the normal dashboard.
- Help and confirmation overlays remain part of the current interaction model; this slice changes runtime/layout semantics, not the keyboard contract.
- The user-requested one-key "adopt all unmanaged skills" action is accepted as a later slice and is intentionally not coupled to the alternate-screen/fullscreen runtime change.
- The partially explored PTY audit/polish Round 8 search-cancel debugging thread is paused. Any uncommitted WIP from that thread should be resumed or discarded deliberately, not mixed accidentally into this new slice.
- The written implementation plan for this slice is `docs/superpowers/plans/2026-04-22-skillmux-tui-alternate-screen-responsive-layout-implementation-plan.md`.
- The execution order for this slice is: alternate-screen session lifecycle first, responsive fullscreen layout second, PTY resize/restore verification third, and final repo verification plus tracking last.
- Execution mode for this slice is subagent-driven development.
- Alternate-screen/fullscreen Task 1 acceptance used an isolated worktree first because the root repo still held paused Round 8 WIP in `src/tui/app.tsx`, `src/tui/components/Dashboard.tsx`, `src/tui/state.ts`, `tests/tui-e2e/scenarios/usability-probes.test.ts`, and `tests/tui/state.test.ts`.
- The accepted Task 1 runtime contract is:
  - enter alternate screen on interactive launch
  - hide the cursor while the TUI is active
  - always attempt trace exit, alternate-screen restore, and cursor restore during teardown
  - preserve the original startup/render failure over later cleanup failures
- The PTY smoke proof for Task 1 should not depend only on the raw Windows `node-pty` exit code. Accepted proof requires explicit trace markers for `alt-screen-enter`, `session-exit-clean`, and `alt-screen-exit`, plus an exit event and residue checks after the exit boundary.
- For the Windows PTY harness, post-exit trace data can arrive after the process exit event. `tests/tui-e2e/pty-session.ts` therefore drains pending output after exit before final snapshot/event inspection.
- Alternate-screen/fullscreen Task 2 implementation also started in the isolated `tui-alt-screen-task2` worktree because the root repo still held paused Round 8 WIP touching `Dashboard.tsx`.
- The accepted Task 2 responsive layout contract is:
  - pane widths use ratios `26% / 30% / 44%` with minimum guards `20 / 24 / 28`
  - total pane widths always sum back to the current terminal width
  - the Detail pane absorbs the width delta so Agents and Skills remain usable as the terminal narrows
  - below `80x24`, the fallback renders in a full-screen centered `Box`, not as an inline text row inside the dashboard
- Root sync for Task 2 was done by manually porting the accepted worktree delta into `main` rather than cherry-picking blindly, because the paused root WIP still marked `src/tui/components/Dashboard.tsx` as modified.
- Alternate-screen/fullscreen Task 3 implementation started in isolated worktree `.worktrees/tui-alt-screen-task3` because the paused Round 8 root WIP still touched `src/tui/app.tsx` and `tests/tui-e2e/scenarios/usability-probes.test.ts`.
- The accepted Task 3 PTY contract is:
  - a wider PTY resize keeps the fullscreen dashboard active
  - `80x24` still renders the supported dashboard layout
  - `79x24` replaces the dashboard with the fullscreen resize prompt
  - both `q` and Ctrl+C must restore the session cleanly in PTY capture
- On the current Windows `node-pty` path, live child-process resize dimensions are not observable through `process.stdout.columns`, `getWindowSize()`, or `resize` events inside the child. PTY resize verification therefore uses a narrow test-only size bridge file injected through `SKILLMUX_TUI_PTY_SIZE_FILE`.
- The bridged-size runtime path is only for PTY verification. The normal interactive runtime still reads terminal dimensions from the live process TTY.
- The bridged-size reader keeps the last known good width/height if a bridge-file rewrite is transiently malformed, which avoids false `null` fallbacks during PTY resize races.
- Task 3 also adds a launch-boundary `SIGINT` handler so Ctrl+C unmounts Ink before alternate-screen and cursor restoration run, preserving the Task 1 cleanup contract on that exit path too.
- Task 4 root acceptance for this slice requires a fresh full-repository gate from `main`: `npm run build`, `npm run test:tui-e2e`, `npm test`, `npm run typecheck`, and `git diff --check`.
- After that gate passed, the alternate-screen/fullscreen slice was considered complete in root. The next product slice is the later one-key unmanaged-skill adoption request, still separate from the paused Round 8 search-cancel WIP.
- A later review of the remaining root Round 8 residue in `src/tui/state.ts` and `tests/tui/state.test.ts` found no logic delta against `HEAD`; the files only differed by mixed line endings, so that residue was discarded instead of resumed or committed.

## 2026-04-23

### TUI bulk adopt for current agent

- The later one-key unmanaged-skill adoption request is now narrowed to the current selected agent only; there is no cross-agent bulk adopt mode in this slice.
- The accepted shortcut is `Shift+A`, not lowercase `a`, so the existing single-row adopt contract remains intact.
- Lowercase `a` continues to mean "adopt the selected unmanaged row"; uppercase `A` means "adopt all unmanaged skills for the current selected agent".
- The TUI should not invent a new filesystem or lifecycle implementation for this feature. Bulk adopt reuses the existing CLI helper contract by calling `runAdopt({ agent })` with no `skill`.
- The bulk action is dashboard-level, not row-level. The Skills list should not gain a synthetic "adopt all" item.
- The bulk action may be triggered from either Agents focus or Skills focus, as long as the selected agent currently has unmanaged skills.
- The written implementation plan for this slice is `docs/superpowers/plans/2026-04-23-skillmux-tui-adopt-all-unmanaged-agent-skills-implementation-plan.md`.
- The implementation plan keeps the slice narrow: reducer/dispatcher contract first, then app/footer/help/confirm integration, then one focused PTY flow, then final root verification and tracking sync.
- Execution mode for this slice is subagent-driven development with one fresh worktree-backed implementer per task and review gates before root acceptance.
- Accepted Task 1 root commit: `6c6811b` (`feat: add tui bulk adopt action contract`).
- Task 1 locks in the reducer/dispatcher contract:
  - `TuiAvailableActions.adoptAll` is a required boolean, not an optional field
  - `request-adopt-all` opens `confirm-adopt-all` for the selected agent even when focus is on Agents
  - `adopt-all` reuses `runAdopt({ agent })` with no `skill`
  - missing-agent and zero-unmanaged states stay on short user-facing refusals instead of throwing

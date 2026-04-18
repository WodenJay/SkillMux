# PROJECT_STATUS.md

Project: SkillMux
Phase: TUI implementation in progress
Stable area: `C:\Users\wudon\Desktop\SkillMux\`
Canonical worktree: `(none)`
Active development worktree: `C:\Users\wudon\Desktop\SkillMux\.worktrees\tui-implementation`

## Current TUI Design Status

- TUI design has started after the completed `skillmux@0.1.2` CLI lifecycle release.
- Design followed `$using-superpowers` and the brainstorming hard gate; the written spec is approved.
- The TUI design stage is using `$tui-design`; implementation will additionally use `$terminal-ui`.
- A browser visual companion was attempted, but it is not usable in the current environment; design review continues in terminal text.
- The existing CLI command helpers expose `runX` functions, so the likely TUI direction is to reuse the current command layer instead of duplicating filesystem behavior.
- First-version TUI scope preference: daily management dashboard for agents, skills, enablement state, issue count, and keyboard-driven lifecycle actions.
- Primary dashboard axis: agent-first. The default view should help users inspect and manage what one selected agent can see.
- Mutating action preference: selected skill enable/disable is toggled with `Space` and status feedback; `adopt` and `remove` stay on `a` and `r` with confirmation.
- Skill rows should show a status marker before the skill name: filled green circle for enabled, hollow circle for disabled, and distinct text/symbol labels for unmanaged or issue states.
- Detail panel should not repeat the global footer actions; it should focus on metadata, state explanation, source paths, and issue/adoption guidance.
- TUI design sections 1-5 are approved.
- TUI design spec has been written and committed at `docs/superpowers/specs/2026-04-16-skillmux-tui-design.md`.
- Spec review passed after clarifying read-only initial loading and disabled-row population.
- User approved the written design spec.
- TUI implementation plan has been drafted at `docs/superpowers/plans/2026-04-16-skillmux-tui-implementation-plan.md`.
- TUI implementation plan review passed.
- Execution mode selected by the user: subagent-driven development.
- Selected first-version layout: persistent multi-panel dashboard with agents, selected-agent skills, and detail/action context visible together.
- Task 1 is accepted in the root repo after implementation, spec review, code-quality re-review, root sync, full tests, typecheck, and build.
- TUI Task 1 accepted root code commit: `f4f0f3f`.
- Task 1 scope: dependencies, TSX config, CLI shell, launcher stub, TTY guard, and command tests.
- Targeted and full TUI Task 1 test verification required elevated execution in this Windows sandbox because ordinary sandbox execution hit `spawn EPERM`; elevated verification passed.
- Task 2 is accepted in the active TUI worktree after implementation, spec review, code-quality re-review, targeted tests, and typecheck.
- Task 2 is accepted in the root repo after sync and fresh root verification.
- TUI Task 2 accepted root code commit: `9953695`.
- Task 2 scope: read-only manifest snapshot loading and shared doctor issue collection.
- Task 3 is accepted in the root repo after sync and fresh root verification.
- TUI Task 3 accepted root commit: `0fd9422`.
- Task 3 scope: read-only dashboard model and loader for agents, managed rows, unmanaged rows, issue rows, and selection/count state.
- Task 4 is accepted in the root repo after sync and fresh root verification.
- TUI Task 4 accepted root commit: `d443df2`.
- Task 4 scope: row-driven TUI action dispatcher for toggle, adopt, remove, scan, command-output status text, reloads, and failure preservation.
- Task 5 is accepted in the root repo after implementation, spec re-review, code-quality re-review, root sync, full root tests, typecheck, build, and diff check.
- TUI Task 5 accepted root commit: `5f8e2f4`.
- Task 5 scope: pure TUI reducer state, focus/navigation/search behavior, help/adopt/remove modal state, action availability selectors, pending action intent, and pending agent selection intent for Task 6 reload wiring.
- Task 6 scope: Ink dashboard components, modal/status/footer presentation, and App keyboard wiring over the Task 5 reducer/action intents.
- TUI Task 6 is accepted in the root repo at commit `88a5ee2` after spec re-review, code-quality re-review, root sync, `git diff --check`, full root tests, typecheck, and build.
- Task 6 adds Ink dashboard components plus App keyboard handling for navigation, search, help, confirmations, toggles, scan intent, pending-agent reloads, and guarded mutating action flow.
- Next implementation slice: TUI Task 7, real Ink launch wiring and end-to-end command behavior.
- Remaining plan slices are still pending.
- Task 7 current slice: write failing launch/help tests, connect `launchTui` to real `ink.render`, then run targeted and full verification in the worktree before root sync.
- Task 7 worktree implementation is complete and verified with targeted tests, the CLI smoke slice, `npm run typecheck`, and `npm run build`; root sync and fresh root verification remain.
- Post-review follow-up: fix lazy loading for the default TUI launcher so non-TUI command paths and help text do not eagerly load Ink/App.

## Accepted Tasks

- Task 1: bootstrap CLI workspace
- Task 2: define manifest schema and domain types
- Task 3: add manifest persistence
- Task 4: add agent discovery and config loading
- Task 5: add filesystem safety and link helpers
- Task 6: add scan and list commands
- Task 7: add managed skill import
- Task 8: add enable and disable commands
- Task 9: add doctor and config commands
- Task 10: complete the managed CLI flow and packaging
- Lifecycle Closure Task 1: add safe managed skill removal
- Lifecycle Closure Task 2: add adoption flow for installed skills
- Lifecycle Closure Task 3: add config update-agent command
- Lifecycle Closure Task 4: add batch lifecycle operations
- Lifecycle Closure Task 5: final documentation and release readiness
- Post-lifecycle release prep: prepare `skillmux@0.1.2`
- Post-lifecycle npm publish: publish `skillmux@0.1.2`
- TUI Task 1: add dependencies, TSX test coverage, `skillmux tui` command shell, launcher stub, and non-interactive TTY guard
- TUI Task 2: add read-only manifest snapshot loading and shared doctor diagnostics
- TUI Task 3: add read-only dashboard model and loader
- TUI Task 4: add row-driven TUI action dispatcher
- TUI Task 5: add pure TUI state, navigation, search, modal, and action intent reducer
- TUI Task 6: render Ink dashboard components and wire App keyboard handling

## Accepted Root Commits

- `2f88f26` `chore: bootstrap skillmux cli workspace`
- `cc7fc7f` `feat: define manifest schema and domain types`
- `228cc24` `feat: add manifest persistence`
- `abaf9c6` `feat: add agent discovery and config loading`
- `84ea69c` `feat: add filesystem safety and link helpers`
- `2abe430` `feat: add scan and list commands`
- `2ce2f04` `feat: add managed skill import`
- `49a6d02` `feat: add enable and disable commands`
- `55f8d3a` `feat: add doctor and config commands`
- `61b3ed1` `feat: complete skillmux v0 managed cli flow`
- `c12d1e3` `feat: add managed skill removal`
- `3f3c2ee` `feat: add adoption flow for installed skills`
- `a645ade` `feat: add config update-agent command`
- `6fcaef7` `feat: add batch lifecycle operations`
- `64a0d42` `docs: record lifecycle closure updates`
- `0f72701` `chore: prepare skillmux 0.1.2 release`
- `f4f0f3f` `docs: record tui task 1 acceptance`
- `9953695` `docs: record tui task 2 acceptance`
- `0fd9422` `docs: record tui task 3 acceptance`
- `d443df2` `docs: record tui task 4 acceptance`
- `5f8e2f4` `docs: record tui task 5 acceptance`

## Current Product Direction

- CLI first, no GUI in `v0`
- npm distribution
- target platforms: Windows, Linux, macOS
- `v0` manages only already-local skills
- SkillMux does not own remote install or update flows; `npx skills` remains the install entrypoint
- `v0` directly modifies the local environment
- agent discovery uses built-in rules plus user config overrides
- real skill content should be gathered into SkillMux-managed storage

## Task 10 Outcome

- Added `tests/e2e/managed-flow.test.ts` to verify the full `scan -> import -> enable -> list -> disable -> doctor` flow in one temporary environment
- Exposed the missing CLI surfaces:
  - `skillmux agents`
  - `skillmux import --source <path> --name <name>`
- Added `runAgents` for a live discovery view of supported agent directories
- Switched the CLI entrypoint to `parseAsync` so async command failures propagate correctly from the real executable entrypoint
- Added the first project `README.md` covering install/build, command usage, SkillMux home layout, and safe-usage notes

## Latest Verification

Task 10 passed fresh in the root repo with:

- `npm test`
- `npm run typecheck`
- `npm run build`
- `npm publish --dry-run`

## Release Status

- `skillmux@0.1.1` has been published to npm
- `skillmux@0.1.2` has been published to npm
- package name on npm: `skillmux`
- latest publish was verified with `npm view skillmux version` returning `0.1.2`
- `README.md` has been rewritten as a user-facing and AI-friendly manual
- the README now focuses on purpose, audience, installation, commands, and usage flow instead of internal version framing
- the published package now includes:
  - `skillmux config remove-agent`
  - the README logo and centered README header polish

## Post-Lifecycle Release Prep

- Target package: `skillmux@0.1.2`
- Local package metadata has been bumped in `package.json` and `package-lock.json`.
- Final root verification passed with `git diff --check`, `npm test`, `npm run typecheck`, `npm run build`, and `npm pack --dry-run`.
- The dry-run package was `skillmux@0.1.2` / `skillmux-0.1.2.tgz`.
- npm registry check before publish on 2026-04-16 showed latest published version `0.1.1`.
- `npm publish` completed for `skillmux@0.1.2` on 2026-04-16.
- npm registry verification after publish returned `0.1.2`.
- The temporary npm userconfig used for publish was deleted after publish.

## Lifecycle Closure Release-Docs Status

- Status: accepted in the root repo; `.worktrees/lifecycle-release-docs` has been removed
- Scope: documentation and release readiness only; command semantics were not changed
- README now documents the completed lifecycle surface:
  - `skillmux adopt --agent <agent> [--skill <skill>]`
  - `skillmux remove --skill <skill>`
  - `skillmux config update-agent --id <agent>`
  - supported repeatable-flag batch shapes
  - the boundary where `npx skills` fetches remote skills and SkillMux manages local installed skills
- Release readiness note: final worktree and root verification passed with `npm test`, `npm run typecheck`, and `npm run build`; npm publish has not been performed for this task.

## Current Lifecycle Status

- lifecycle-closure implementation is using the approved docs:
  - spec: `docs/superpowers/specs/2026-04-13-skillmux-cli-lifecycle-closure-design.md`
  - plan: `docs/superpowers/plans/2026-04-13-skillmux-cli-lifecycle-closure-implementation-plan.md`
- Lifecycle Closure Tasks 1-5 are accepted in the root repo.
- Task 5 accepted root commit: `64a0d42` `docs: record lifecycle closure updates`.
- Task 5 worktree and root verification passed with `npm test`, `npm run typecheck`, and `npm run build`.
- The repository is back to root-only accepted state.
- Post-lifecycle npm release prep was opened after accepted root commit `73cb496`; active preparation uses the worktree recorded below.
- npm registry check on 2026-04-16 showed published versions `0.1.0` and `0.1.1`; the next compatible release target is `0.1.2`.
- Actual `npm publish` has been run for the post-lifecycle release.
- Release-prep worktree `.worktrees/post-lifecycle-release` was created from root commit `75cf4d0` and has been removed after root acceptance.
- Release target: `skillmux@0.1.2`.
- Release-prep baseline passed with `npm test`, `npm run typecheck`, and `npm run build`.
- Release-prep final worktree and root verification passed with `git diff --check`, `npm test`, `npm run typecheck`, `npm run build`, and `npm pack --dry-run`; dry-run package was `skillmux@0.1.2` / `skillmux-0.1.2.tgz`.
- Release-prep accepted root commit: `0f72701` `chore: prepare skillmux 0.1.2 release`.
- `npm publish` has been run for `skillmux@0.1.2`; npm registry verification returned `0.1.2`.
- lifecycle-closure Task 1 is accepted in the root repo:
  - command added: `skillmux remove --skill <skill> [--json]`
  - safety behavior: refuses enabled skills, refuses non-canonical managed paths, refuses symlink/junction leaf or ancestor removal paths, and removes disabled manifest state only after checks
  - root verification passed with `npm test -- --run tests/commands/remove.test.ts`, `npm test`, `npm run typecheck`, and `npm run build`
  - accepted root commit: `c12d1e3` `feat: add managed skill removal`
  - stale implementation worktree `.worktrees/lifecycle-closure` has been removed after root acceptance
  - next implementation slice: first-class `skillmux adopt --agent <agent> [--skill <skill>]`
- lifecycle-closure Task 2 has started from the accepted root commit `8173a49`:
  - active branch/worktree: `lifecycle-adopt` at `.worktrees/lifecycle-adopt`
  - target command: `skillmux adopt --agent <agent> [--skill <skill>]`
  - baseline verification in the worktree passed with `npm test`, `npm run typecheck`, and `npm run build`
  - implementation will follow superpowers subagent-driven development with spec and code-quality review before root acceptance
- lifecycle-closure Task 2 is accepted in the root repo:
  - command added: `skillmux adopt --agent <agent> [--skill <skill>] [--json]`
  - behavior: adopts one agent's eligible unmanaged links/directories with root `SKILL.md`, copies real content into SkillMux managed storage, replaces live entries with managed links, records imported provenance, and reconciles already-managed links into enabled manifest activations
  - safety behavior: validates managed targets before replacing live entries and persists each completed adoption/reconciliation before moving to later entries
  - root verification passed with `npm test -- --run tests/commands/adopt.test.ts`, `npm test`, `npm run typecheck`, and `npm run build`
  - accepted root commit: `3f3c2ee` `feat: add adoption flow for installed skills`
  - stale implementation worktree `.worktrees/lifecycle-adopt` has been removed after root acceptance
  - next implementation slice: `skillmux config update-agent`
- lifecycle-closure Task 3 has started from current root commit `eb412cf`:
  - active branch/worktree: `lifecycle-config-update` at `.worktrees/lifecycle-config-update`
  - target command: `skillmux config update-agent --id <agent>`
  - baseline verification in the worktree passed with `npm test`, `npm run typecheck`, and `npm run build`
  - implementation will follow superpowers subagent-driven development with TDD, spec review, and code-quality review before root acceptance
- lifecycle-closure Task 3 is accepted in the root repo:
  - command added: `skillmux config update-agent --id <agent> [--root <path>] [--skills <path>] [--name <name>] [--platform <platform>] [--enabled-by-default|--disabled-by-default] [--json]`
  - behavior: updates one existing custom agent override, preserves unspecified fields, rejects missing overrides, and reuses shared id/path/platform validation with `config add-agent`
  - review outcome: spec review passed; code-quality review Important findings were fixed and re-reviewed
  - root verification passed with `npm test -- --run tests/commands/config-update-agent.test.ts`, `npm test`, `npm run typecheck`, and `npm run build`
  - accepted root commit: `a645ade` `feat: add config update-agent command`
  - stale implementation worktree `.worktrees/lifecycle-config-update` has been removed after root acceptance
  - next implementation slice: lifecycle batch operations
- lifecycle-closure Task 4 has started from current root commit `b233442`:
  - active branch/worktree: `lifecycle-batch` at `.worktrees/lifecycle-batch`
  - target behavior: batch wrappers around stable single-item lifecycle commands
  - baseline verification in the worktree passed with `npm test`, `npm run typecheck`, and `npm run build`
  - implementation will follow superpowers subagent-driven development with TDD, spec review, and code-quality review before root acceptance
- lifecycle-closure Task 4 is accepted in the root repo:
  - commands extended: `enable --skill <skill> --agent <agent>...`, `disable --skill <skill> --agent <agent>...`, `adopt --agent <agent> --skill <skill>...`, and `remove --skill <skill>...`
  - behavior: batch paths thinly call the existing single-item command logic and preserve single-item safety/idempotence rules
  - partial failures now use `BatchOperationError` with operation, failed item, completed items, and cause so users can see already-applied writes
  - review outcome: spec review passed; code-quality Important finding about partial failure reporting was fixed and re-reviewed
  - root verification passed with `npm test -- --run tests/commands/batch-operations.test.ts`, `npm test`, `npm run typecheck`, and `npm run build`
  - accepted root commit: `6fcaef7` `feat: add batch lifecycle operations`
  - stale implementation worktree `.worktrees/lifecycle-batch` has been removed after root acceptance
  - next implementation slice: final lifecycle docs and release readiness
- lifecycle-closure Task 5 has started from current root commit `476ef72`:
  - active branch/worktree: `lifecycle-release-docs` at `.worktrees/lifecycle-release-docs`
  - target docs: `README.md`, `PROJECT_STATUS.md`, `NEXT_ACTIONS.md`, `DECISIONS.md`, plus required root tracking in `AGENTS.md`
  - baseline verification in the worktree passed with `npm test`, `npm run typecheck`, and `npm run build`
  - README and state docs have been refreshed in the worktree
  - final worktree verification passed with `npm test`, `npm run typecheck`, and `npm run build`
  - next acceptance step: sync the committed docs back to the root repo and run fresh root verification
- small follow-up completed: `list` now keeps discovered agents visible with zero live entries and keeps manifest-managed skills visible even when they are currently disabled everywhere
- real-world bugfix pass completed:
  - `config` now accepts UTF-8 BOM-prefixed `~/.skillmux/config.json`
  - first-time `disable` can adopt an existing external skill link into `~/.skillmux/skills/` and then disable it cleanly
- custom agent configuration now has a CLI write path:
  - `skillmux config add-agent --id <agent-id> --root <home-relative-root>`
  - supports optional `--skills`, `--name`, repeated `--platform`, and `--disabled-by-default`
- custom agent configuration now also has a CLI removal path:
  - `skillmux config remove-agent --id <agent-id>`
  - removes only the user override from `~/.skillmux/config.json`
- v0 implementation had returned to root-only status before lifecycle closure; the current Task 5 worktree status is recorded above.
- product boundary is now explicit:
  - `npx skills` is responsible for fetching and installing skills from remote sources
  - SkillMux is responsible for scanning, adopting, enabling, disabling, listing, and diagnosing locally present skills
  - future integration work should improve the handoff between those two tools, not replace `npx skills`
- TUI Task 6 code-quality re-review follow-up is applied in the active worktree:
  - App normal dashboard input is blocked while a mutating action request is active, preventing agent reloads from clearing busy state before writes finish
  - regression coverage verifies a pending Space/toggle action cannot trigger another selected-agent reload through navigation
- TUI Task 7 has started in `.worktrees/tui-implementation` from accepted root commit `d4de92d`:
  - target scope: replace the temporary TUI launcher with real Ink rendering, keep command TTY protection, and verify CLI help exits before launching
  - implementation is delegated to a `gpt-5.4-mini` subagent for this cost-constrained round
  - accepted state still requires spec review, code-quality review, worktree verification, root sync, and fresh root verification
- TUI Task 7 is accepted in the active worktree:
  - real Ink launch is connected through `launchTui`, while `runTui` lazy-loads the default launcher only after the interactive terminal guard
  - CLI help and registration stay non-launching paths
  - spec review passed, code-quality review found eager TUI loading, the lazy-load fix was applied, and both re-reviews passed
  - worktree verification passed with `git diff --check`, targeted TUI/command tests, full `npm test`, `npm run typecheck`, and `npm run build`
  - next acceptance step: sync the committed code back to the root repo and run fresh root verification
- TUI Task 7 is accepted in the root repo:
  - accepted code through root commit `95a215d`
  - fresh root verification passed with `git diff --check`, targeted TUI/command tests, full `npm test`, `npm run typecheck`, and `npm run build`
  - manual root re-check found that `tsup` with `splitting: false` still placed the TUI/Ink module graph in the bundled CLI entry despite source-level lazy loading; the build now uses ESM splitting and has smoke coverage for that boundary
  - next implementation slice: TUI Task 8 documentation, manual terminal checks, and release readiness
- next approved design focus is CLI lifecycle closure in this order:
- implementation planning for that phase is now complete
  - `remove skill`
  - better adoption of already-installed skills
  - `config` command-family expansion
  - batch operations
  - TUI only after those command semantics are stable
- TUI Task 8 has started in the root repo as a docs/readiness-only slice.
- Task 8 adds user-facing README coverage for `skillmux tui` and records readiness status in the tracking docs.
- Task 8 readiness exposed a non-interactive CLI issue: `node dist\cli.js tui` wrote the friendly terminal message and then surfaced a Node stack trace. The CLI action now catches only the typed TUI non-interactive error, sets exit code 1, and lets unexpected errors propagate.
- Task 8 automated verification passed in the root repo with `npm test`, `npm run typecheck`, `npm run build`, and `npm pack --dry-run`.
- Non-interactive `skillmux tui` checks passed for redirected output and `NO_COLOR`; true Windows Terminal 80x24/120x40 visual checks and `Ctrl+C` terminal restoration remain pending because this tool session is non-TTY.

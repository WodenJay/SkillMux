# PROJECT_STATUS.md

Project: SkillMux
Phase: lifecycle-closure implementation in progress
Stable area: `C:\Users\wudon\Desktop\SkillMux\`
Canonical worktree: `(none)`
Active development worktree: `.worktrees/lifecycle-release-docs`

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
- `a645ade` `feat: add config update-agent command`
- `6fcaef7` `feat: add batch lifecycle operations`

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
- package name on npm: `skillmux`
- publish was verified with `npm view skillmux version` returning `0.1.1`
- `README.md` has been rewritten as a user-facing and AI-friendly manual
- the README now focuses on purpose, audience, installation, commands, and usage flow instead of internal version framing
- the published package now includes:
  - `skillmux config remove-agent`
  - the README logo and centered README header polish

## Next Step

- lifecycle-closure implementation has started from approved docs:
  - spec: `docs/superpowers/specs/2026-04-13-skillmux-cli-lifecycle-closure-design.md`
  - plan: `docs/superpowers/plans/2026-04-13-skillmux-cli-lifecycle-closure-implementation-plan.md`
  - active branch/worktree: `lifecycle-closure` at `.worktrees/lifecycle-closure`
  - baseline verification in the worktree passed with `npm test`, `npm run typecheck`, and `npm run build`
  - implementation is following superpowers subagent-driven development; accepted state still requires root repo verification before completion
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
  - implementation will follow superpowers subagent-driven development with documentation review before root acceptance
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
- v0 implementation is complete and the repo root is now the only active workspace
- product boundary is now explicit:
  - `npx skills` is responsible for fetching and installing skills from remote sources
  - SkillMux is responsible for scanning, adopting, enabling, disabling, listing, and diagnosing locally present skills
  - future integration work should improve the handoff between those two tools, not replace `npx skills`
- next approved design focus is CLI lifecycle closure in this order:
- implementation planning for that phase is now complete
  - `remove skill`
  - better adoption of already-installed skills
  - `config` command-family expansion
  - batch operations
  - TUI only after those command semantics are stable

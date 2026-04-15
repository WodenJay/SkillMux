# DECISIONS.md

Record key product and implementation decisions so later sessions do not lose the reasoning.

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

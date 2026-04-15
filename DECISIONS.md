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

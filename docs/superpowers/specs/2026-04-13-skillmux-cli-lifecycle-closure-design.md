# SkillMux CLI Lifecycle Closure Design

Date: 2026-04-13
Status: approved for spec drafting, pending user review

## Goal

Close the most important CLI gaps in SkillMux before building a TUI.

SkillMux already covers the main local-management loop for imported and managed skills. What it still lacks is a complete skill lifecycle and a smoother handoff from `npx skills` into SkillMux. This spec defines the next CLI phase in a strict order so the command surface becomes complete before any higher-level interface is added.

## Scope

This phase adds four capabilities, in this order:

1. `remove skill`
2. Better adoption of skills that were already installed outside SkillMux
3. More complete `config` subcommands
4. Batch operations

TUI work is explicitly out of scope for this phase. The TUI should come only after the CLI command model is stable.

This phase also keeps the current product boundary unchanged:

- `npx skills` remains the remote install entrypoint
- SkillMux remains the local management layer
- any integration work should improve the handoff between those two tools, not replace `npx skills`

## Why This Order

This order follows the actual lifecycle of a managed skill.

- `remove` closes the lifecycle endpoint
- `adopt` closes the handoff from outside installs into SkillMux
- `config` improvements make custom environments easier to maintain
- batch operations improve efficiency after the core semantics are stable

Doing these in another order would either polish secondary workflows too early or force later commands to break earlier assumptions.

## Approach Options

### Option A: Lifecycle-first CLI expansion

Add the missing lifecycle commands one layer at a time, starting with single-item semantics and only later adding batch operations.

Pros:

- keeps each command easy to test
- lowers the risk of breaking the current stable CLI
- gives the future TUI a cleaner command foundation

Cons:

- user-visible improvements arrive incrementally

### Option B: One large command-surface redesign

Redesign the whole CLI around a new lifecycle model and land `remove`, `adopt`, config expansion, and batch operations together.

Pros:

- could produce a more uniform command family on paper

Cons:

- large scope
- higher regression risk
- slower time to first usable improvement

### Option C: Skip straight to TUI and backfill CLI

Build the TUI as the main user-facing loop and fill missing semantics underneath as needed.

Pros:

- faster visible progress

Cons:

- wrong dependency order
- would cause repeated TUI churn while command semantics are still changing

## Recommendation

Choose Option A.

The CLI is already the product's stable core. The safest and most valuable next step is to close the remaining lifecycle gaps in narrow slices, keep the tests tight, and delay the TUI until the command model stops moving.

## Phase A: `remove skill`

### User need

Users can disable a skill today, but they cannot fully delete a managed skill from SkillMux storage. That leaves dead entries in `manifest.json` and unused content under `~/.skillmux/skills/<skill-id>`.

### Product behavior

Add a command that deletes one managed skill from SkillMux.

Initial target:

- `skillmux remove --skill <skill>`

Possible follow-up flags:

- `--json`
- `--force`

### Semantics

Default behavior must be conservative.

- if the skill is still enabled for any agent, `remove` should refuse and explain why
- if the skill is fully disabled everywhere, `remove` should:
  - remove the managed skill directory
  - remove manifest skill metadata
  - remove related activation records
- `--force` may later allow a controlled cleanup path, but only after the base behavior is proven safe

### Non-goals

- no remote uninstall logic
- no attempt to remove ordinary directories outside SkillMux-managed paths

## Phase B: adopt already-installed skills

### User need

Users often install skills with `npx skills` first. SkillMux should make those skills easy to adopt instead of forcing a manual import-and-relink workflow.

### Product behavior

Add a first-class adoption flow for skills that already exist in agent directories.

The likely command family should center on `adopt`, for example:

- `skillmux adopt --agent <agent>`
- `skillmux adopt --agent <agent> --skill <skill>`

The exact final surface can stay flexible during planning, but the purpose is fixed: convert externally installed skills into SkillMux-managed assets with minimal manual work.

### Semantics

Adoption should:

- discover eligible skills in agent directories
- validate that they look like real skills
- copy the real content into SkillMux-managed storage
- preserve safe provenance metadata
- replace the external live link with a SkillMux-managed link when needed

### Constraints

- no remote download
- no dependence on hidden `npx skills` internals
- focus on local handoff only

## Phase C: complete the `config` command family

### User need

Custom agent support now exists, but the `config` surface is still narrow. Users can add and remove overrides, but maintenance is still incomplete.

### Product behavior

Expand `config` so custom agent rules are easier to inspect and maintain.

Likely additions:

- `config update-agent`
- stronger config validation/reporting
- clearer separation between inspection and mutation

The goal is not to build a generic config editor. The goal is to make agent override management complete enough for real use.

### Semantics

Config mutations should stay narrow and explicit:

- mutate one override at a time
- reject unsafe paths
- keep the current distinction between user config and manifest state

## Phase D: batch operations

### User need

Once single-item semantics are correct, users will want to apply the same action to many agents or many skills without scripting around SkillMux.

### Product behavior

Add batch forms only after Phases A-C are stable.

Candidate shapes:

- enable or disable one skill for multiple agents
- adopt multiple skills under one agent
- remove multiple disabled skills

### Semantics

Batch operations must build on the exact same single-item rules as the non-batch commands.

They should:

- preserve idempotence
- surface partial failures clearly
- avoid hidden destructive behavior

Batch behavior should be a thin orchestration layer, not a second command model.

## TUI Position

TUI is intentionally delayed until the command surface is complete enough to support it cleanly.

That means the recommended order is:

1. `remove`
2. `adopt`
3. `config` expansion
4. batch operations
5. TUI

The TUI should be a presentation layer over stable CLI semantics, not the place where those semantics are invented.

## Command Design Principles For This Phase

- keep one clear purpose per command
- prefer explicit nouns and verbs over overloaded flags
- keep destructive behavior conservative by default
- let batch commands compose single-item semantics
- keep `npx skills` as an external install dependency, not an internal runtime abstraction

## Testing Strategy

Each phase should follow the same pattern:

- write targeted command tests first
- verify the red state explicitly
- implement the smallest passing behavior
- run the full CLI verification suite after each accepted slice

The most important test classes for this phase are:

- safe removal of managed assets
- adoption of externally installed skills
- config mutation correctness
- batch-operation idempotence and failure reporting

## Acceptance Criteria

This lifecycle-closure phase is complete when all of the following are true:

- users can fully delete a managed skill safely
- users can adopt `npx skills`-installed skills into SkillMux with a first-class workflow
- custom agent config management feels complete at the CLI level
- common multi-target workflows no longer require manual shell loops
- the resulting CLI semantics are stable enough to support a later TUI without redesign

# SkillMux TUI PTY Exploration Design

Date: 2026-04-21
Status: Written, awaiting user review

## Purpose

SkillMux already has a working TUI, but the current test surface is still too close to component and reducer logic. It can prove rendering details and key dispatch, but it cannot exercise a full terminal session the way a real user does.

SkillMux needs a PTY-driven exploration layer so the agent can:

- launch `skillmux tui` as a real terminal program
- send keys and terminal resize events
- inspect terminal output as a user would see it
- execute real lifecycle actions in a temporary sandbox
- find usability problems without relying on manual user retesting
- turn discovered bugs into stable regression scenarios

The goal is not desktop automation of Windows Terminal. The goal is to test the SkillMux TUI itself at the terminal semantics layer.

## Scope

This design adds a new TUI exploration and end-to-end testing layer.

It supports:

- PTY-backed launch of `skillmux tui`
- temporary test sandboxes with real agent directories and managed store state
- scriptable exploratory sessions that can drive the TUI like a user
- structured event logs and terminal screen snapshots
- file-system assertions for `toggle`, `adopt`, `remove`, and `scan`
- stable regression scenarios for already-understood bugs
- developer-facing command entrypoints for exploration and repeatable verification

It does not support:

- Windows Terminal or PowerShell window automation
- image-based screenshot testing
- fuzzy random-input exploration in the first version
- replacing the existing reducer/component/unit tests
- changing TUI product behavior by itself

## Why a New Module Is Necessary

The current tests under `tests/tui/` are still valuable, but they stop short of a real terminal session. They cannot fully validate:

- startup and shutdown behavior across a true PTY boundary
- terminal resize handling in a live session
- terminal takeover feel and full-screen rendering behavior
- busy-state interaction blocking under realistic input timing
- screen changes across multi-step flows
- terminal restoration after quit or `Ctrl+C`

That gap justifies a new module rather than another layer of component tests.

## Design Summary

SkillMux should add a dedicated PTY-driven TUI exploration harness under `tests/tui-e2e/`.

The harness has two jobs:

1. exploratory use: let the agent drive the TUI like a user, inspect output, and diagnose usability problems
2. regression protection: preserve important findings as stable scenario tests

The first job takes priority. The design should help the agent explore the TUI, not only run brittle pass/fail assertions.

## Architecture

The new layer should live beside the existing unit and component tests, not inside them.

```text
tests/
  tui/
    ...existing reducer/component tests...
  tui-e2e/
    pty-session.ts
    sandbox.ts
    screen.ts
    explorer.ts
    fixtures.ts
    scenarios/
      smoke.test.ts
      lifecycle-flow.test.ts
      usability-probes.test.ts
scripts/
  run-tui-explore.ts
```

### `pty-session.ts`

Owns the real terminal session:

- spawn `skillmux tui` inside a PTY
- send keypresses
- resize terminal dimensions
- wait for output to settle
- capture raw output stream
- terminate the session cleanly

### `sandbox.ts`

Owns the temporary filesystem world:

- create a temp `HOME`
- create a temp `.skillmux`
- create temp agent roots such as `.codex`, `.claude`, or `.agents`
- seed managed and unmanaged test skills
- create symlink or junction layouts that match SkillMux's real usage
- destroy the sandbox after the run

All mutating actions run here. The real user environment must remain untouched.

### `screen.ts`

Turns PTY output into test-friendly terminal state:

- normalize line endings
- strip or preserve ANSI sequences as needed
- maintain the latest rendered screen text
- save named screen snapshots
- support text search and focused-region checks

### `explorer.ts`

Provides high-level user-like operations:

- `focusAgents()`
- `focusSkills()`
- `press("left")`
- `press("space")`
- `type("skill")`
- `waitForText("Skills for codex")`
- `snapshot("after-toggle")`
- `expectVisible(...)`
- `expectFs(...)`

This layer should make exploration scripts readable. It is not a new business-logic layer.

### `scenarios/`

Contains two kinds of scenarios:

- exploratory probes for agent-driven TUI inspection
- stable regression tests for fixed bugs

## Temporary Sandbox Model

Every PTY exploration run should build its own temporary environment.

The sandbox needs three directory groups:

- a temp `HOME`
- a temp SkillMux store, usually under `HOME/.skillmux`
- one or more temp agent directories under the same home

The harness should be able to seed these row types:

- managed and enabled skills
- managed but disabled skills
- unmanaged skills visible to one agent
- issue-triggering entries such as broken links or stale paths
- shared-content setups that mirror `skills.sh` symlink behavior

The fixture model should describe the environment declaratively. The sandbox builder then writes it to disk.

That keeps scenarios short and makes bug reproduction easier.

## Real Action Semantics

The harness must execute real TUI actions in the sandbox.

For the first version, these paths matter most:

- `Space` toggles a selected managed skill
- `a` adopts a selected unmanaged skill
- `r` removes a selected disabled managed skill
- `s` runs scan and refreshes dashboard state

Each action should produce three kinds of evidence:

1. terminal evidence: text visible on screen before and after the action
2. event evidence: keypresses, waits, matched conditions, exit details
3. filesystem evidence: expected links, directories, manifest records, or removals

The design should not rely on whole-screen exact snapshots as the only truth. Assertions should prefer:

- critical visible text
- focus and selection behavior
- concrete filesystem side effects

Snapshots remain important for diagnosis and review, but they should not make tests fragile.

## Exploration API

The harness should expose both low-level and high-level control.

Low-level controls:

- send a raw key
- resize the PTY
- wait for an output change
- read current screen text
- read event log

High-level helpers:

- `selectAgent("codex")`
- `selectSkill("terminal-ui")`
- `toggleSelectedSkill()`
- `adoptSelectedSkill()`
- `removeSelectedSkill()`
- `runScan()`
- `openHelp()`
- `startSearch("term")`

That split lets the agent do two things:

- inspect new UX behavior quickly with readable scripts
- drop to raw terminal controls when debugging timing or rendering issues

## Output Artifacts

Each exploration run should emit three artifact classes.

### Event log

A structured log should capture:

- scenario name
- sandbox root
- PTY size changes
- keys sent
- waits and matched text
- failures
- exit signal or exit code

### Screen snapshots

Named snapshots should capture key moments such as:

- initial dashboard
- after focus change
- after modal open
- after confirm
- after resize
- before quit

### Filesystem checks

The harness should record the critical postconditions for mutating actions:

- path exists or not
- path is a link or plain directory
- managed store target exists
- activation link was created, removed, or replaced

## Command Entrypoints

The first version should expose two developer-facing commands:

- `npm run tui:explore`
- `npm run test:tui-e2e`

`tui:explore` is the agent's day-to-day loop for trying the TUI like a user and saving detailed artifacts.

`test:tui-e2e` runs stable scenarios that are suitable for repeatable regression checks.

The implementation may share the same harness underneath. The difference is intent and default output behavior.

## Technology Choice

The PTY harness should use a real PTY library rather than simulate Ink at the React tree level.

Recommended foundation:

- `node-pty` for PTY process control
- `xterm-headless` for terminal buffer interpretation
- optional `xterm-addon-serialize` if serialized screen snapshots prove useful

This matches the actual problem. SkillMux needs terminal-session control, not more component mocks.

## Initial Scenario Set

The first implementation plan should cover these flows:

- launch and quit
- left/right focus switching
- agent selection with skills list reload
- selected-agent highlight persistence while Skills has focus
- `Space` toggle flow
- `a` adopt flow
- `r` remove flow
- `s` scan flow
- `/` search flow
- `?` help flow
- terminal resize
- busy-state input blocking
- `Ctrl+C` exit and terminal restoration

These scenarios are enough to make the harness immediately useful for TUI polish.

## Safety Requirements

The harness must not touch the user's real environment.

Rules:

- every run gets a new temp sandbox
- all mutating actions run only inside that sandbox
- no scenario reads or writes the caller's real home directory
- failure cleanup must still preserve artifacts needed for debugging
- sandbox creation should make test ownership obvious in logs and paths

## Testing Strategy

This PTY layer complements the existing `tests/tui/*` suite.

The split is:

- `tests/tui/*`: fast reducer, model, action, and component tests
- `tests/tui-e2e/*`: real session behavior, terminal output, and filesystem side effects

The implementation should start with a narrow smoke slice, then add exploratory helpers, then capture regressions discovered during TUI use.

## Non-Goals

The first version does not:

- automate Windows Terminal itself
- perform image diffing or video capture
- guarantee pixel-perfect screen matching
- replace human product judgment
- fuzz every input permutation

It only needs to give the agent enough control to use SkillMux's TUI directly and close the loop on UX bugs without asking the user to replay each session manually.

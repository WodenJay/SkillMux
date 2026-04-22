# SkillMux TUI PTY Audit And Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development when plan execution policy allows it. Keep each round small, verify it fully, then stop for `/compact`.

**Goal:** Use the accepted PTY harness to audit the real `skillmux tui`, fix the highest-priority usability defects, and convert those findings into regression coverage.

## Required Skills During Implementation

- Use `$terminal-ui` before changing TUI behavior or keyboard handling.
- Use `superpowers:systematic-debugging` when a PTY scenario or live exploration reveals a defect.
- Use `superpowers:test-driven-development` before fixing a defect.
- Use `superpowers:verification-before-completion` before claiming a round is done.

## Round Structure

Each implementation round should follow the same shape:

- [x] Run exploratory PTY audit and collect artifacts
- [x] Write down the round's high-priority findings in tracking docs
- [x] Add or update a failing targeted regression where practical
- [x] Fix the high-priority batch in `src/tui/`
- [x] Run targeted verification plus repo-wide gates as needed
- [x] Update this plan and the four tracking docs
- [x] Stop and hand off the next round with a `/compact` reminder

## Round 1

**Audit scope:**

- focus switching and keyboard routes
- visible panel selection state
- first-screen layout and information density
- status/help/confirm feedback consistency
- PTY startup, resize, and exit behavior

**Expected outputs:**

- first high-priority issue batch
- repaired product code
- regression updates in PTY scenarios or focused TUI tests

**Round 1 outcome:**

- split the footer/help legends into shorter dedicated lines so the 80x24 baseline is easier to scan
- updated focused TUI tests plus PTY smoke coverage to lock the user-requested circle-marker contract and the repaired legend output

## Round 2

**Planned focus:**

- inspect first-screen density after the Round 1 marker/legend cleanup
- reduce detail-pane path sprawl or other remaining layout friction found in PTY snapshots

**Round 2 outcome:**

- replaced the verbose `Skill path` / `Agent link` rows with shorter `Store` / `Link` labels
- compacted long managed and agent-link paths to single-line tail summaries so the Detail pane stops consuming multiple wrapped rows on the first screen
- added focused TUI coverage plus PTY smoke assertions for the compact detail output

## Round 3

**Planned focus:**

- re-audit the first screen after the detail compaction landed
- remove the next highest-priority source of first-screen noise without hiding useful local state

**Round 3 outcome:**

- the default Agents list now hides built-in agents that are neither present locally nor carrying activation history, unmanaged entries, or issues
- explicit agent search still searches the full discovered agent set, so hidden built-ins remain discoverable when the user asks for them
- the fix is backed by a focused TUI state regression plus a real PTY smoke assertion that the codex-only first screen no longer lists irrelevant missing agents

## Round 4

**Planned focus:**

- continue from the accepted Round 3 first screen and rank the next interaction/state-feedback defect batch
- prioritize search behavior that can strand the user in a misleading or harder-to-recover state

**Round 4 outcome:**

- empty search results now distinguish between "nothing is installed here" and "your current filter has no matches"
- `Esc` cancels a filtered search and restores the previous agent/skill selection instead of leaving the dashboard stranded on a null selection
- `Enter` now commits the current search result, and the footer/help copy explains the `Enter` versus `Esc` search behavior
- the fix is backed by focused state/component regressions plus a real PTY usability probe that exercises empty-result cancel and commit flows

## Round 5

**Planned focus:**

- continue from the accepted Round 4 search behavior and rank the next interaction/state-feedback defect batch
- prioritize misleading dashboard states during agent switching, where the selected agent changes before the async reload returns

**Round 5 outcome:**

- while a new agent is loading, the Skills pane now shows `Loading skills for <agent>...` instead of the misleading `No skills for this agent`
- while that same reload is pending, the Detail pane now shows a loading placeholder instead of `Select a skill row`
- the fix is backed by a focused App regression that reproduces the pending-load state and verifies the loading placeholders

## Verification Gate Per Round

Run the narrowest useful checks first, then broaden as risk grows:

```powershell
npm run build
```

```powershell
npm test -- --run <targeted tests>
```

```powershell
npm run test:tui-e2e
```

```powershell
npm run typecheck
```

```powershell
git diff --check
```

Use full `npm test` when the round touches shared TUI behavior or command integration.

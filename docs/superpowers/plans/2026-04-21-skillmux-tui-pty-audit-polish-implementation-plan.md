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

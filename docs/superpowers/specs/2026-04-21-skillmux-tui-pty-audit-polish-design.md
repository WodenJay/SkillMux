# SkillMux TUI PTY Audit And Polish Design

Date: 2026-04-21
Status: Approved for implementation

## Purpose

The PTY harness is now complete. The next slice is to use that harness to drive the real `skillmux tui`, identify product-level usability and interaction defects, and improve the TUI itself.

This slice is not new test infrastructure work. It is a product polish loop built on top of the accepted PTY exploration layer.

## Scope

This slice covers:

- PTY-driven exploratory sessions against the real TUI
- audit of four user-facing areas:
  - interaction, keys, and focus behavior
  - layout and information density
  - state synchronization and feedback
  - terminal compatibility, exit, and restoration behavior
- fixing the highest-priority problems found during each audit round
- adding or extending PTY regression scenarios for repaired issues

This slice does not cover:

- new outer-window automation for Windows Terminal
- a redesign of SkillMux lifecycle semantics
- speculative polish with no PTY-backed reproduction

## Operating Model

Work should run in repeated rounds.

Each round should:

1. drive the real TUI through PTY scenarios and exploratory scripts
2. record artifacts under `.artifacts/tui-e2e/`
3. identify the highest-priority issues from that round
4. fix only that high-priority batch
5. add or extend regression coverage where the bug should stay fixed
6. run verification
7. stop and hand off a clear `/compact` checkpoint

The goal is steady convergence, not one oversized polish pass.

## Priority Rules

When multiple problems are visible, priority should be:

1. interaction failures or confusing focus behavior that block normal use
2. incorrect or stale state feedback after actions
3. layout problems that hide primary information or make the TUI hard to read
4. terminal restoration or compatibility defects
5. lower-value wording or cosmetics

The implementation should favor user-visible correctness over decorative polish.

## Test Strategy

The PTY harness remains the primary acceptance mechanism for this slice.

Exploration should combine:

- `npm run tui:explore` for artifact-rich manual-style probing
- targeted PTY scenario updates in `tests/tui-e2e/scenarios/`
- existing reducer/component tests only when they are the narrowest way to lock down a repaired behavior

Every fixed high-priority bug should have a repeatable verification path, even if the exact artifact snapshots remain exploratory.

## Output

The durable outputs of this slice are:

- improved TUI behavior in `src/tui/`
- stronger PTY regression coverage in `tests/tui-e2e/`
- tracking updates in `AGENTS.md`, `PROJECT_STATUS.md`, `NEXT_ACTIONS.md`, and `DECISIONS.md`
- a compact-ready handoff after each round

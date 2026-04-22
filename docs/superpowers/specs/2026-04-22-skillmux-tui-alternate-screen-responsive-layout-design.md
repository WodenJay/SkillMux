Date: 2026-04-22
Status: Approved in design review, pending written-spec review

# SkillMux TUI Alternate Screen And Responsive Fullscreen Design

## Purpose

The current `skillmux tui` behaves like an Ink dashboard rendered inside the existing terminal screen. That is not the intended product experience.

This slice changes the TUI runtime model so it behaves like a full terminal application:

- entering `skillmux tui` switches into the terminal's alternate screen
- the dashboard occupies the full terminal viewport
- layout follows the live terminal size instead of fixed column widths
- exiting restores the previous shell screen without leaving the TUI frame behind

This slice is about runtime behavior and layout, not lifecycle semantics.

## User Goals

The accepted user goals for this slice are:

1. `skillmux tui` should feel like entering another terminal interface, not drawing a boxed widget inside the current shell output.
2. The dashboard should adapt to the current terminal width and height instead of assuming a fixed working size.
3. Leaving the TUI should restore the prior terminal content cleanly.
4. A future usability slice should add a one-key action to adopt all unmanaged skills, but that is not part of this runtime/layout change.

## Scope

This slice covers:

- default alternate-screen entry for interactive `skillmux tui`
- guaranteed alternate-screen teardown and cursor restoration on normal exit, `Ctrl+C`, and launch/runtime failure paths
- responsive fullscreen dashboard layout
- minimum-size fallback messaging when the terminal is below the supported floor
- focused regression coverage for alternate-screen lifecycle and resize behavior

This slice does not cover:

- a redesign of the three-panel information architecture
- Windows Terminal outer-window automation
- bulk lifecycle actions such as "adopt all unmanaged skills"
- speculative TUI polish unrelated to fullscreen runtime behavior

## Runtime Model

`skillmux tui` should enter the alternate screen by default whenever it is launched in an interactive terminal.

The runtime contract is:

- before Ink begins interactive rendering, SkillMux enters the alternate screen and hides the cursor
- while running, the dashboard owns the full terminal viewport
- when the session exits for any reason, SkillMux restores the main screen and the cursor

The cleanup path must be centralized and reliable. It must not depend on only one exit key path such as `q`.

This makes the TUI feel like a dedicated terminal application while preserving the user's existing shell history on return.

## Layout Model

The dashboard remains a persistent multi-panel view with:

- a top status line
- a middle body with Agents, Skills, and Detail panes
- a bottom footer/help area

The layout changes from fixed-width columns to responsive proportions with minimum constraints.

Expected behavior:

- normal terminal sizes use a three-column proportional layout
- larger terminals allow all three panes to expand naturally
- smaller but still supported terminals shrink proportionally, with the Detail pane yielding space first
- below the supported minimum, the dashboard stops trying to render the full layout and instead shows a fullscreen resize prompt

The accepted minimum supported terminal size stays `80x24`, but that is now only the lower bound. It is not the target layout size.

## Overlays And Interaction Compatibility

This slice does not change the keyboard model for normal dashboard use.

The current interaction contract remains:

- left/right arrows switch focus
- up/down and `j`/`k` move within lists
- `Space`, `a`, `r`, `s`, `/`, `?`, `Esc`, and `q` keep their existing meanings
- the Detail pane remains outside the focus cycle

Help and confirmation UIs remain overlays, but within the new fullscreen runtime model they behave as overlays on top of the alternate-screen dashboard rather than extra lines appended to a normal shell screen.

The footer remains the concise current-context action guide. It should not attempt to compensate for layout problems by carrying too much explanatory text.

## Error Handling And Exit Semantics

This slice must preserve the existing non-interactive guard: non-TTY usage still fails before launching the TUI.

For interactive sessions:

- normal exit restores the main screen
- `Ctrl+C` restores the main screen
- launch failures after alternate-screen entry still restore the main screen
- runtime exceptions still restore the main screen before the error escapes

The user-visible bar is simple: entering and leaving the TUI should not dirty the shell screen state.

## Test Strategy

This slice should extend the existing TUI test stack at three levels.

1. Lifecycle tests
   - verify alternate-screen entry
   - verify main-screen restoration
   - verify cursor restoration on exit and failure paths

2. Layout/component tests
   - verify responsive pane sizing across supported widths
   - verify minimum-size fallback rendering

3. PTY scenarios
   - verify the real built CLI enters the alternate screen
   - verify quitting returns to the main screen without leaving the dashboard frame behind
   - verify resize remains stable in the real PTY path

The PTY layer is the main acceptance path because this change is about terminal semantics, not just component geometry.

## Implementation Notes

This slice should be implemented as a new polish/design line separate from the unfinished Round 8 search-cancel debugging thread.

The current uncommitted Round 8 debugging changes should be treated as unrelated WIP until they are either resumed deliberately or discarded deliberately. They should not be mixed into this alternate-screen/layout slice by accident.

## Output

The durable outputs of this slice are:

- updated TUI runtime behavior in `src/tui/`
- updated regression coverage for alternate-screen and responsive fullscreen behavior
- synchronized tracking in `AGENTS.md`, `PROJECT_STATUS.md`, `NEXT_ACTIONS.md`, and `DECISIONS.md`
- a follow-up implementation plan for this slice

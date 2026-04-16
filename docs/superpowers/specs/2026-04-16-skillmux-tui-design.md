# SkillMux TUI Design

Date: 2026-04-16
Status: Approved for spec review

## Purpose

SkillMux already has a stable CLI for local skill management. The TUI adds a daily management dashboard on top of the existing command layer. It helps users inspect agents, see which skills are enabled for one selected agent, toggle managed skills, adopt local skills, remove disabled managed copies, and refresh state with an explicit scan.

The TUI must not become a second implementation of SkillMux's filesystem rules. It reuses the current command helper functions for discovery, manifest reads and writes, link operations, adoption, removal, and diagnostics.

## First-Version Scope

The first version is an agent-first dashboard.

It supports:

- `skillmux tui` as the explicit entrypoint.
- A persistent three-panel layout: agents, skills for the selected agent, and detail.
- Keyboard-only operation.
- `Space` to toggle a focused managed skill between enabled and disabled.
- `a` to adopt an unmanaged or adoptable skill after confirmation.
- `r` to remove a disabled managed skill after confirmation.
- `s` to run `scan` explicitly and refresh the dashboard.
- `/` to search the focused list.
- `?` to open contextual help.

It does not support:

- Remote download or update of skills.
- A full config editor.
- A full doctor dashboard.
- Staged batch edits.
- Automatic background scan or polling.
- Changing existing CLI command semantics.

## Layout

The default layout is a persistent multi-panel dashboard.

```text
SkillMux                                      issues: 2  last scan: 11:02
┌─ Agents ─────────────┬─ Skills for codex ─────────────┬─ Detail ────────────┐
│ > codex       14     │ > ● using-superpowers           │ using-superpowers   │
│   claude      10     │   ● tui-design                  │ enabled for codex   │
│   gemini       6     │   ○ terminal-ui                 │                     │
│   agents       3     │   ? find-skills                 │ source: managed     │
│                      │   ! old-link                    │ path: ~/.skillmux...│
│                      │                                 │ updated: 11:02      │
│                      │                                 │                     │
│                      │                                 │ Space will disable  │
└──────────────────────┴─────────────────────────────────┴─────────────────────┘
[q]uit [/]search [?]help [Tab]focus [Space]toggle [a]adopt [r]remove [s]scan
```

The left panel always lists agents. The center panel lists skills for the selected agent. The right panel explains the selected item. The footer is the only place for action shortcuts; the detail panel must not duplicate the action list.

At minimum, the TUI supports 80x24. Below that size, it shows:

```text
Terminal too small. Resize to at least 80x24.
```

The first version may keep the three-panel layout for all supported sizes. It can add a single-panel fallback later if implementation finds it necessary.

## Row States

Skill rows use a symbol plus text and optional color. Color never carries meaning by itself.

| Marker | Meaning | Color Guidance | Primary Action |
| --- | --- | --- | --- |
| `●` | Managed and enabled for the selected agent | Green | `Space` disables |
| `○` | Managed and disabled for the selected agent | Default or muted | `Space` enables |
| `?` | Unmanaged or adoptable | Info color | `a` adopts after confirmation |
| `!` | Issue detected | Warning or error color | Show detail; use scan or doctor |

If a terminal cannot render `●` and `○` correctly, implementation may fall back to ASCII markers such as `*` and `o`.

## Detail Panel

The detail panel shows metadata and state explanation only. It can show:

- selected skill or agent name
- current state
- source kind
- managed path or live path
- last update time
- issue code and message
- the next likely action in one short sentence

Examples:

- `Space will disable`
- `Press a to adopt this skill`
- `Run doctor for details`

If the selected row is an agent, the detail panel shows the agent root, skills path, discovery type, and counts for enabled, disabled, unmanaged, and issue rows.

## Keyboard Model

Global keys:

- `q`: quit
- `?`: open help
- `s`: run scan and refresh
- `Esc`: close search or modal; no-op otherwise

Focus keys:

- `Tab`: move focus from Agents to Skills to Detail
- `Shift+Tab`: move focus backward
- `↑` / `↓` and `k` / `j`: move inside the focused list
- `g` / `G`: jump to top or bottom of the focused list

Search:

- `/`: search the focused list
- `Esc`: close search
- search in Agents filters agents
- search in Skills filters skills for the selected agent
- Detail does not search in the first version

Actions:

- `Space`: toggle the focused managed skill in the Skills panel
- `a`: adopt the focused adoptable skill after confirmation
- `r`: remove the focused disabled managed skill after confirmation

The footer changes with context. It shows only actions that can run now.

## Confirmation Modals

`a` and `r` require confirmation.

Adopt confirmation:

```text
┌─ Confirm adopt ─────────────────────────────┐
│ Adopt find-skills from codex into SkillMux? │
│ This will copy the skill into ~/.skillmux.  │
│                                             │
│ [y] confirm   [Esc] cancel                  │
└─────────────────────────────────────────────┘
```

Remove confirmation:

```text
┌─ Confirm remove ────────────────────────────┐
│ Remove managed local copy: old-skill?       │
│ This only removes SkillMux's managed copy.  │
│ It will not uninstall a remote package.     │
│                                             │
│ [y] confirm   [Esc] cancel                  │
└─────────────────────────────────────────────┘
```

The first version does not require typing the skill name. Existing `runRemove` safety checks still reject enabled skills and unsafe managed paths.

## State Loading

The TUI loads dashboard state from existing SkillMux behavior:

- `runAgents` for agent discovery
- current list or equivalent internal aggregation for agents, skills, activations, and live entries
- `runDoctor` or equivalent issue aggregation for issue counts and issue rows
- manifest data for `lastScan`

Opening the TUI must not automatically run `scan`, because `scan` writes manifest state. Users run `s` when they want to refresh and persist a scan result.

An implementation should normalize rows into a dashboard model similar to:

```ts
type TuiSkillRow =
  | { marker: "●"; state: "enabled"; skillId: string; managed: true }
  | { marker: "○"; state: "disabled"; skillId: string; managed: true }
  | { marker: "?"; state: "unmanaged"; skillId: string; adoptable: boolean }
  | { marker: "!"; state: "issue"; skillId: string; issueCode: string };
```

The exact type can change during implementation, but the four visible states must remain.

## Refresh Behavior

`s` runs a full scan through the existing command layer. During scan:

- top status shows `scanning...`
- input handling remains responsive where possible
- existing dashboard content stays visible
- focus and selection are preserved when the selected agent and skill still exist

After scan:

- rebuild dashboard state
- show a status message such as `Scan complete: 14 skills, 2 issues`
- if the selected row disappeared, move focus to the first available row in the same panel

Writes from `Space`, `a`, and `r` update state after the underlying command succeeds. They must not rely on long-lived optimistic UI. If a write fails, the current dashboard remains visible and the status line explains the error.

## Error Handling

The TUI converts command errors into user-facing status messages.

Rules:

- Do not show stack traces in the main dashboard.
- Do not clear old state on scan or doctor failure.
- Close a confirmation modal after a confirmed action, even if the action fails.
- Keep focus on the affected row when possible.
- Show partial-failure details if a future action reports completed and failed items.
- Never imply rollback unless the command layer actually rolled back.

Examples:

- `Cannot remove: skill is still enabled for claude`
- `Scan failed: <reason>`
- `Adopt failed: <reason>`

## Help System

The help system has three tiers.

Footer: always visible, context-sensitive, and short.

Help overlay: opened with `?`, grouped into:

- Navigation
- Actions
- Search
- Safety

CLI help: `skillmux tui --help` uses Commander help and does not launch the TUI.

The help overlay must explain which actions write to the local filesystem:

- `Space` changes the selected agent's skill visibility.
- `a` copies/adopts a local skill into SkillMux management and relinks the agent entry.
- `r` removes SkillMux's disabled managed copy and manifest records.
- `s` runs scan and updates manifest scan state.

## Architecture

The TUI is a presentation layer over the existing CLI behavior.

Proposed files:

```text
src/tui/
  app.tsx
  launch-tui.tsx
  load-dashboard-state.ts
  dashboard-model.ts
  actions.ts
  components/
    Dashboard.tsx
    AgentList.tsx
    SkillList.tsx
    DetailPane.tsx
    Footer.tsx
    HelpOverlay.tsx
    ConfirmDialog.tsx
    StatusLine.tsx
```

Component rules:

- Components receive view models and callbacks.
- Components do not read or write the filesystem.
- Filesystem and manifest behavior stays in existing command helpers.
- `actions.ts` dispatches `Space`, `a`, `r`, and `s` to existing `runX` functions.

The root state can follow this shape:

```ts
type DashboardState = {
  agents: TuiAgentRow[];
  skills: TuiSkillRow[];
  detail: DetailModel;
  focus: "agents" | "skills" | "detail";
  selectedAgentId: string | null;
  selectedSkillId: string | null;
  statusMessage: string | null;
  modal: ConfirmModal | HelpModal | null;
  busy: boolean;
};
```

## Technology Choice

Implementation should use Ink unless implementation planning finds a blocking reason not to.

Reasons:

- The project is already a TypeScript Node CLI.
- Ink supports persistent panels, overlays, and `useInput`.
- Existing async command helpers can be called directly.
- The dashboard is not a simple prompt flow, so Clack should not be the main UI layer.

The implementation stage must use the `terminal-ui` skill.

## TTY Behavior

`skillmux tui` must check whether it is running in an interactive terminal.

If stdin or stdout is not a TTY:

- do not launch the TUI
- return a clear error
- suggest using ordinary CLI commands such as `skillmux list`, `skillmux scan`, or `skillmux doctor`

This avoids ANSI escape leakage in piped or redirected output.

## Testing Strategy

The first implementation plan should test model and action logic before full terminal behavior.

Recommended tests:

- dashboard state loading with temporary `homeDir` and `skillmuxHome`
- row marker mapping for enabled, disabled, unmanaged, and issue states
- action dispatch for `Space`, `a`, `r`, and `s`
- non-TTY behavior for `skillmux tui`
- `skillmux tui --help`
- lightweight Ink render tests for panel titles, marker text, footer text, and status messages

Manual release checks:

- Windows Terminal at 80x24 and 120x40
- one Linux or macOS terminal if available
- `NO_COLOR=1`
- `Ctrl+C` restores terminal state
- redirected output does not launch the TUI

## Compatibility Requirements

The first version must:

- work at 80x24
- avoid crashing on resize
- remain usable with `NO_COLOR`
- use color only as reinforcement
- avoid mouse-only behavior
- allow `Ctrl+C` to exit cleanly
- avoid automatic filesystem writes on launch

## Non-Goals

The first version does not:

- fetch remote skills
- update remote skills
- replace `npx skills`
- edit custom agent config
- provide a full doctor dashboard
- stage multiple changes before apply
- auto-scan in the background
- change existing CLI semantics

## Open Follow-Ups

These are not required for the first implementation plan:

- Add a dedicated doctor view.
- Add a config editor for custom agents.
- Add a compact single-panel mode below 80 columns if needed.
- Add mouse support after keyboard behavior is stable.
- Add an ASCII-only marker mode if terminal compatibility requires it.

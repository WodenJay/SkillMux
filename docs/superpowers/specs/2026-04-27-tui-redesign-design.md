# SkillMux TUI Redesign — Design Spec

Date: 2026-04-27
Status: Approved

## 1. Goal

Redesign the SkillMux terminal UI to be visually polished, professional, and pleasant to use. The current TUI is functional but aesthetically rough — raw ANSI colors, no borders, no visual depth, minimal hierarchy cues.

## 2. Design Decisions

| Decision | Choice |
|---|---|
| Color theme | **Nord** (#2e3440 bg, #d8dee9 fg, #81a1c1 accent) |
| Border style | **Full box-drawing borders** on all panels |
| Header area | **Rich stats bar** (counts, issue count, last scan) |
| Selection highlight | **Colored bar highlight** using Nord accent |
| Skill markers | **Colored label tags** (ENABLED/DISABLED/UNMANAGED/ISSUE) |
| Modal dialogs | **Dimmed overlay + bordered popup** |
| Detail pane | **Styled key-value pairs** (bold accent labels) |
| Footer | **Bordered footer with shortcut chips** |

## 3. Visual Layout

```
┌─ Stats Bar ───────────────────────────────────────────────────────────────────────┐
│ ⚡ SkillMux    2 agents │ 5 enabled │ 2 disabled │ 1 unmanaged │ 1 issue │ 12:34   │
├─ Agents ──────────────────┬─ Skills / opencode ─────┬─ Detail ─────────────────────┤
│                           │                         │                             │
│  opencode              ●  │ ENABLED    find-skills  │ Name      clean-code        │
│ ▐█████████▌ claude        │ ▐█████████▌ clean-code  │ Status    enabled           │
│  codex                 ?  │ DISABLED   terminal-ui  │ Store     ...skills/cl…     │
│                           │ UNMANAGED  my-tool      │ Link      ...opencode/…     │
│                           │ ISSUE      bad-symlink  │                             │
│                           │                         │                             │
├─ Footer ──────────────────┴─────────────────────────┴─────────────────────────────┤
│ [q]uit  [/]search  [Space]toggle  [a]dopt  [n]ew  [d]octor  [?]help               │
│ ● enabled  ○ disabled  ? unmanaged  ! issue                                        │
└────────────────────────────────────────────────────────────────────────────────────┘
```

## 4. Color Palette (Nord)

### Semantic Slots
| Slot | Nord Color | Hex | Usage |
|---|---|---|---|
| `fg.default` | nord4 | `#d8dee9` | Body text |
| `fg.muted` | nord3 | `#4c566a` | Secondary text, metadata, dimmed |
| `fg.emphasis` | nord6 | `#eceff4` | Headers, focused items |
| `bg.base` | nord0 | `#2e3440` | Primary background |
| `bg.surface` | nord1 | `#3b4252` | Panel backgrounds |
| `bg.overlay` | nord1 | `#3b4252` | Modal backgrounds (same as surface) |
| `bg.selection` | nord9 | `#81a1c1` | Selected item highlight |
| `accent.primary` | nord9 | `#81a1c1` | Interactive elements, focus border |
| `accent.secondary` | nord15 | `#b48ead` | Secondary accent (purple) |
| `status.success` | nord14 | `#a3be8c` | Enabled, success (green) |
| `status.warning` | nord13 | `#ebcb8b` | Warnings, unmanaged (yellow) |
| `status.error` | nord11 | `#bf616a` | Errors, issues (red) |
| `status.info` | nord8 | `#88c0d0` | Informational (cyan) |
| `border.default` | nord3 | `#4c566a` | Inactive panel borders |
| `border.focused` | nord9 | `#81a1c1` | Focused panel border |

### 16-Color Fallback Mapping
For terminals that don't support 256/truecolor:
| Nord Slot | ANSI 16 Fallback |
|---|---|
| fg.default | White |
| fg.muted | DarkGray |
| fg.emphasis | BrightWhite |
| bg.base | Black |
| bg.selection | DarkBlue |
| accent.primary | DarkCyan |
| status.success | DarkGreen |
| status.warning | DarkYellow |
| status.error | DarkRed |

## 5. Component Specifications

### 5.1 StatusLine (Header)
- **Height:** 1 row + top border of panel layout
- **Content:** App title "⚡ SkillMux", agent count, enabled/disabled/unmanaged/issue counts, last scan time
- **Styling:** Bold white text on bg.surface. Counts colored by their semantic status color.
- **When busy:** Show spinner + "Scanning..." or "Adopting..." instead of stats

### 5.2 AgentList (Left Pane, ~26%)
- **Border:** Box-drawing border, accent color when focused, dimmed when unfocused
- **Header:** "Agents" in bold, inside the top border area or as first line
- **Rows:** Agent name + status indicator
  - Normal agent: Dimmed status dot ● (green)
  - Selected agent: Full-width colored highlight bar (bg.selection)
  - Missing/unsupported: Status indicator ● (yellow/red)
- **Scroll indicator:** When content overflows, show scroll percentage or arrow hints

### 5.3 SkillList (Center Pane, ~30%)
- **Border:** Box-drawing border, accent color when focused, dimmed when unfocused
- **Header:** "Skills / {agentName}" in bold
- **Rows:** Status label tag + skill name
  - ENABLED (green) — managed and symlinked
  - DISABLED (gray/dimmed) — managed but not symlinked
  - UNMANAGED (yellow) — exists in agent dir but not managed
  - ISSUE (red/yellow) — scan/doctor diagnostic issue
- **Selection:** Full-width colored highlight bar (bg.selection)

### 5.4 DetailPane (Right Pane, ~44%)
- **Border:** Box-drawing border, dimmed always
- **Header:** "Detail" in bold
- **Content:** Styled key-value pairs
  - Labels: Bold, accent.primary color
  - Values: Regular weight, fg.default
  - Truncated paths show "..." at start with full value accessible via tooltip/help
- **Empty state:** Dimmed "Select a skill or agent to view details"

### 5.5 Footer (Bottom Bar)
- **Height:** 3 rows within its own bordered section
- **Content:**
  - Row 1-2: Shortcut chips in dimmed text ([q]uit, [/]search, etc.)
  - Row 3: Legend (● enabled  ○ disabled  ? unmanaged  ! issue)
- **Border:** Bottom border of dashboard frame

### 5.6 Modals (Overlays)
- **Backdrop:** Full-screen dimmed overlay (bg.base with reduced opacity via dim characters)
- **Popup:** Centered bordered box with header, body, and footer areas
  - **FormDialog:** Form fields with accent highlight on active field
  - **ConfirmDialog:** Message + colored Y/N options
  - **DoctorDialog:** Scrollable issue list with severity-colored markers
  - **HelpOverlay:** Keybinding reference table
- **Focus trap:** Keyboard input only goes to modal when active

## 6. Interaction Model (No Changes from Current)
- All existing keybindings remain identical
- Vim-style navigation preserved (j/k, g/G, /)
- No functional behavior changes — purely visual

## 7. Responsive Behavior
- **Minimum terminal size:** 80x24 (existing)
- **Panel ratios:** Fixed 26% / 30% / 44% (existing, no change)
- **Resize handling:** Ink auto-remounts on resize (existing)
- **Below minimum:** Show resize warning message

## 8. Implementation Strategy

### Phase 1: Theme System
- Create `src/tui/theme.ts` with Nord semantic color definitions
- Add 16-color fallback detection (check COLORTERM, TERM env vars)
- Export a `Theme` type and `useTheme()` hook (or context)

### Phase 2: Component Restyling
- Update each component in order of visual impact:
  1. `Dashboard.tsx` — add box borders, background colors
  2. `AgentList.tsx` — colored selection highlight, status indicators
  3. `SkillList.tsx` — colored label tags, selection highlight
  4. `DetailPane.tsx` — styled key-value pairs
  5. `StatusLine.tsx` — rich stats bar
  6. `Footer.tsx` — bordered section with chips
  7. `FormDialog.tsx` / `ConfirmDialog.tsx` / `DoctorDialog.tsx` / `HelpOverlay.tsx` — dimmed overlay + bordered popup

### Phase 3: Polish
- Add scroll indicators where lists overflow
- Ensure color degradation works (test with NO_COLOR, 16-color)
- Verify no flicker on state changes

## 9. Non-Goals
- Changing the layout paradigm (stays 3-pane)
- Changing any keybindings or interaction model
- Adding animations/transitions (out of scope for this redesign)
- Nerd Font dependency (all characters must work with basic Unicode)
- Changing data flow or state management

## 10. Risks
- **Ink v7 API compatibility:** Ink's `color` prop only supports named colors, not hex. Actual color support may be limited. May need to use chalk or raw ANSI escapes for hex colors.
- **16-color degradation:** Nord's subtle shade differences may collapse in 16-color mode. The spec mandates a fallback mapping but actual appearance may be compromised.
- **Border rendering complexity:** Ink doesn't natively do box-drawing panel borders well. May require custom `<Text>` rendering.

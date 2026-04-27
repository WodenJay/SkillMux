# TUI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the SkillMux TUI with Nord theme, box-drawing borders, rich stats bar, colored selection highlights, and polished modal overlays.

**Architecture:** Create a `Theme` context/hook module (`src/tui/theme.ts`) with Nord semantic color slots and 16-color fallback detection. Modify all 10 TUI components to use theme colors instead of raw string colors, add box-drawing borders to the 3-pane dashboard, upgrade StatusLine to a rich stats bar, and add dimmed-overlay modals.

**Tech Stack:** TypeScript, React v19, Ink v7, Vitest + ink-testing-library

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/tui/theme.ts` | **CREATE** | Nord palette, semantic slots, color-level detection, `ThemeContext` / `useTheme()` |
| `src/tui/app.tsx` | **MODIFY** | Wrap content in `ThemeProvider`, pass `DashboardModel` to StatusLine for stats |
| `src/tui/components/Dashboard.tsx` | **MODIFY** | Add box borders, theme-based backgrounds, dimmed modal backdrop |
| `src/tui/components/StatusLine.tsx` | **MODIFY** | Rich stats bar: agent count, enabled/disabled/unmanaged/issue counts, last scan |
| `src/tui/components/Footer.tsx` | **MODIFY** | Bordered section, shortcut chips in theme colors, compact legend |
| `src/tui/components/AgentList.tsx` | **MODIFY** | Theme-based status markers, colored selection highlight |
| `src/tui/components/SkillList.tsx` | **MODIFY** | Colored label tags (ENABLED/DISABLED/UNMANAGED/ISSUE) instead of symbol markers |
| `src/tui/components/DetailPane.tsx` | **MODIFY** | Styled key-value pairs: bold accent labels |
| `src/tui/components/FormDialog.tsx` | **MODIFY** | Bordered popup with dimmed overlay support |
| `src/tui/components/ConfirmDialog.tsx` | **MODIFY** | Bordered popup with dimmed overlay support |
| `src/tui/components/DoctorDialog.tsx` | **MODIFY** | Bordered popup with dimmed overlay support |
| `src/tui/components/HelpOverlay.tsx` | **MODIFY** | Bordered popup with dimmed overlay support |

---

### Task 1: Theme System

**Files:**
- Create: `src/tui/theme.ts`
- Test: `src/tui/theme.test.ts` (create)

- [x] **Step 1: Create `src/tui/theme.ts` — Nord palette constants**

```typescript
// src/tui/theme.ts
import React from "react";

// ── Nord color constants (truecolor hex) ──
const nord0 = "#2e3440";
const nord1 = "#3b4252";
const nord2 = "#434c5e";
const nord3 = "#4c566a";
const nord4 = "#d8dee9";
const nord5 = "#e5e9f0";
const nord6 = "#eceff4";
const nord7 = "#8fbcbb";
const nord8 = "#88c0d0";
const nord9 = "#81a1c1";
const nord10 = "#5e81ac";
const nord11 = "#bf616a";
const nord12 = "#d08770";
const nord13 = "#ebcb8b";
const nord14 = "#a3be8c";
const nord15 = "#b48ead";
```

- [x] **Step 2: Add semantic color slots type and Nord theme object**

```typescript
// (append to same file after constants)

export interface Theme {
  fg: { default: string; muted: string; emphasis: string };
  bg: { base: string; surface: string; overlay: string; selection: string };
  accent: { primary: string; secondary: string };
  status: { success: string; warning: string; error: string; info: string };
  border: { default: string; focused: string };
}

const nordTheme: Theme = {
  fg: { default: nord4, muted: nord3, emphasis: nord6 },
  bg: { base: nord0, surface: nord1, overlay: nord1, selection: nord9 },
  accent: { primary: nord9, secondary: nord15 },
  status: { success: nord14, warning: nord13, error: nord11, info: nord8 },
  border: { default: nord3, focused: nord9 },
};

// 16-color fallback theme
const fallbackTheme: Theme = {
  fg: { default: "white", muted: "gray", emphasis: "white" },
  bg: { base: "black", surface: "black", overlay: "black", selection: "cyan" },
  accent: { primary: "cyan", secondary: "magenta" },
  status: { success: "green", warning: "yellow", error: "red", info: "cyan" },
  border: { default: "gray", focused: "cyan" },
};
```

- [x] **Step 3: Add color level detection and theme resolution**

```typescript
// (append to same file)

type ColorLevel = "truecolor" | "256" | "16" | "none";

function detectColorLevel(): ColorLevel {
  if (process.env.NO_COLOR !== undefined) return "none";
  const ct = process.env.COLORTERM;
  if (ct === "truecolor" || ct === "24bit") return "truecolor";
  const term = process.env.TERM ?? "";
  if (term.includes("256color")) return "256";
  return "16";
}

export function resolveTheme(): Theme {
  const level = detectColorLevel();
  if (level === "none" || level === "16") return fallbackTheme;
  return nordTheme;
}
```

- [x] **Step 4: Add React context and hook**

```typescript
// (append to same file)

const ThemeContext = React.createContext<Theme>(nordTheme);

export function useTheme(): Theme {
  return React.useContext(ThemeContext);
}

export const ThemeProvider = ThemeContext.Provider;
```

- [x] **Step 5: Run tests to verify the module works**

Run: `npx vitest run src/tui/theme.test.ts 2>&1`
Expected: FAIL (no test file yet — but TS compiles)

- [x] **Step 6: Create `src/tui/theme.test.ts`**

```typescript
// src/tui/theme.test.ts
import { describe, it, expect, vi } from "vitest";
import { resolveTheme } from "./theme";

describe("resolveTheme", () => {
  it("returns nord theme when COLORTERM=truecolor", () => {
    vi.stubEnv("COLORTERM", "truecolor");
    vi.stubEnv("NO_COLOR", undefined);
    vi.stubEnv("TERM", "xterm-256color");
    const theme = resolveTheme();
    expect(theme.fg.default).toBe("#d8dee9");
    expect(theme.accent.primary).toBe("#81a1c1");
  });

  it("returns nord theme when COLORTERM=24bit", () => {
    vi.stubEnv("COLORTERM", "24bit");
    vi.stubEnv("NO_COLOR", undefined);
    vi.stubEnv("TERM", "xterm");
    const theme = resolveTheme();
    expect(theme.fg.default).toBe("#d8dee9");
  });

  it("returns nord theme for 256color terminals", () => {
    vi.stubEnv("COLORTERM", undefined);
    vi.stubEnv("NO_COLOR", undefined);
    vi.stubEnv("TERM", "xterm-256color");
    const theme = resolveTheme();
    expect(theme.fg.default).toBe("#d8dee9");
  });

  it("returns fallback theme for 16-color terminals", () => {
    vi.stubEnv("COLORTERM", undefined);
    vi.stubEnv("NO_COLOR", undefined);
    vi.stubEnv("TERM", "xterm");
    const theme = resolveTheme();
    expect(theme.fg.default).toBe("white");
    expect(theme.accent.primary).toBe("cyan");
  });

  it("returns fallback theme when NO_COLOR is set", () => {
    vi.stubEnv("COLORTERM", "truecolor");
    vi.stubEnv("NO_COLOR", "1");
    vi.stubEnv("TERM", "xterm-256color");
    const theme = resolveTheme();
    expect(theme.fg.default).toBe("white");
  });
});
```

- [x] **Step 7: Run tests and verify they pass**

Run: `npx vitest run src/tui/theme.test.ts --configLoader runner`
Expected: PASS (5 tests)

- [x] **Step 8: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [x] **Step 9: Commit**

```
git add src/tui/theme.ts src/tui/theme.test.ts
git commit -m "feat: add Nord theme system with color level detection"
```

---

### Task 2: Rich Stats Bar (StatusLine)

**Files:**
- Modify: `src/tui/components/StatusLine.tsx`
- Modify: `src/tui/app.tsx:130-140` (add model to StatusLine props)

- [x] **Step 1: Update StatusLine props and implementation**

Replace `src/tui/components/StatusLine.tsx` entirely:

```typescript
import { Box, Text } from "ink";
import type { DashboardModel } from "../dashboard-model";
import { useTheme } from "../theme";

export type StatusLineProps = {
  busy: boolean;
  statusMessage: string | null;
  model: DashboardModel;
};

export function StatusLine({ busy, statusMessage, model }: StatusLineProps) {
  const theme = useTheme();

  if (busy) {
    return (
      <Box height={1}>
        <Text bold color={theme.status.info}>
          ⚡ SkillMux
        </Text>
        <Text color={theme.fg.muted}> · </Text>
        <Text color={theme.status.info}>{statusMessage ?? "scanning..."}</Text>
      </Box>
    );
  }

  const agentCount = model.agents.length;
  let enabled = 0;
  let disabled = 0;
  let unmanaged = 0;
  let issueCount = 0;
  for (const agent of model.agents) {
    enabled += agent.enabledCount;
    disabled += agent.disabledCount;
    unmanaged += agent.unmanagedCount;
    issueCount += agent.issueCount;
  }

  return (
    <Box height={1}>
      <Text bold color={theme.fg.emphasis}>
        ⚡ SkillMux
      </Text>
      <Text color={theme.fg.muted}> · </Text>
      <Text dimColor>
        {agentCount} agent{agentCount !== 1 ? "s" : ""}
      </Text>
      <Text color={theme.fg.muted}> │ </Text>
      <Text color={theme.status.success}>
        {enabled} enabled
      </Text>
      <Text color={theme.fg.muted}> │ </Text>
      <Text dimColor>
        {disabled} disabled
      </Text>
      <Text color={theme.fg.muted}> │ </Text>
      <Text color={theme.status.warning}>
        {unmanaged} unmanaged
      </Text>
      {issueCount > 0 ? (
        <>
          <Text color={theme.fg.muted}> │ </Text>
          <Text color={theme.status.error}>
            {issueCount} issue{issueCount !== 1 ? "s" : ""}
          </Text>
        </>
      ) : null}
      {model.lastScanAt ? (
        <>
          <Text color={theme.fg.muted}> │ </Text>
          <Text dimColor>Last scan: {model.lastScanAt}</Text>
        </>
      ) : null}
    </Box>
  );
}
```

- [x] **Step 2: Update Dashboard.tsx to pass model to StatusLine**

In `src/tui/components/Dashboard.tsx`, change the StatusLine call at line 134-139 from:

```typescript
      <StatusLine
        busy={state.busy}
        statusMessage={state.statusMessage}
        lastScanAt={state.model.lastScanAt}
        issueCount={state.model.issueCount}
      />
```

to:

```typescript
      <StatusLine
        busy={state.busy}
        statusMessage={state.statusMessage}
        model={state.model}
      />
```

- [x] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [x] **Step 4: Commit**

```
git add src/tui/components/StatusLine.tsx src/tui/components/Dashboard.tsx
git commit -m "feat: upgrade StatusLine to rich stats bar with counts"
```

---

### Task 3: Dashboard — Box Borders & Theme Provider

**Files:**
- Modify: `src/tui/components/Dashboard.tsx`
- Modify: `src/tui/app.tsx` (wrap with ThemeProvider)

- [x] **Step 1: Add ThemeProvider to app.tsx**

In `src/tui/app.tsx`, at the top of the file (line 2), add the import:

```typescript
import { resolveTheme, ThemeProvider } from "./theme";
```

Then find the `return` statement in the App component (around line 1265) and wrap the content. The current return looks like:

```typescript
  return (
    <Dashboard ... />
  );
```

Change it to:

```typescript
  const theme = useMemo(() => resolveTheme(), []);

  return (
    <ThemeProvider value={theme}>
      <Dashboard ... />
    </ThemeProvider>
  );
```

You'll also need to add `useMemo` to the react import at line 1:

```typescript
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
```

- [ ] **Step 2: Rewrite Dashboard.tsx — add box borders and theme backgrounds**

Replace `src/tui/components/Dashboard.tsx` entirely:

```typescript
import { Box, Text } from "ink";
import {
  getAvailableActions,
  getSelectedSkill,
  getVisibleAgents,
  getVisibleSkills,
  type TuiState
} from "../state";
import { useTheme } from "../theme";
import { AgentList } from "./AgentList";
import { ConfirmDialog, confirmDialogHeight } from "./ConfirmDialog";
import { DoctorDialog } from "./DoctorDialog";
import { DetailPane } from "./DetailPane";
import { Footer } from "./Footer";
import { HelpOverlay } from "./HelpOverlay";
import { FormDialog } from "./FormDialog";
import { SkillList } from "./SkillList";
import { StatusLine } from "./StatusLine";

export type DashboardModalInteraction = {
  fieldIndex: number;
  platformIndex: number;
  doctorScrollOffset: number;
};

export type DashboardProps = {
  state: TuiState;
  width: number;
  height: number;
  modalInteraction?: DashboardModalInteraction;
};

const minimumWidth = 80;
const minimumHeight = 24;
const agentRatio = 0.26;
const skillRatio = 0.3;
const detailRatio = 0.44;
const agentMinimumWidth = 20;
const skillMinimumWidth = 24;
const detailMinimumWidth = 28;
const largeModalWidth = 72;
const largeModalHeight = 14;

function paneWidths(width: number): {
  agentWidth: number;
  skillWidth: number;
  detailWidth: number;
} {
  const agentWidth = Math.max(agentMinimumWidth, Math.round(width * agentRatio));
  const skillWidth = Math.max(skillMinimumWidth, Math.round(width * skillRatio));
  const detailWidth = Math.max(
    detailMinimumWidth,
    Math.round(width * detailRatio)
  );
  const widthDelta = width - (agentWidth + skillWidth + detailWidth);

  if (widthDelta === 0) {
    return { agentWidth, skillWidth, detailWidth };
  }

  return {
    agentWidth,
    skillWidth,
    detailWidth: detailWidth + widthDelta
  };
}

function horizontalBorder(left: string, mid: string, right: string, ...widths: number[]): string {
  let line = left;
  for (let i = 0; i < widths.length; i++) {
    line += "─".repeat(widths[i]);
    if (i < widths.length - 1) line += mid;
  }
  line += right;
  return line;
}

export function Dashboard({
  state,
  width,
  height,
  modalInteraction
}: DashboardProps) {
  const theme = useTheme();
  const interaction = modalInteraction ?? {
    fieldIndex: 0,
    platformIndex: 0,
    doctorScrollOffset: 0
  };

  if (width < minimumWidth || height < minimumHeight) {
    return (
      <Box
        flexDirection="column"
        width={width}
        height={height}
        justifyContent="center"
        alignItems="center"
      >
        <Text dimColor>Terminal too small. Resize to at least 80x24.</Text>
      </Box>
    );
  }

  const visibleAgents = getVisibleAgents(state);
  const visibleSkills = getVisibleSkills(state);
  const selectedAgent =
    state.model.agents.find((agent) => agent.id === state.model.selectedAgentId) ??
    null;
  const selectedSkill = getSelectedSkill(state);
  const loadingAgentName =
    state.pendingAgentId ??
    (state.busy && state.statusMessage === "loading agent..."
      ? state.model.selectedAgentId
      : null);
  const loadingAgent =
    loadingAgentName === null
      ? null
      : state.model.agents.find((agent) => agent.id === loadingAgentName) ?? null;
  const actions = getAvailableActions(state);
  const footerHeight = 3;
  const largeModal =
    state.modal?.kind === "add-agent" ||
    state.modal?.kind === "edit-agent" ||
    state.modal?.kind === "import" ||
    state.modal?.kind === "doctor" ||
    state.modal?.kind === "confirm-remove-agent";
  const overlayHeight =
    largeModal
      ? 0
      : state.modal?.kind === "help"
      ? 8
      : state.modal?.kind === "confirm-adopt" ||
          state.modal?.kind === "confirm-adopt-all" ||
          state.modal?.kind === "confirm-remove"
        ? confirmDialogHeight
      : 0;
  const footerSpace =
    state.modal === null ? footerHeight : largeModal ? 0 : footerHeight;
  const bodyHeight = Math.max(height - 1 - footerSpace - overlayHeight, 0);
  const { agentWidth, skillWidth, detailWidth } = paneWidths(width);
  const modalWidth = Math.min(width - 4, largeModalWidth);
  const modalHeight = Math.min(bodyHeight, largeModalHeight);

  const hasModalDimmedBackground = !largeModal && state.modal !== null;
  const agentFocused = state.focus === "agents";
  const skillFocused = state.focus === "skills";

  return (
    <Box flexDirection="column" width={width} height={height}>
      <StatusLine
        busy={state.busy}
        statusMessage={state.statusMessage}
        model={state.model}
      />

      {/* Top border of panel row */}
      <Text color={theme.border.default}>
        {horizontalBorder("├", "┬", "┤", agentWidth, skillWidth, detailWidth)}
      </Text>

      {largeModal ? (
        <Box
          flexDirection="column"
          width={width}
          height={bodyHeight}
          justifyContent="center"
          alignItems="center"
        >
          <Box width={modalWidth} height={modalHeight}>
            {state.modal?.kind === "add-agent" || state.modal?.kind === "edit-agent" || state.modal?.kind === "import" ? (
              <FormDialog
                modal={state.modal}
                fieldIndex={interaction.fieldIndex}
                platformIndex={interaction.platformIndex}
                width={modalWidth}
                height={modalHeight}
              />
            ) : state.modal?.kind === "doctor" ? (
              <DoctorDialog
                modal={state.modal}
                scrollOffset={interaction.doctorScrollOffset}
                width={modalWidth}
                height={modalHeight}
              />
            ) : state.modal?.kind === "confirm-remove-agent" ? (
              <ConfirmDialog modal={state.modal} />
            ) : null}
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column" width={width} height={bodyHeight}>
          {/* Content row with vertical separators */}
          <Box flexDirection="row" width={width} height={bodyHeight}>
            <AgentList
              agents={visibleAgents}
              selectedAgentId={state.model.selectedAgentId}
              focused={agentFocused}
              searchQuery={state.search?.panel === "agents" ? state.search.query : undefined}
              width={agentWidth}
              height={bodyHeight}
            />
            <Text color={agentFocused ? theme.border.focused : theme.border.default}>│</Text>
            <SkillList
              agentId={state.model.selectedAgentId}
              skills={visibleSkills}
              selectedSkillId={state.model.selectedSkillId}
              focused={skillFocused}
              searchQuery={state.search?.panel === "skills" ? state.search.query : undefined}
              loadingAgentName={loadingAgent?.name ?? null}
              width={skillWidth}
              height={bodyHeight}
            />
            <Text color={skillFocused ? theme.border.focused : theme.border.default}>│</Text>
            <DetailPane
              selectedAgent={selectedAgent}
              selectedSkill={selectedSkill}
              focused={state.focus === "detail"}
              loadingAgentName={loadingAgent?.name ?? null}
              width={detailWidth}
              height={bodyHeight}
            />
          </Box>
        </Box>
      )}

      {/* Bottom border of panel row */}
      <Text color={theme.border.default}>
        {horizontalBorder("├", "┴", "┤", agentWidth, skillWidth, detailWidth)}
      </Text>

      {state.modal?.kind === "help" ? <HelpOverlay /> : null}
      {state.modal?.kind === "confirm-adopt" ||
      state.modal?.kind === "confirm-adopt-all" ||
      state.modal?.kind === "confirm-remove" ||
      state.modal?.kind === "confirm-discard-dirty-form" ? (
        <ConfirmDialog modal={state.modal} />
      ) : null}
      {state.modal === null ? (
        <Footer actions={actions} search={state.search} />
      ) : largeModal ? null : (
        <Box height={3} />
      )}
    </Box>
  );
}
```

- [x] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [x] **Step 4: Commit**

```
git add src/tui/components/Dashboard.tsx src/tui/app.tsx
git commit -m "feat: add box-drawing borders and ThemeProvider to Dashboard"
```

---

### Task 4: AgentList — Theme Colors & Selection Highlight

**Files:**
- Modify: `src/tui/components/AgentList.tsx`

- [x] **Step 1: Rewrite AgentList.tsx with theme**

Replace `src/tui/components/AgentList.tsx` entirely:

```typescript
import { Box, Text } from "ink";
import type { TuiAgentRow } from "../dashboard-model";
import { useTheme } from "../theme";

export type AgentListProps = {
  agents: TuiAgentRow[];
  selectedAgentId: string | null;
  focused: boolean;
  searchQuery?: string;
  width?: number;
  height?: number;
};

function statusColor(agent: TuiAgentRow, theme: ReturnType<typeof useTheme>): string {
  if (!agent.supported) return theme.status.error;
  if (!agent.exists || agent.issueCount > 0) return theme.status.warning;
  return theme.status.success;
}

function statusLabel(agent: TuiAgentRow): string {
  if (!agent.supported) return "!";
  if (!agent.exists) return "?";
  if (agent.issueCount > 0) return "*";
  return "*";
}

export function AgentList({
  agents,
  selectedAgentId,
  focused,
  searchQuery,
  width = 24,
  height = 18
}: AgentListProps) {
  const theme = useTheme();
  const emptyMessage =
    searchQuery !== undefined && searchQuery.trim().length > 0
      ? "No matching agents"
      : "No agents found";

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Text bold color={focused ? theme.fg.emphasis : theme.fg.muted}>
        Agents
      </Text>
      {agents.length === 0 ? (
        <Text dimColor>{emptyMessage}</Text>
      ) : (
        agents.map((agent) => {
          const selected = agent.id === selectedAgentId && focused;
          const prefix = selected ? ">" : " ";

          return (
            <Text key={agent.id}>
              <Text backgroundColor={selected ? theme.bg.selection : undefined}>
                <Text color={statusColor(agent, theme)}>{statusLabel(agent)}</Text>
                <Text color={selected ? theme.fg.emphasis : theme.fg.default}>
                  {" "}
                  {prefix} {agent.name}
                </Text>
              </Text>
            </Text>
          );
        })
      )}
    </Box>
  );
}
```

- [x] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [x] **Step 3: Commit**

```
git add src/tui/components/SkillList.tsx
git commit -m "feat: SkillList uses colored label tags instead of symbol markers"
```

---

### Task 6: DetailPane — Styled Key-Value Pairs

**Files:**
- Modify: `src/tui/components/DetailPane.tsx`

- [x] **Step 1: Rewrite DetailPane.tsx with theme**

Replace `src/tui/components/DetailPane.tsx` entirely:

```typescript
import { Box, Text } from "ink";
import type { TuiAgentRow, TuiSkillRow } from "../dashboard-model";
import { useTheme } from "../theme";

export type DetailPaneProps = {
  selectedAgent: TuiAgentRow | null;
  selectedSkill: TuiSkillRow | null;
  focused: boolean;
  loadingAgentName?: string | null;
  width?: number;
  height?: number;
};

type DetailLine = {
  label: string;
  value: string;
  compact: boolean;
};

function compactPath(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const separator = value.includes("\\") ? "\\" : "/";
  const parts = value.split(/[\\/]+/).filter((part) => part.length > 0);
  let suffix = parts.at(-1) ?? value;
  for (let index = parts.length - 2; index >= 0; index -= 1) {
    const candidate = `${parts[index]}${separator}${suffix}`;
    if (`...${separator}${candidate}`.length > maxLength) break;
    suffix = candidate;
  }
  const shortened = `...${separator}${suffix}`;
  if (shortened.length <= maxLength) return shortened;
  if (maxLength <= 3) return ".".repeat(maxLength);
  return `...${suffix.slice(-(maxLength - 3))}`;
}

function detailLines(skill: TuiSkillRow): DetailLine[] {
  if (skill.kind === "enabled") {
    return [
      { label: "Name", value: skill.name, compact: false },
      { label: "Status", value: "enabled", compact: false },
      { label: "Store", value: skill.path, compact: true },
      { label: "Link", value: skill.activationLinkPath, compact: true }
    ];
  }
  if (skill.kind === "disabled") {
    return [
      { label: "Name", value: skill.name, compact: false },
      { label: "Status", value: "disabled", compact: false },
      { label: "Store", value: skill.path, compact: true },
      {
        label: "Link",
        value: skill.activationLinkPath ?? "not linked",
        compact: skill.activationLinkPath !== null
      }
    ];
  }
  if (skill.kind === "unmanaged") {
    return [
      { label: "Name", value: skill.name, compact: false },
      { label: "Status", value: "unmanaged", compact: false },
      { label: "Entry", value: skill.entryKind, compact: false },
      { label: "Path", value: skill.path, compact: true }
    ];
  }
  return [
    { label: "Status", value: "issue", compact: false },
    { label: "Code", value: skill.issueCode, compact: false },
    { label: "Severity", value: skill.severity, compact: false },
    { label: "Message", value: skill.message, compact: false },
    { label: "Path", value: skill.path ?? "none", compact: skill.path !== null }
  ];
}

export function DetailPane({
  selectedAgent,
  selectedSkill,
  focused: _focused,
  loadingAgentName = null,
  width = 28,
  height = 18
}: DetailPaneProps) {
  const theme = useTheme();

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Text bold color={theme.fg.emphasis}>
        Detail
      </Text>
      {selectedAgent === null ? (
        <Text dimColor>Select an agent</Text>
      ) : (
        <Text color={theme.fg.muted}>Agent: {selectedAgent.name}</Text>
      )}
      {selectedSkill === null ? (
        loadingAgentName !== null ? (
          <Text dimColor>Loading details for {loadingAgentName}...</Text>
        ) : (
          <Text dimColor>Select a skill row</Text>
        )
      ) : (
        detailLines(selectedSkill).map(({ label, value, compact }) => {
          const valueWidth = Math.max(width - (label.length + 2), 8);
          const renderedValue = compact ? compactPath(value, valueWidth) : value;

          return (
            <Text key={label}>
              <Text bold color={theme.accent.primary}>
                {label}:{" "}
              </Text>
              <Text color={theme.fg.default}>{renderedValue}</Text>
            </Text>
          );
        })
      )}
    </Box>
  );
}
```

- [x] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [x] **Step 3: Commit**

```
git add src/tui/components/DetailPane.tsx
git commit -m "feat: DetailPane uses bold accent labels for key-value pairs"
```

---

### Task 7: Footer — Bordered Section with Shortcut Chips

**Files:**
- Modify: `src/tui/components/Footer.tsx`

- [x] **Step 1: Rewrite Footer.tsx with theme**

Replace `src/tui/components/Footer.tsx` entirely:

```typescript
import { Box, Text } from "ink";
import type { TuiAvailableActions, TuiSearch } from "../state";
import { useTheme } from "../theme";

export type FooterProps = {
  actions: TuiAvailableActions;
  search: TuiSearch | null;
};

export function Footer({ actions, search }: FooterProps) {
  const theme = useTheme();

  const shortcuts = [
    actions.addAgent ? "[n]add agent" : null,
    actions.editAgent ? "[e]edit agent" : null,
    actions.removeAgent ? "[X]remove agent" : null,
    actions.importSkill ? "[i]import" : null,
    actions.doctor ? "[d]doctor" : null,
    "←→ focus",
    actions.toggle ? "[Space]toggle" : null,
    actions.adopt ? "[a]adopt" : null,
    actions.adoptAll ? "[Shift+A]adopt all" : null,
    actions.remove ? "[r]remove" : null,
    actions.scan ? "[s]scan" : null,
    actions.help ? "[?]help" : null,
    "[q]quit"
  ].filter((shortcut): shortcut is string => shortcut !== null);

  const legendParts = [
    { label: "enabled", color: theme.status.success },
    { label: "disabled", color: theme.fg.muted },
    { label: "unmanaged", color: theme.status.warning },
    { label: "issue", color: theme.status.error },
  ];

  if (search !== null) {
    return (
      <Box flexDirection="column" height={3}>
        <Text>
          <Text color={theme.accent.primary}>/</Text>
          <Text color={theme.fg.default}>{search.query}</Text>
          <Text dimColor>   [Enter]keep   [Esc]cancel</Text>
        </Text>
        <Text dimColor>
          {legendParts.map((p, i) => (
            <Text key={p.label}>
              <Text color={p.color}>{p.label}</Text>
              {i < legendParts.length - 1 ? "  " : ""}
            </Text>
          ))}
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height={3}>
      <Text dimColor>{shortcuts.join("   ")}</Text>
      <Text dimColor>
        SkillMux · [j/k]move · [g/G]top/bottom · [/]search
      </Text>
      <Text dimColor>
        {legendParts.map((p, i) => (
          <Text key={p.label}>
            <Text color={p.color}>{p.label}</Text>
            {i < legendParts.length - 1 ? " · " : ""}
          </Text>
        ))}
      </Text>
    </Box>
  );
}
```

- [x] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [x] **Step 3: Commit**

```
git add src/tui/components/Footer.tsx
git commit -m "feat: Footer uses theme colors and compact shortcut layout"
```

---

### Task 8: Modal Dialogs — Bordered Popups

**Files:**
- Modify: `src/tui/components/FormDialog.tsx`
- Modify: `src/tui/components/ConfirmDialog.tsx`
- Modify: `src/tui/components/DoctorDialog.tsx`
- Modify: `src/tui/components/HelpOverlay.tsx`

- [x] **Step 1: Rewrite FormDialog.tsx — bordered with theme**

Replace `src/tui/components/FormDialog.tsx` entirely:

```typescript
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import type { TuiModal } from "../state";
import { useTheme } from "../theme";

export type FormDialogModal = Extract<
  TuiModal,
  { kind: "add-agent" } | { kind: "edit-agent" } | { kind: "import" }
>;

export type FormDialogProps = {
  modal: FormDialogModal;
  fieldIndex?: number;
  platformIndex?: number;
  width?: number;
  height?: number;
};

const platformOptions = ["win32", "linux", "darwin"] as const;

function checkbox(value: boolean): string {
  return value ? "[x]" : "[ ]";
}

function renderTextField(
  label: string,
  value: string,
  active: boolean,
  theme: ReturnType<typeof useTheme>
): ReactElement {
  return (
    <Text key={label}>
      {active ? (
        <Text backgroundColor={theme.bg.selection}>
          <Text bold color={theme.fg.emphasis}>{label}: </Text>
          <Text color={theme.fg.emphasis}>{value.length > 0 ? value : " "}</Text>
        </Text>
      ) : (
        <>
          <Text bold color={theme.accent.primary}>{label}: </Text>
          <Text color={theme.fg.default}>{value.length > 0 ? value : " "}</Text>
        </>
      )}
    </Text>
  );
}

function renderBooleanField(
  label: string,
  value: boolean,
  active: boolean,
  theme: ReturnType<typeof useTheme>
): ReactElement {
  return (
    <Text key={label}>
      {active ? (
        <Text backgroundColor={theme.bg.selection}>
          <Text bold color={theme.fg.emphasis}>{label}: </Text>
          <Text color={theme.fg.emphasis}>{checkbox(value)}</Text>
        </Text>
      ) : (
        <>
          <Text bold color={theme.accent.primary}>{label}: </Text>
          <Text color={theme.fg.default}>{checkbox(value)}</Text>
        </>
      )}
    </Text>
  );
}

function renderPlatformField(
  selectedPlatforms: string[],
  activePlatformIndex: number,
  active: boolean,
  theme: ReturnType<typeof useTheme>
): ReactElement[] {
  return platformOptions.map((platform, index) => {
    const selected = selectedPlatforms.includes(platform);
    const isCurrent = active && index === activePlatformIndex;

    return (
      <Text key={platform}>
        {isCurrent ? (
          <Text backgroundColor={theme.bg.selection}>
            <Text color={theme.fg.emphasis}>{"> "}{checkbox(selected)} {platform}</Text>
          </Text>
        ) : (
          <Text color={selected ? theme.status.success : theme.fg.muted}>
            {"  "}{checkbox(selected)} {platform}
          </Text>
        )}
      </Text>
    );
  });
}

export function FormDialog({
  modal,
  fieldIndex = 0,
  platformIndex = 0,
  width = 72,
  height = 14
}: FormDialogProps) {
  const theme = useTheme();
  const activeField = fieldIndex;

  if (modal.kind === "import") {
    const submitFieldIndex = 2;
    return (
      <Box flexDirection="column" width={width} height={height}>
        <Box borderStyle="single" borderColor={theme.border.focused} flexDirection="column" paddingX={2}>
          <Text bold color={theme.fg.emphasis}>Import skill</Text>
          {modal.form.error === null ? null : <Text color={theme.status.error}>{modal.form.error}</Text>}
          {renderTextField("Source path", modal.form.values.sourcePath, activeField === 0, theme)}
          {renderTextField("Skill name", modal.form.values.skillName, activeField === 1, theme)}
          <Text>
            {activeField === submitFieldIndex ? (
              <Text backgroundColor={theme.bg.selection}>
                <Text bold color={theme.fg.emphasis}>Submit</Text>
              </Text>
            ) : (
              <Text bold color={theme.accent.primary}>Submit</Text>
            )}
          </Text>
          <Text dimColor>[Up/Down] move   [Enter] submit   [Esc] cancel</Text>
        </Box>
      </Box>
    );
  }

  const title =
    modal.kind === "add-agent" ? "Add agent" : `Edit agent ${modal.agentId}`;
  const fields =
    modal.kind === "add-agent"
      ? [
          renderTextField("Agent id", modal.form.values.id, activeField === 0, theme),
          renderTextField("Root path", modal.form.values.root, activeField === 1, theme),
          renderTextField("Skills path", modal.form.values.skills, activeField === 2, theme),
          renderTextField("Display name", modal.form.values.name, activeField === 3, theme)
        ]
      : [
          renderTextField("Root path", modal.form.values.root, activeField === 0, theme),
          renderTextField("Skills path", modal.form.values.skills, activeField === 1, theme),
          renderTextField("Display name", modal.form.values.name, activeField === 2, theme)
        ];

  const platformFieldIndex = modal.kind === "add-agent" ? 4 : 3;
  const booleanFieldIndex = modal.kind === "add-agent" ? 5 : 4;
  const submitFieldIndex = 6;
  const platformLines = renderPlatformField(
    modal.form.values.platforms,
    platformIndex,
    activeField === platformFieldIndex,
    theme
  );
  const booleanLabel =
    modal.kind === "add-agent" ? "Disabled by default" : "Enabled by default";
  const booleanValue =
    modal.kind === "add-agent"
      ? modal.form.values.disabledByDefault
      : modal.form.values.enabledByDefault;
  const secondaryBooleanLabel =
    modal.kind === "add-agent" ? null : "Disabled by default";

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Box borderStyle="single" borderColor={theme.border.focused} flexDirection="column" paddingX={2}>
        <Text bold color={theme.fg.emphasis}>{title}</Text>
        {modal.form.error === null ? null : <Text color={theme.status.error}>{modal.form.error}</Text>}
        {fields}
        <Text>
          {activeField === platformFieldIndex ? (
            <Text backgroundColor={theme.bg.selection}>
              <Text bold color={theme.fg.emphasis}>Platforms</Text>
            </Text>
          ) : (
            <Text bold color={theme.accent.primary}>Platforms</Text>
          )}
        </Text>
        {platformLines}
        {renderBooleanField(booleanLabel, booleanValue, activeField === booleanFieldIndex, theme)}
        {secondaryBooleanLabel === null
          ? null
          : renderBooleanField(
              secondaryBooleanLabel,
              modal.form.values.disabledByDefault,
              activeField === booleanFieldIndex + 1,
              theme
            )}
        <Text>
          {activeField === submitFieldIndex ? (
            <Text backgroundColor={theme.bg.selection}>
              <Text bold color={theme.fg.emphasis}>Submit</Text>
            </Text>
          ) : (
            <Text bold color={theme.accent.primary}>Submit</Text>
          )}
        </Text>
        {modal.kind === "edit-agent" ? (
          <Text dimColor>Leaving both defaults unchecked preserves the current setting.</Text>
        ) : null}
        <Text dimColor>[Up/Down] move   [Enter] submit   [Esc] cancel</Text>
      </Box>
    </Box>
  );
}
```

- [x] **Step 2: Rewrite ConfirmDialog.tsx — bordered with theme**

Replace `src/tui/components/ConfirmDialog.tsx` entirely:

```typescript
import { Box, Text } from "ink";
import type { TuiModal } from "../state";
import { useTheme } from "../theme";

export type ConfirmDialogProps = {
  modal: Extract<
    TuiModal,
    | { kind: "confirm-adopt" }
    | { kind: "confirm-adopt-all" }
    | { kind: "confirm-remove" }
    | { kind: "confirm-remove-agent" }
    | { kind: "confirm-discard-dirty-form" }
  >;
};

export const confirmDialogHeight = 4;

function confirmationText(modal: ConfirmDialogProps["modal"]): string {
  if (modal.kind === "confirm-adopt") return `Adopt ${modal.skillId} for ${modal.agentId}?`;
  if (modal.kind === "confirm-adopt-all") return `Adopt all unmanaged skills for ${modal.agentId}?`;
  if (modal.kind === "confirm-remove-agent") return `Remove agent override for ${modal.agentId}?`;
  if (modal.kind === "confirm-discard-dirty-form") return "Discard unsaved changes?";
  return `Remove ${modal.skillId} from SkillMux?`;
}

function confirmationDetails(modal: ConfirmDialogProps["modal"]): string | null {
  if (modal.kind !== "confirm-adopt-all") {
    if (modal.kind === "confirm-remove-agent") return "This will remove the selected agent override from SkillMux.";
    if (modal.kind === "confirm-discard-dirty-form") return "This will close the form and discard the current changes.";
    return null;
  }
  return `${modal.unmanagedCount} unmanaged skills will be moved under SkillMux management.`;
}

export function ConfirmDialog({ modal }: ConfirmDialogProps) {
  const theme = useTheme();
  const isRemove = modal.kind === "confirm-remove" || modal.kind === "confirm-remove-agent";
  const titleColor = isRemove ? theme.status.warning : theme.status.info;

  return (
    <Box flexDirection="column" height={confirmDialogHeight}>
      <Box borderStyle="single" borderColor={titleColor} flexDirection="column" paddingX={2}>
        <Text bold color={titleColor}>Confirm</Text>
        <Text color={theme.fg.default}>{confirmationText(modal)}</Text>
        {confirmationDetails(modal) === null ? null : <Text dimColor>{confirmationDetails(modal)}</Text>}
        <Text>
          <Text bold color={theme.status.success}>[y] confirm</Text>
          <Text dimColor>   </Text>
          <Text dimColor>[Esc] cancel</Text>
        </Text>
      </Box>
    </Box>
  );
}
```

- [x] **Step 3: Rewrite DoctorDialog.tsx — bordered with theme**

Replace `src/tui/components/DoctorDialog.tsx` entirely:

```typescript
import { Box, Text } from "ink";
import type { DoctorModal } from "../state";
import { useTheme } from "../theme";

export type DoctorDialogProps = {
  modal: DoctorModal;
  scrollOffset?: number;
  width?: number;
  height?: number;
};

type DoctorIssue = NonNullable<Extract<DoctorModal, { status: "ready" }>["report"]["issues"]>[number];

function issueLabel(issue: DoctorIssue): string {
  return `${issue.severity} ${issue.code}`;
}

function visibleIssueCount(height: number): number {
  return Math.max(height - 5, 1);
}

export function DoctorDialog({
  modal,
  scrollOffset = 0,
  width = 72,
  height = 14
}: DoctorDialogProps) {
  const theme = useTheme();

  if (modal.status === "loading") {
    return (
      <Box flexDirection="column" width={width} height={height}>
        <Box borderStyle="single" borderColor={theme.border.focused} flexDirection="column" paddingX={2}>
          <Text bold color={theme.fg.emphasis}>Doctor</Text>
          <Text color={theme.fg.muted}>Loading doctor diagnostics...</Text>
          <Text dimColor>[Esc] close</Text>
        </Box>
      </Box>
    );
  }

  if (modal.status === "error") {
    return (
      <Box flexDirection="column" width={width} height={height}>
        <Box borderStyle="single" borderColor={theme.status.error} flexDirection="column" paddingX={2}>
          <Text bold color={theme.fg.emphasis}>Doctor</Text>
          <Text color={theme.status.error}>{modal.errorMessage}</Text>
          <Text dimColor>[Esc] close</Text>
        </Box>
      </Box>
    );
  }

  const issues = modal.report.issues;
  const maxIssues = visibleIssueCount(height);
  const maxOffset = Math.max(issues.length - maxIssues, 0);
  const clampedOffset = Math.min(Math.max(scrollOffset, 0), maxOffset);
  const visibleIssues = issues.slice(clampedOffset, clampedOffset + maxIssues);

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Box borderStyle="single" borderColor={theme.border.focused} flexDirection="column" paddingX={2}>
        <Text bold color={theme.fg.emphasis}>Doctor</Text>
        <Text dimColor>
          {issues.length === 0 ? "No doctor issues found." : `${issues.length} issue(s) found`}
        </Text>
        {issues.length === 0 ? null : (
          <>
            {visibleIssues.map((issue) => (
              <Text key={`${issue.code}:${issue.path ?? issue.message}`}>
                <Text color={issue.severity === "error" ? theme.status.error : theme.status.warning}>
                  !{" "}
                </Text>
                <Text color={theme.fg.default}>
                  {issueLabel(issue)} - {issue.message}
                  {issue.path ? ` - ${issue.path}` : ""}
                </Text>
              </Text>
            ))}
            {issues.length > visibleIssues.length ? (
              <Text dimColor>
                Showing {clampedOffset + 1}-{clampedOffset + visibleIssues.length} of {issues.length}
              </Text>
            ) : null}
          </>
        )}
        <Text dimColor>[Up/Down] scroll   [Esc] close</Text>
      </Box>
    </Box>
  );
}
```

- [x] **Step 4: Rewrite HelpOverlay.tsx — bordered with theme**

Replace `src/tui/components/HelpOverlay.tsx` entirely:

```typescript
import { Box, Text } from "ink";
import { useTheme } from "../theme";

export function HelpOverlay() {
  const theme = useTheme();

  return (
    <Box flexDirection="column" height={8}>
      <Box borderStyle="single" borderColor={theme.border.focused} flexDirection="column" paddingX={2}>
        <Text bold color={theme.fg.emphasis}>Help</Text>
        <Text color={theme.fg.default}>
          <Text bold color={theme.accent.primary}>Navigation</Text>
          <Text>: Left/Right switch panels, j/k or Up/Down move, g/G jump.</Text>
        </Text>
        <Text color={theme.fg.default}>
          <Text bold color={theme.accent.primary}>Actions</Text>
          <Text>: Space toggles, a adopts, Shift+A bulk adopt, r removes, s scans, n add agent, e edit override, X remove override, i import, d doctor.</Text>
        </Text>
        <Text color={theme.fg.default}>
          <Text bold color={theme.accent.primary}>Search</Text>
          <Text>: / filters the focused list, Enter keeps the result, Esc cancels.</Text>
        </Text>
        <Text color={theme.fg.default}>
          <Text bold color={theme.accent.primary}>Markers</Text>
          <Text>: </Text>
          <Text bold color={theme.status.success}>ENABLED</Text>
          <Text> </Text>
          <Text color={theme.fg.muted}>DISABLED</Text>
          <Text> </Text>
          <Text color={theme.status.warning}>UNMANAGED</Text>
          <Text> </Text>
          <Text color={theme.status.error}>ISSUE</Text>
        </Text>
        <Text color={theme.fg.default}>
          <Text bold color={theme.accent.primary}>Safety</Text>
          <Text>: Toggle, adopt, remove, and scan can update SkillMux state and agent links.</Text>
        </Text>
      </Box>
    </Box>
  );
}
```

- [x] **Step 5: Run typecheck on all changed files**

Run: `npx tsc --noEmit`
Expected: No errors across all files

- [x] **Step 6: Commit**

```
git add src/tui/components/FormDialog.tsx src/tui/components/ConfirmDialog.tsx src/tui/components/DoctorDialog.tsx src/tui/components/HelpOverlay.tsx
git commit -m "feat: modal dialogs use bordered popups with theme colors"
```

---

### Task 9: Final Polish & Integration Test

**Files:**
- Modify: `src/tui/app.tsx` (verify ThemeProvider is correctly placed)

- [x] **Step 1: Verify app.tsx wraps correctly with ThemeProvider**

Check `src/tui/app.tsx` — ensure the main render return is:

```typescript
  const theme = useMemo(() => resolveTheme(), []);

  return (
    <ThemeProvider value={theme}>
      <Dashboard ... />
    </ThemeProvider>
  );
```

And that `React, useMemo` are imported.

- [x] **Step 2: Run full typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [x] **Step 3: Run unit/component tests**

Run: `npx vitest run --configLoader runner`
Expected: All existing tests still pass

- [x] **Step 4: Run TUI E2E regression tests**

Run: `node scripts/run-tui-e2e.mjs regression`
Expected: Regression tests pass (rendering may look slightly different due to new borders — review output)

- [x] **Step 5: Commit**

```
git add -A
git commit -m "chore: final integration polish for TUI redesign"
```

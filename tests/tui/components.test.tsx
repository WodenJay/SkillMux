import React from "react";
import { renderToString } from "ink";
import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import { App } from "../../src/tui/app";
import { AgentList } from "../../src/tui/components/AgentList";
import { Dashboard } from "../../src/tui/components/Dashboard";
import { ConfirmDialog } from "../../src/tui/components/ConfirmDialog";
import { DetailPane } from "../../src/tui/components/DetailPane";
import { Footer } from "../../src/tui/components/Footer";
import { HelpOverlay } from "../../src/tui/components/HelpOverlay";
import { SkillList } from "../../src/tui/components/SkillList";
import { StatusLine } from "../../src/tui/components/StatusLine";
import type {
  DashboardModel,
  TuiAgentRow,
  TuiDisabledSkillRow,
  TuiEnabledSkillRow,
  TuiUnmanagedSkillRow
} from "../../src/tui/dashboard-model";
import {
  createInitialTuiState,
  updateTuiState,
  type TuiState
} from "../../src/tui/state";

function agent(overrides: Partial<TuiAgentRow> = {}): TuiAgentRow {
  return {
    id: "codex",
    name: "codex",
    path: "C:\\Users\\me\\.codex\\skills",
    discovery: "builtin",
    exists: true,
    supported: true,
    enabledCount: 1,
    disabledCount: 1,
    unmanagedCount: 1,
    issueCount: 0,
    ...overrides
  };
}

function enabledSkill(
  overrides: Partial<TuiEnabledSkillRow> = {}
): TuiEnabledSkillRow {
  return {
    id: "using-superpowers",
    kind: "enabled",
    marker: "●",
    skillId: "using-superpowers",
    name: "using-superpowers",
    path: "C:\\Users\\me\\.skillmux\\skills\\using-superpowers",
    agentId: "codex",
    activationLinkPath: "C:\\Users\\me\\.codex\\skills\\using-superpowers",
    ...overrides
  };
}

function disabledSkill(
  overrides: Partial<TuiDisabledSkillRow> = {}
): TuiDisabledSkillRow {
  return {
    id: "terminal-ui",
    kind: "disabled",
    marker: "○",
    skillId: "terminal-ui",
    name: "terminal-ui",
    path: "C:\\Users\\me\\.skillmux\\skills\\terminal-ui",
    agentId: "codex",
    activationLinkPath: null,
    ...overrides
  };
}

function unmanagedSkill(
  overrides: Partial<TuiUnmanagedSkillRow> = {}
): TuiUnmanagedSkillRow {
  return {
    id: "unmanaged:find-skills",
    kind: "unmanaged",
    marker: "?",
    skillName: "find-skills",
    name: "find-skills",
    path: "C:\\Users\\me\\.codex\\skills\\find-skills",
    agentId: "codex",
    entryKind: "unmanaged-directory",
    ...overrides
  };
}

function model(overrides: Partial<DashboardModel> = {}): DashboardModel {
  const skills = overrides.skills ?? [
    enabledSkill(),
    disabledSkill(),
    unmanagedSkill()
  ];

  return {
    agents: overrides.agents ?? [agent()],
    skills,
    selectedAgentId: "codex",
    selectedSkillId: skills[0]?.id ?? null,
    lastScanAt: null,
    issueCount: 0,
    ...overrides
  };
}

function state(overrides: Partial<DashboardModel> = {}): TuiState {
  return updateTuiState(createInitialTuiState(model(overrides)), {
    type: "focus-next"
  });
}

function elementText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(elementText).join("");
  }

  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return elementText(node.props.children);
  }

  return "";
}

async function settle(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

describe("TUI dashboard components", () => {
  const dashboardRequiresExplicitDimensions = (
    // @ts-expect-error Dashboard must receive terminal dimensions from App.
    <Dashboard state={state()} />
  );

  void dashboardRequiresExplicitDimensions;

  it("renders agents, skills for codex, detail, a skill marker/name, and available toggle shortcut", () => {
    const { lastFrame } = render(
      <Dashboard state={state()} width={80} height={24} />
    );

    const frame = lastFrame();

    expect(frame).toContain("Agents");
    expect(frame).toContain("Skills for codex");
    expect(frame).toContain("Detail");
    expect(frame).toContain("● using-superpowers");
    expect(frame).toContain("[Space]toggle");
  });

  it("uses the provided terminal dimensions instead of a fixed inner frame", () => {
    const frame = renderToString(
      <Dashboard state={state()} width={100} height={30} />,
      { columns: 100 }
    );

    expect(frame.trimEnd().split("\n")).toHaveLength(30);
  });

  it("does not render agent row counters", () => {
    const frame = renderToString(
      <Dashboard
        state={state({
          agents: [
            agent({
              enabledCount: 0,
              disabledCount: 1,
              unmanagedCount: 0,
              issueCount: 0
            })
          ]
        })}
        width={80}
        height={24}
      />,
      { columns: 80 }
    );

    expect(frame).not.toContain("E0");
    expect(frame).not.toContain("D1");
  });

  it("keeps the selected agent highlighted when skills has focus", () => {
    const tree = AgentList({
      agents: [agent()],
      selectedAgentId: "codex",
      focused: false
    });
    const row = React.Children.toArray(tree.props.children).find(
      (
        child
      ): child is React.ReactElement<{
        children?: React.ReactNode;
        inverse?: boolean;
      }> =>
        React.isValidElement<{
          children?: React.ReactNode;
          inverse?: boolean;
        }>(child) && elementText(child).includes("codex")
    );

    expect(row?.props.inverse).toBe(true);
  });

  it("explains visible status icons in the footer", () => {
    const frame = renderToString(
      <Footer
        actions={{
          toggle: true,
          adopt: true,
          remove: true,
          scan: true,
          help: true
        }}
        search={null}
      />
    );

    expect(frame).toContain("Agent icons");
    expect(frame).toContain("enabled");
    expect(frame).toContain("disabled");
    expect(frame).toContain("yellow * issues");
    expect(frame).toContain("● enabled");
    expect(frame).toContain("○ disabled");
  });

  it("explains filesystem-writing behavior and left-right navigation in the help overlay", () => {
    const { lastFrame } = render(<HelpOverlay />);

    const frame = lastFrame();

    expect(frame).toContain("Navigation");
    expect(frame).toContain("Actions");
    expect(frame).toContain("Search");
    expect(frame).toContain("Safety");
    expect(frame).toContain("Left");
    expect(frame).toContain("Right");
    expect(frame).not.toContain("Tab focus");
    expect(frame).toContain("yellow * issues");
    expect(frame).toContain(
      "Toggle, adopt, remove, and scan can update SkillMux state and agent links."
    );
  });

  it("reserves the same height for confirm dialogs that the dialog renders itself", () => {
    const withModal = updateTuiState(
      state({ selectedSkillId: "terminal-ui" }),
      { type: "request-remove" }
    );
    const dashboard = Dashboard({
      state: withModal,
      width: 80,
      height: 24
    });
    const bodyRow = React.Children.toArray(dashboard.props.children).find(
      (
        child
      ): child is React.ReactElement<{
        flexDirection?: string;
        height?: number;
      }> =>
        React.isValidElement<{
          flexDirection?: string;
          height?: number;
        }>(child) && child.props.flexDirection === "row"
    );

    expect(bodyRow?.props.height).toBe(16);
  });

  it("renders adopt confirmation text and confirmation shortcuts", () => {
    const { lastFrame } = render(
      <ConfirmDialog
        modal={{ kind: "confirm-adopt", skillId: "find-skills", agentId: "codex" }}
      />
    );

    const frame = lastFrame();

    expect(frame).toContain("Adopt find-skills for codex?");
    expect(frame).toContain("[y] confirm   [Esc] cancel");
  });

  it("renders remove confirmation text and confirmation shortcuts", () => {
    const { lastFrame } = render(
      <ConfirmDialog modal={{ kind: "confirm-remove", skillId: "terminal-ui" }} />
    );

    const frame = lastFrame();

    expect(frame).toContain("Remove terminal-ui from SkillMux?");
    expect(frame).toContain("[y] confirm   [Esc] cancel");
  });

  it("does not show normal footer shortcuts while a modal is active", () => {
    const withModal = updateTuiState(
      state({ selectedSkillId: "terminal-ui" }),
      { type: "request-remove" }
    );
    const { lastFrame } = render(
      <Dashboard state={withModal} width={80} height={24} />
    );

    const frame = lastFrame();

    expect(frame).toContain("[y] confirm   [Esc] cancel");
    expect(frame).not.toContain("[Tab]focus");
    expect(frame).not.toContain("[Space]toggle");
  });

  it("uses explicit busy status text before falling back to scanning text", () => {
    const working = render(
      <StatusLine
        busy
        statusMessage="working..."
        lastScanAt={null}
        issueCount={0}
      />
    );
    const loading = render(
      <StatusLine
        busy
        statusMessage="loading agent..."
        lastScanAt={null}
        issueCount={0}
      />
    );
    const fallback = render(
      <StatusLine busy statusMessage={null} lastScanAt={null} issueCount={0} />
    );

    expect(working.lastFrame()).toContain("working...");
    expect(loading.lastFrame()).toContain("loading agent...");
    expect(fallback.lastFrame()).toContain("scanning...");
  });

  it("renders the exact too-small terminal fallback below 80x24", () => {
    const { lastFrame } = render(
      <Dashboard state={state()} width={79} height={24} />
    );

    expect(lastFrame()).toBe(
      "Terminal too small. Resize to at least 80x24."
    );
  });

  it("keeps footer shortcut lists out of the detail pane", () => {
    const focused = DetailPane({
      selectedAgent: agent(),
      selectedSkill: disabledSkill(),
      focused: true
    });
    const header = React.Children.toArray(focused.props.children).find(
      (
        child
      ): child is React.ReactElement<{
        children?: React.ReactNode;
        color?: string;
      }> =>
        React.isValidElement<{
          children?: React.ReactNode;
          color?: string;
        }>(child) && elementText(child) === "Detail"
    );

    expect(header?.props.color).toBeUndefined();
  });

  it("compresses long detail paths so the first screen stays readable", () => {
    const frame = renderToString(
      <DetailPane
        selectedAgent={agent({ name: "OpenAI Codex" })}
        selectedSkill={enabledSkill()}
        focused={false}
        width={28}
        height={18}
      />,
      { columns: 28 }
    );

    expect(frame).toContain("Store: ...\\using-superpowers");
    expect(frame).toContain("Link: ...\\using-superpowers");
    expect(frame).not.toContain("Skill path:");
    expect(frame).not.toContain("Agent link:");
  });

  it("distinguishes an empty agent search from having no discovered agents", () => {
    const frame = renderToString(
      <AgentList
        agents={[]}
        selectedAgentId={null}
        focused
        searchQuery="zzz"
      />
    );

    expect(frame).toContain("No matching agents");
    expect(frame).not.toContain("No agents found");
  });

  it("distinguishes empty skill search results from missing skills or agent selection", () => {
    const noSelection = renderToString(
      <SkillList
        agentId={null}
        skills={[]}
        selectedSkillId={null}
        focused={false}
      />
    );
    const noMatches = renderToString(
      <SkillList
        agentId="codex"
        skills={[]}
        selectedSkillId={null}
        focused
        searchQuery="zzz"
      />
    );

    expect(noSelection).toContain("Select an agent");
    expect(noSelection).not.toContain("No skills for this agent");
    expect(noMatches).toContain("No matching skills");
    expect(noMatches).not.toContain("No skills for this agent");
  });
});

describe("App", () => {
  it("renders the loaded dashboard model", async () => {
    const loadDashboardState = vi.fn().mockResolvedValue(model());
    const { lastFrame } = render(
      <App
        services={{ loadDashboardState }}
        terminalWidth={80}
        terminalHeight={24}
      />
    );

    await settle();

    expect(loadDashboardState).toHaveBeenCalledWith({
      homeDir: undefined,
      platform: undefined,
      selectedAgentId: undefined,
      selectedSkillId: undefined,
      skillmuxHome: undefined
    });
    expect(lastFrame()).toContain("Skills for codex");
    expect(lastFrame()).toContain("using-superpowers");
  });

  it("supplies default terminal dimensions to the dashboard", async () => {
    const loadDashboardState = vi.fn().mockResolvedValue(model());
    const { lastFrame } = render(
      <App services={{ loadDashboardState }} />
    );

    await settle();

    expect(lastFrame()).toContain("Skills for codex");
    expect(lastFrame()).not.toBe(
      "Terminal too small. Resize to at least 80x24."
    );
  });

  it("reloads dashboard skills when agent navigation creates a pending agent selection", async () => {
    const loadDashboardState = vi
      .fn()
      .mockResolvedValueOnce(
        model({
          agents: [agent(), agent({ id: "claude", name: "claude" })],
          selectedAgentId: "codex",
          selectedSkillId: "using-superpowers",
          skills: [enabledSkill()]
        })
      )
      .mockResolvedValueOnce(
        model({
          agents: [agent(), agent({ id: "claude", name: "claude" })],
          selectedAgentId: "claude",
          skills: [
            enabledSkill({
              id: "claude-skill",
              skillId: "claude-skill",
              name: "claude-skill",
              agentId: "claude"
            })
          ]
        })
      );
    const { lastFrame, stdin } = render(
      <App
        services={{ loadDashboardState }}
        terminalWidth={80}
        terminalHeight={24}
      />
    );

    await settle();
    stdin.write("j");
    await settle();
    await settle();

    expect(loadDashboardState).toHaveBeenLastCalledWith({
      homeDir: undefined,
      platform: undefined,
      selectedAgentId: "claude",
      selectedSkillId: undefined,
      skillmuxHome: undefined
    });
    expect(lastFrame()).toContain("Skills for claude");
    expect(lastFrame()).toContain("claude-skill");
  });

  it("closes adopt confirmation immediately and ignores duplicate y while write is pending", async () => {
    const pendingAdopt = deferred<{
      model: DashboardModel;
      statusMessage: string;
    }>();
    const loadDashboardState = vi.fn().mockResolvedValue(
      model({
        selectedSkillId: "unmanaged:find-skills"
      })
    );
    const dispatchTuiAction = vi.fn().mockReturnValue(pendingAdopt.promise);
    const { lastFrame, stdin } = render(
      <App
        services={{ loadDashboardState, dispatchTuiAction }}
        terminalWidth={80}
        terminalHeight={24}
      />
    );

    await settle();
    stdin.write("\u001B[C");
    await settle();
    stdin.write("a");
    await settle();
    expect(lastFrame()).toContain("Adopt find-skills for codex?");

    stdin.write("y");
    stdin.write("y");
    await settle();

    expect(dispatchTuiAction).toHaveBeenCalledTimes(1);
    expect(dispatchTuiAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "adopt" })
    );
    expect(lastFrame()).toContain("working...");
    expect(lastFrame()).not.toContain("Adopt find-skills for codex?");

    pendingAdopt.reject(new Error("copy failed"));
    await settle();

    expect(lastFrame()).toContain("Action failed: copy failed");
    expect(lastFrame()).toContain("Skills for codex");
  });

  it("does not let stale earlier agent reload results overwrite the later selection", async () => {
    const claudeLoad = deferred<DashboardModel>();
    const geminiLoad = deferred<DashboardModel>();
    const loadDashboardState = vi
      .fn()
      .mockResolvedValueOnce(
        model({
          agents: [
            agent(),
            agent({ id: "claude", name: "claude" }),
            agent({ id: "gemini", name: "gemini" })
          ],
          selectedAgentId: "codex",
          selectedSkillId: "using-superpowers",
          skills: [enabledSkill()]
        })
      )
      .mockReturnValueOnce(claudeLoad.promise)
      .mockReturnValueOnce(geminiLoad.promise);
    const { lastFrame, stdin } = render(
      <App
        services={{ loadDashboardState }}
        terminalWidth={80}
        terminalHeight={24}
      />
    );

    await settle();
    stdin.write("j");
    await settle();
    stdin.write("j");
    await settle();

    expect(loadDashboardState).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ selectedAgentId: "claude" })
    );
    expect(loadDashboardState).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ selectedAgentId: "gemini" })
    );

    geminiLoad.resolve(
      model({
        agents: [
          agent(),
          agent({ id: "claude", name: "claude" }),
          agent({ id: "gemini", name: "gemini" })
        ],
        selectedAgentId: "gemini",
        skills: [
          enabledSkill({
            id: "gemini-skill",
            skillId: "gemini-skill",
            name: "gemini-skill",
            agentId: "gemini"
          })
        ]
      })
    );
    await settle();
    expect(lastFrame()).toContain("Skills for gemini");
    expect(lastFrame()).toContain("gemini-skill");

    claudeLoad.resolve(
      model({
        agents: [
          agent(),
          agent({ id: "claude", name: "claude" }),
          agent({ id: "gemini", name: "gemini" })
        ],
        selectedAgentId: "claude",
        skills: [
          enabledSkill({
            id: "claude-skill",
            skillId: "claude-skill",
            name: "claude-skill",
            agentId: "claude"
          })
        ]
      })
    );
    await settle();

    expect(lastFrame()).toContain("Skills for gemini");
    expect(lastFrame()).toContain("gemini-skill");
    expect(lastFrame()).not.toContain("claude-skill");
  });

  it("adds q to the search query instead of quitting search mode", async () => {
    const loadDashboardState = vi.fn().mockResolvedValue(model());
    const { lastFrame, stdin } = render(
      <App
        services={{ loadDashboardState }}
        terminalWidth={80}
        terminalHeight={24}
      />
    );

    await settle();
    stdin.write("/");
    await settle();
    stdin.write("q");
    await settle();

    expect(lastFrame()).toContain("/q");
    expect(lastFrame()).toContain("Last scan: never | issues: 0");
  });

  it("dispatches the intended toggle action from Space", async () => {
    const pendingToggle = deferred<{
      model: DashboardModel;
      statusMessage: string;
    }>();
    const loadDashboardState = vi.fn().mockResolvedValue(model());
    const dispatchTuiAction = vi.fn().mockReturnValue(pendingToggle.promise);
    const { stdin } = render(
      <App
        services={{ loadDashboardState, dispatchTuiAction }}
        terminalWidth={80}
        terminalHeight={24}
      />
    );

    await settle();
    stdin.write("\u001B[C");
    await settle();
    stdin.write(" ");
    await settle();
    await settle();

    expect(dispatchTuiAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "toggle" })
    );
  });

  it("blocks agent navigation reloads while a write action is pending", async () => {
    const pendingToggle = deferred<{
      model: DashboardModel;
      statusMessage: string;
    }>();
    const baseModel = model({
      agents: [agent(), agent({ id: "claude", name: "claude" })],
      selectedAgentId: "codex",
      selectedSkillId: "using-superpowers",
      skills: [enabledSkill()]
    });
    const loadDashboardState = vi.fn().mockResolvedValue(baseModel);
    const dispatchTuiAction = vi.fn().mockReturnValue(pendingToggle.promise);
    const { lastFrame, stdin } = render(
      <App
        services={{ loadDashboardState, dispatchTuiAction }}
        terminalWidth={80}
        terminalHeight={24}
      />
    );

    await settle();
    stdin.write("\u001B[C");
    await settle();
    stdin.write(" ");
    await settle();
    await settle();

    expect(dispatchTuiAction).toHaveBeenCalledTimes(1);
    expect(lastFrame()).toContain("Skills for codex");
    expect(lastFrame()).not.toContain("[Space]toggle");

    stdin.write("\u001B[C");
    await settle();
    stdin.write("\u001B[D");
    await settle();
    stdin.write("j");
    await settle();
    await settle();

    expect(loadDashboardState).toHaveBeenCalledTimes(1);
    expect(lastFrame()).toContain("Skills for codex");
    expect(lastFrame()).not.toContain("Skills for claude");
    expect(lastFrame()).not.toContain("[Space]toggle");

    pendingToggle.resolve({
      model: baseModel,
      statusMessage: "Disabled using-superpowers"
    });
    await settle();

    expect(loadDashboardState).toHaveBeenCalledTimes(1);
    expect(lastFrame()).toContain("Disabled using-superpowers");
    expect(lastFrame()).toContain("Skills for codex");
    expect(lastFrame()).toContain("[Space]toggle");
  });
});

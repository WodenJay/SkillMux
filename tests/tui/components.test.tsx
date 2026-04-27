import React from "react";
import { renderToString } from "ink";
import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import { App } from "../../src/tui/app";
import { dispatchTuiAction as realDispatchTuiAction } from "../../src/tui/actions";
import { AgentList } from "../../src/tui/components/AgentList";
import { Dashboard, horizontalBorder } from "../../src/tui/components/Dashboard";
import { ConfirmDialog } from "../../src/tui/components/ConfirmDialog";
import { DetailPane } from "../../src/tui/components/DetailPane";
import { Footer } from "../../src/tui/components/Footer";
import { HelpOverlay } from "../../src/tui/components/HelpOverlay";
import { DoctorDialog } from "../../src/tui/components/DoctorDialog";
import { FormDialog } from "../../src/tui/components/FormDialog";
import { SkillList } from "../../src/tui/components/SkillList";
import { StatusLine } from "../../src/tui/components/StatusLine";
import {
  createConfigAddAgentForm,
  createConfigUpdateAgentFormFromSeed,
  createImportSkillForm
} from "../../src/tui/forms";
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
    stableName: "OpenAI Codex",
    path: "C:\\Users\\me\\.codex\\skills",
    homeRelativeRootPath: ".codex",
    skillsDirectoryPath: "skills",
    supportedPlatforms: ["win32", "linux", "darwin"],
    enabledByDefault: true,
    discovery: "builtin",
    exists: true,
    supported: true,
    hasUserOverride: false,
    canEditOverride: false,
    canRemoveOverride: false,
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

function normalizeFrame(frame: string): string {
  return frame.replace(/\s+/g, " ").trim();
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
          adoptAll: false,
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

  it("shows the bulk adopt shortcut only when adopt all is available", () => {
    const enabledFrame = renderToString(
      <Footer
        actions={{
          toggle: true,
          adopt: true,
          adoptAll: true,
          remove: true,
          scan: true,
          help: true
        }}
        search={null}
      />
    );
    const disabledFrame = renderToString(
      <Footer
        actions={{
          toggle: true,
          adopt: true,
          adoptAll: false,
          remove: true,
          scan: true,
          help: true
        }}
        search={null}
      />
    );

    expect(enabledFrame).toContain("[Shift+A]adopt all");
    expect(disabledFrame).not.toContain("[Shift+A]adopt all");
  });

  it("shows the parity workflow shortcuts when actions are available", () => {
    const frame = renderToString(
      <Footer
        actions={{
          addAgent: true,
          editAgent: true,
          removeAgent: true,
          importSkill: true,
          doctor: true,
          toggle: false,
          adopt: false,
          adoptAll: false,
          remove: false,
          scan: false,
          help: true
        }}
        search={null}
      />
    );

    expect(frame).toContain("[n]add agent");
    expect(frame).toContain("[e]edit agent");
    expect(frame).toContain("[X]remove agent");
    expect(frame).toContain("[i]import");
    expect(frame).toContain("[d]doctor");
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

  it("teaches the parity workflow shortcuts in the help overlay", () => {
    const { lastFrame } = render(<HelpOverlay />);

    const frame = lastFrame();

    expect(frame).toContain("n add agent");
    expect(frame).toContain("e edit selected override");
    expect(frame).toContain("X remove selected override");
    expect(frame).toContain("i import");
    expect(frame).toContain("d doctor");
  });

  it("explains Shift+A as current-agent bulk adopt in the help overlay", () => {
    const { lastFrame } = render(<HelpOverlay />);

    const frame = lastFrame();

    expect(frame).toContain("Shift+A");
    expect(frame).toContain("current-agent bulk adopt");
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

  it("reserves the same height for bulk adopt dialogs that the dialog renders itself", () => {
    const withModal = updateTuiState(
      state({ agents: [agent({ unmanagedCount: 2 })] }),
      { type: "request-adopt-all" }
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

  it("renders bulk adopt confirmation text through the dashboard overlay", () => {
    const withModal = updateTuiState(
      state({ agents: [agent({ unmanagedCount: 2 })] }),
      { type: "request-adopt-all" }
    );
    const frame = renderToString(
      <Dashboard state={withModal} width={80} height={24} />,
      { columns: 80 }
    );

    expect(frame).toContain("Adopt all unmanaged skills for codex?");
    expect(frame).toContain(
      "2 unmanaged skills will be moved under SkillMux management."
    );
    expect(frame).not.toContain("[Shift+A]adopt all");
  });

  it("lets every pane grow beyond the old fixed widths on a wide terminal", () => {
    const dashboard = Dashboard({
      state: state(),
      width: 160,
      height: 30
    });
    const bodyRow = React.Children.toArray(dashboard.props.children).find(
      (
        child
      ): child is React.ReactElement<{
        children?: React.ReactNode;
        flexDirection?: string;
      }> =>
        React.isValidElement<{
          children?: React.ReactNode;
          flexDirection?: string;
        }>(child) && child.props.flexDirection === "row"
    );
    const [agentPane, skillPane, detailPane] = React.Children.toArray(
      bodyRow?.props.children
    ) as React.ReactElement<{ width?: number }>[];

    expect(agentPane.props.width).toBeGreaterThan(24);
    expect(skillPane.props.width).toBeGreaterThan(28);
    expect(detailPane.props.width).toBeGreaterThan(28);
    expect(
      (agentPane.props.width ?? 0) +
        (skillPane.props.width ?? 0) +
        (detailPane.props.width ?? 0)
    ).toBe(160);
  });

  it("keeps a readable proportional layout at the supported minimum size", () => {
    const dashboard = Dashboard({
      state: state(),
      width: 80,
      height: 24
    });
    const bodyRow = React.Children.toArray(dashboard.props.children).find(
      (
        child
      ): child is React.ReactElement<{
        children?: React.ReactNode;
        flexDirection?: string;
      }> =>
        React.isValidElement<{
          children?: React.ReactNode;
          flexDirection?: string;
        }>(child) && child.props.flexDirection === "row"
    );
    const [agentPane, skillPane, detailPane] = React.Children.toArray(
      bodyRow?.props.children
    ) as React.ReactElement<{ width?: number }>[];

    expect(agentPane.props.width).toBeGreaterThanOrEqual(20);
    expect(skillPane.props.width).toBeGreaterThanOrEqual(24);
    expect(detailPane.props.width).toBeGreaterThanOrEqual(28);
    expect(detailPane.props.width).toBeGreaterThan(skillPane.props.width ?? 0);
    expect(skillPane.props.width).toBeGreaterThanOrEqual(agentPane.props.width ?? 0);
    expect(
      (agentPane.props.width ?? 0) +
        (skillPane.props.width ?? 0) +
        (detailPane.props.width ?? 0)
    ).toBe(80);
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

  it("renders explicit bulk adopt confirmation copy", () => {
    const { lastFrame } = render(
      <ConfirmDialog
        modal={{
          kind: "confirm-adopt-all",
          agentId: "codex",
          unmanagedCount: 2
        }}
      />
    );

    const frame = lastFrame();

    expect(frame).toContain("Adopt all unmanaged skills for codex?");
    expect(frame).toContain(
      "2 unmanaged skills will be moved under SkillMux management."
    );
    expect(frame).toContain("[y] confirm   [Esc] cancel");
  });

  it("renders the add-agent form labels", () => {
    const { lastFrame } = render(
      <FormDialog
        modal={{ kind: "add-agent", form: createConfigAddAgentForm() }}
      />
    );

    const frame = lastFrame();

    expect(frame).toContain("Add agent");
    expect(frame).toContain("Agent id");
    expect(frame).toContain("Root path");
    expect(frame).toContain("Skills path");
    expect(frame).toContain("Display name");
    expect(frame).toContain("Platforms");
    expect(frame).toContain("Disabled by default");
    expect(frame).toContain("Submit");
    expect(frame).toContain("[Up/Down] move");
    expect(frame).not.toContain("Tab");
  });

  it("renders add-agent form errors visibly", () => {
    const { lastFrame } = render(
      <FormDialog
        modal={{
          kind: "add-agent",
          form: {
            ...createConfigAddAgentForm(),
            error: "Agent id and root are required"
          }
        }}
      />
    );

    expect(lastFrame()).toContain("Agent id and root are required");
  });

  it("renders the edit-agent form labels and mutually visible boolean state", () => {
    const { lastFrame } = render(
      <FormDialog
        modal={{
          kind: "edit-agent",
          agentId: "codex",
          form: createConfigUpdateAgentFormFromSeed({
            id: "codex",
            stableName: "OpenAI Codex",
            homeRelativeRootPath: ".codex",
            skillsDirectoryPath: "skills",
            supportedPlatforms: ["win32"],
            overrideEnabledByDefault: true
          })
        }}
      />
    );

    const frame = lastFrame();

    expect(frame).toContain("Edit agent codex");
    expect(frame).toContain("Root path");
    expect(frame).toContain("Skills path");
    expect(frame).toContain("Display name");
    expect(frame).toContain("Platforms");
    expect(frame).toContain("Enabled by default");
    expect(frame).toContain("Disabled by default");
    expect(frame).toContain("Submit");
    expect(frame).toContain("[Up/Down] move");
    expect(frame).not.toContain("Tab");
  });

  it("renders the import form labels", () => {
    const { lastFrame } = render(
      <FormDialog
        modal={{ kind: "import", form: createImportSkillForm() }}
      />
    );

    const frame = lastFrame();

    expect(frame).toContain("Import skill");
    expect(frame).toContain("Source path");
    expect(frame).toContain("Skill name");
    expect(frame).toContain("Submit");
    expect(frame).toContain("[Up/Down] move");
    expect(frame).not.toContain("Tab");
  });

  it("renders import form errors visibly", () => {
    const { lastFrame } = render(
      <FormDialog
        modal={{
          kind: "import",
          form: {
            ...createImportSkillForm(),
            error: "Skill name and source path are required"
          }
        }}
      />
    );

    expect(lastFrame()).toContain("Skill name and source path are required");
  });

  it("renders remove-agent confirmation text with the selected agent name", () => {
    const { lastFrame } = render(
      <ConfirmDialog
        modal={{ kind: "confirm-remove-agent", agentId: "codex" }}
      />
    );

    const frame = lastFrame();

    expect(frame).toContain("Remove agent override for codex?");
    expect(frame).toContain("This will remove the selected agent override from SkillMux.");
    expect(frame).toContain("[y] confirm   [Esc] cancel");
  });

  it("renders the discard-dirty-form confirmation prompt through the dashboard", () => {
    const withModal = updateTuiState(
      updateTuiState(
        createInitialTuiState(model()),
        { type: "open-add-agent" }
      ),
      { type: "add-agent-form-field-changed", field: "name", value: "Draft" }
    );
    const discarded = updateTuiState(withModal, { type: "close" });
    const frame = renderToString(
      <Dashboard state={discarded} width={80} height={24} />,
      { columns: 80 }
    );

    expect(frame).toContain("Discard unsaved changes?");
    expect(frame).toContain("This will close the form and discard the current changes.");
    expect(frame).toContain("[y] confirm   [Esc] cancel");
  });

  it("keeps the import modal open when the real dispatcher reports a resolved failure", async () => {
    const loadDashboardState = vi.fn().mockResolvedValue(model());
    const runImport = vi.fn().mockRejectedValue(new Error("copy failed"));
    const dispatchTuiAction = vi.fn(
      (input: Parameters<typeof realDispatchTuiAction>[0]) =>
        realDispatchTuiAction({
          ...input,
          services: {
            runImport,
            reload: vi.fn()
          }
        })
    );
    const { lastFrame, stdin } = render(
      <App
        services={{ loadDashboardState, dispatchTuiAction }}
        terminalWidth={80}
        terminalHeight={24}
      />
    );

    await settle();
    stdin.write("i");
    await settle();
    stdin.write("C:\\Users\\me\\skill mux");
    await settle();
    stdin.write("\u001B[B");
    await settle();
    stdin.write("find skills");
    await settle();
    stdin.write("\u001B[B");
    await settle();
    stdin.write("\r");
    await settle();

    expect(dispatchTuiAction).toHaveBeenCalledTimes(1);
    expect(runImport).toHaveBeenCalledTimes(1);

    await settle();
    await settle();

    expect(lastFrame()).toContain("Import skill failed: copy failed");
    expect(lastFrame()).toContain("Import skill");
    expect(lastFrame()).toContain("C:\\Users\\me\\skill mux");
    expect(lastFrame()).toContain("find skills");
  });

  it("surfaces the resolved doctor failure inside the doctor modal", async () => {
    const loadDashboardState = vi.fn().mockResolvedValue(model());
    const runDoctor = vi.fn().mockRejectedValue(new Error("doctor unavailable"));
    const dispatchTuiAction = vi.fn(
      (input: Parameters<typeof realDispatchTuiAction>[0]) =>
        realDispatchTuiAction({
          ...input,
          services: {
            runDoctor,
            reload: vi.fn()
          }
        })
    );
    const { lastFrame, stdin } = render(
      <App
        services={{ loadDashboardState, dispatchTuiAction }}
        terminalWidth={80}
        terminalHeight={24}
      />
    );

    await settle();
    stdin.write("d");
    await settle();
    await settle();

    expect(dispatchTuiAction).toHaveBeenCalledTimes(1);
    expect(runDoctor).toHaveBeenCalledTimes(1);
    expect(lastFrame()).toContain("Doctor failed: doctor unavailable");
    expect(lastFrame()).toContain("Doctor");
    expect(lastFrame()).not.toContain("Doctor report missing");
  });

  it("keeps dirty forms in the discard-confirmation flow when q is pressed", async () => {
    const loadDashboardState = vi.fn().mockResolvedValue(model());
    const { lastFrame, stdin } = render(
      <App
        services={{ loadDashboardState }}
        terminalWidth={80}
        terminalHeight={24}
      />
    );

    await settle();
    stdin.write("n");
    await settle();
    stdin.write("DRAFT");
    await settle();
    stdin.write("q");
    await settle();
    stdin.write("n");
    await settle();

    expect(lastFrame()).toContain("Add agent");
    expect(lastFrame()).toContain("DRAFT");
  });

  it("renders doctor loading, empty, issue-list, and error states", () => {
    const loading = renderToString(
      <DoctorDialog
        modal={{ kind: "doctor", status: "loading" }}
      />
    );
    const empty = renderToString(
      <DoctorDialog
        modal={{
          kind: "doctor",
          status: "ready",
          report: {
            skillmuxHome: "C:/skillmux",
            manifest: {
              version: 1,
              skillmuxHome: "C:/skillmux",
              skills: {},
              agents: {},
              activations: [],
              lastScan: { at: null, issues: [] }
            },
            config: {
              version: 1,
              agents: {}
            },
            agents: [],
            entries: [],
            issues: [],
            output: "Doctor ok\n"
          }
        }}
      />
    );
    const issues = renderToString(
      <DoctorDialog
        modal={{
          kind: "doctor",
          status: "ready",
          report: {
            skillmuxHome: "C:/skillmux",
            manifest: {
              version: 1,
              skillmuxHome: "C:/skillmux",
              skills: {},
              agents: {},
              activations: [],
              lastScan: { at: null, issues: [] }
            },
            config: {
              version: 1,
              agents: {}
            },
            agents: [],
            entries: [],
            issues: [
              {
                code: "broken-link",
                severity: "error",
                path: "C:/Users/me/.codex/skills/broken",
                message: "Broken link"
              }
            ],
            output: "Doctor issues\n"
          }
        }}
      />
    );
    const error = renderToString(
      <DoctorDialog
        modal={{
          kind: "doctor",
          status: "error",
          errorMessage: "Doctor failed"
        }}
      />
    );

    expect(loading).toContain("Doctor");
    expect(loading).toContain("Loading doctor diagnostics...");
    expect(empty).toContain("No doctor issues found.");
    expect(issues).toContain("broken-link");
    expect(issues).toContain("Broken link");
    expect(issues).toContain("C:/Users/me/.codex/skills/broken");
    expect(error).toContain("Doctor failed");
  });

  it("clamps doctor scrolling to the available issue range", () => {
    const frame = renderToString(
      <DoctorDialog
        modal={{
          kind: "doctor",
          status: "ready",
          report: {
            skillmuxHome: "C:/skillmux",
            manifest: {
              version: 1,
              skillmuxHome: "C:/skillmux",
              skills: {},
              agents: {},
              activations: [],
              lastScan: { at: null, issues: [] }
            },
            config: {
              version: 1,
              agents: {}
            },
            agents: [],
            entries: [],
            issues: [
              {
                code: "one",
                severity: "warning",
                path: "C:/one",
                message: "First"
              },
              {
                code: "two",
                severity: "warning",
                path: "C:/two",
                message: "Second"
              },
              {
                code: "three",
                severity: "error",
                path: "C:/three",
                message: "Third"
              }
            ],
            output: "Doctor issues\n"
          }
        }}
        scrollOffset={99}
        height={6}
      />
    );

    expect(frame).toContain("Showing 3-3 of 3");
    expect(frame).toContain("three");
    expect(frame).not.toContain("Showing 100");
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

  it("routes add, edit, remove, import, and doctor shortcuts into modal workflows", async () => {
    const loadDashboardState = vi.fn().mockResolvedValue(
      model({
        agents: [
          {
            ...agent(),
            hasUserOverride: true,
            canEditOverride: true,
            canRemoveOverride: true
          }
        ],
        selectedAgentId: "codex",
        selectedSkillId: "terminal-ui"
      })
    );
    const addApp = render(
      <App services={{ loadDashboardState }} terminalWidth={80} terminalHeight={24} />
    );
    await settle();
    addApp.stdin.write("n");
    await settle();
    expect(addApp.lastFrame()).toContain("Add agent");
    expect(addApp.lastFrame()).toContain("Agent id");
    addApp.unmount();

    const editApp = render(
      <App services={{ loadDashboardState }} terminalWidth={80} terminalHeight={24} />
    );
    await settle();
    editApp.stdin.write("e");
    await settle();
    expect(editApp.lastFrame()).toContain("Edit agent codex");
    editApp.unmount();

    const removeApp = render(
      <App services={{ loadDashboardState }} terminalWidth={80} terminalHeight={24} />
    );
    await settle();
    removeApp.stdin.write("X");
    await settle();
    expect(removeApp.lastFrame()).toContain("Remove agent override for codex?");
    removeApp.unmount();

    const importApp = render(
      <App services={{ loadDashboardState }} terminalWidth={80} terminalHeight={24} />
    );
    await settle();
    importApp.stdin.write("i");
    await settle();
    expect(importApp.lastFrame()).toContain("Import skill");
    importApp.unmount();

    const doctorPending = deferred<{
      model: DashboardModel;
      statusMessage: string;
      doctor: {
        skillmuxHome: string;
        manifest: {
          version: number;
          skillmuxHome: string;
          skills: Record<string, never>;
          agents: Record<string, never>;
          activations: never[];
          lastScan: { at: null; issues: never[] };
        };
        config: { version: number; agents: Record<string, never> };
        agents: never[];
        entries: never[];
        issues: never[];
        output: string;
      };
    }>();
    const dispatchTuiAction = vi.fn().mockReturnValue(doctorPending.promise);
    const doctorApp = render(
      <App
        services={{ loadDashboardState, dispatchTuiAction }}
        terminalWidth={80}
        terminalHeight={24}
      />
    );

    await settle();
    doctorApp.stdin.write("d");
    await settle();
    expect(doctorApp.lastFrame()).toContain("Loading doctor diagnostics...");
    doctorApp.unmount();
  });

  it("allows spaces in add, edit, and import modal text fields", async () => {
    const loadDashboardState = vi.fn().mockResolvedValue(
      model({
        agents: [
          {
            ...agent(),
            hasUserOverride: true,
            canEditOverride: true,
            canRemoveOverride: true
          }
        ],
        selectedAgentId: "codex",
        selectedSkillId: "terminal-ui"
      })
    );
    const { stdin: addStdin, lastFrame: addLastFrame, unmount: unmountAdd } = render(
      <App services={{ loadDashboardState }} terminalWidth={80} terminalHeight={24} />
    );
    await settle();
    addStdin.write("n");
    await settle();
    addStdin.write("\u001B[B");
    await settle();
    addStdin.write("\u001B[B");
    await settle();
    addStdin.write("\u001B[B");
    await settle();
    addStdin.write("Open AI");
    await settle();
    expect(addLastFrame()).toContain("Open AI");
    unmountAdd();

    const { stdin: editStdin, lastFrame: editLastFrame, unmount: unmountEdit } = render(
      <App services={{ loadDashboardState }} terminalWidth={80} terminalHeight={24} />
    );
    await settle();
    editStdin.write("e");
    await settle();
    editStdin.write("\u001B[B");
    await settle();
    editStdin.write(" .codex custom root");
    await settle();
    expect(editLastFrame()).toContain("custom root");
    unmountEdit();

    const { stdin: importStdin, lastFrame: importLastFrame, unmount: unmountImport } = render(
      <App services={{ loadDashboardState }} terminalWidth={80} terminalHeight={24} />
    );
    await settle();
    importStdin.write("i");
    await settle();
    importStdin.write("C:\\Users\\me\\skill mux");
    await settle();
    expect(importLastFrame()).toContain("skill mux");
    unmountImport();
  });

  it("switches the doctor dialog from loading to ready content after the async result returns", async () => {
    const loadDashboardState = vi.fn().mockResolvedValue(model());
    const doctorResult = deferred<{
      model: DashboardModel;
      statusMessage: string;
      doctor?: {
        skillmuxHome: string;
        manifest: {
          version: number;
          skillmuxHome: string;
          skills: Record<string, never>;
          agents: Record<string, never>;
          activations: never[];
          lastScan: { at: null; issues: never[] };
        };
        config: { version: number; agents: Record<string, never> };
        agents: never[];
        entries: never[];
        issues: Array<{
          code: string;
          severity: "error";
          path: string | null;
          message: string;
        }>;
        output: string;
      };
    }>();
    const dispatchTuiAction = vi.fn().mockReturnValue(doctorResult.promise);
    const { lastFrame, stdin } = render(
      <App
        services={{ loadDashboardState, dispatchTuiAction }}
        terminalWidth={80}
        terminalHeight={24}
      />
    );

    await settle();
    stdin.write("d");
    await settle();

    expect(lastFrame()).toContain("Loading doctor diagnostics...");

    doctorResult.resolve({
      model: model(),
      statusMessage: "Doctor ok",
      doctor: {
        skillmuxHome: "C:/skillmux",
        manifest: {
          version: 1,
          skillmuxHome: "C:/skillmux",
          skills: {},
          agents: {},
          activations: [],
          lastScan: { at: null, issues: [] }
        },
        config: { version: 1, agents: {} },
        agents: [],
        entries: [],
        issues: [],
        output: "Doctor ok\n"
      }
    });
    await settle();
    await settle();

    expect(lastFrame()).toContain("Doctor ok");
    expect(lastFrame()).toContain("No doctor issues found.");
  });

  it("uses explicit busy status text before falling back to scanning text", () => {
    const working = render(
      <StatusLine
        busy
        statusMessage="working..."
        model={model()}
      />
    );
    const loading = render(
      <StatusLine
        busy
        statusMessage="loading agent..."
        model={model()}
      />
    );
    const fallback = render(
      <StatusLine busy statusMessage={null} model={model()} />
    );

    expect(working.lastFrame()).toContain("working...");
    expect(loading.lastFrame()).toContain("loading agent...");
    expect(fallback.lastFrame()).toContain("scanning...");
  });

  it("renders the resize prompt across the full screen below the minimum terminal size", () => {
    const frame = renderToString(
      <Dashboard state={state()} width={79} height={24} />,
      { columns: 79 }
    );

    expect(frame).toContain("Terminal too small. Resize to at least 80x24.");
    expect(frame).not.toContain("Agents");
    expect(frame).not.toContain("Skills for codex");
    expect(frame).not.toContain("Detail");
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

  it("horizontalBorder builds a border line whose character count matches the sum of widths plus junction chars", () => {
    const result = horizontalBorder(
      "\u2514",
      "\u2534",
      "\u2518",
      20,
      24,
      36
    );

    expect(result.length).toBe(84);
    expect(result.startsWith("\u2514")).toBe(true);
    expect(result.endsWith("\u2518")).toBe(true);
    const midCount = [...result].filter((c) => c === "\u2534").length;
    expect(midCount).toBe(2);
  });

  it("horizontalBorder renders the correct border line with bottom corners and dash spacing for a three-pane layout", () => {
    const result = horizontalBorder(
      "\u251C",
      "\u252C",
      "\u2524",
      20,
      24,
      28
    );

    expect(result).toBe(
      "\u251C" +
        "\u2500".repeat(20) +
        "\u252C" +
        "\u2500".repeat(24) +
        "\u252C" +
        "\u2500".repeat(28) +
        "\u2524"
    );
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

  it("shows loading placeholders instead of empty-state copy while switching agents", async () => {
    const pendingAgentLoad = deferred<DashboardModel>();
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
      .mockReturnValueOnce(pendingAgentLoad.promise);
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

    const frame = lastFrame() ?? "";

    expect(frame).toContain("Skills for claude");
    expect(normalizeFrame(frame)).toContain("Loading skills for");
    expect(normalizeFrame(frame)).toContain("Loading details for");
    expect(normalizeFrame(frame)).toContain("claude...");
    expect(frame).not.toContain("No skills for this agent");
    expect(frame).not.toContain("Select a skill row");

    pendingAgentLoad.resolve(
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
    await settle();
    await settle();

    expect(lastFrame()).toContain("claude-skill");
  });

  it("restores the last loaded agent view when a pending agent reload fails", async () => {
    const pendingAgentLoad = deferred<DashboardModel>();
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
      .mockReturnValueOnce(pendingAgentLoad.promise);
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

    const frame = lastFrame() ?? "";

    expect(frame).toContain("Skills for claude");
    expect(normalizeFrame(frame)).toContain("Loading skills for");
    expect(normalizeFrame(frame)).toContain("claude...");

    pendingAgentLoad.reject(new Error("claude reload failed"));
    await settle();
    await settle();

    expect(lastFrame()).toContain("Load failed: claude reload failed");
    expect(lastFrame()).toContain("Skills for codex");
    expect(lastFrame()).toContain("using-superpowers");
    expect(lastFrame()).not.toContain("Skills for claude");
    expect(lastFrame()).not.toContain("Loading skills for claude...");
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

  it("opens bulk adopt confirmation from the reducer event", () => {
    const next = updateTuiState(
      state({
        selectedAgentId: "codex",
        agents: [agent({ unmanagedCount: 2 })]
      }),
      { type: "request-adopt-all" }
    );

    expect(next.modal).toEqual({
      kind: "confirm-adopt-all",
      agentId: "codex",
      unmanagedCount: 2
    });
  });

  it("dispatches adopt-all exactly once when confirming bulk adopt", async () => {
    const pendingAdoptAll = deferred<{
      model: DashboardModel;
      statusMessage: string;
    }>();
    const loadDashboardState = vi.fn().mockResolvedValue(
      model({
        selectedAgentId: "codex",
        agents: [agent({ unmanagedCount: 2 })],
        selectedSkillId: "unmanaged:find-skills"
      })
    );
    const dispatchTuiAction = vi.fn().mockReturnValue(pendingAdoptAll.promise);
    const { lastFrame, stdin } = render(
      <App
        services={{ loadDashboardState, dispatchTuiAction }}
        terminalWidth={80}
        terminalHeight={24}
      />
    );

    await settle();
    stdin.write("A");
    await settle();
    expect(lastFrame()).toContain("Adopt all unmanaged skills for codex?");
    expect(dispatchTuiAction).not.toHaveBeenCalled();

    stdin.write("y");
    stdin.write("y");
    await settle();

    expect(dispatchTuiAction).toHaveBeenCalledTimes(1);
    expect(dispatchTuiAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "adopt-all" })
    );
    expect(lastFrame()).toContain("working...");

    pendingAdoptAll.resolve({
      model: model({
        selectedAgentId: "codex",
        agents: [agent({ unmanagedCount: 0 })],
        selectedSkillId: "unmanaged:find-skills"
      }),
      statusMessage: "Adopted all unmanaged skills for codex"
    });
    await settle();

    expect(lastFrame()).toContain("Adopted all unmanaged skills for codex");
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

  it("restores the previous selection when Enter submits an empty-result search", async () => {
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
    stdin.write("zzz");
    await settle();

    expect(lastFrame()).toContain("No matching agents");
    expect(lastFrame()).toContain("Skills for none");

    stdin.write("\r");
    await settle();

    expect(lastFrame()).toContain("Skills for codex");
    expect(lastFrame()).toContain("using-superpowers");
    expect(lastFrame()).not.toContain("No matching agents");
    expect(lastFrame()).not.toContain("Skills for none");
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

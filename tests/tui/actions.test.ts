import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  dispatchTuiAction,
  type TuiPendingCommand,
  type TuiActionServices
} from "../../src/tui/actions";
import type {
  DashboardModel,
  TuiDisabledSkillRow,
  TuiEnabledSkillRow,
  TuiSkillRow
} from "../../src/tui/dashboard-model";
import type { RunConfigAddAgentOptions } from "../../src/commands/config-add-agent";
import type { RunConfigRemoveAgentOptions } from "../../src/commands/config-remove-agent";
import type { RunConfigUpdateAgentOptions } from "../../src/commands/config-update-agent";
import type { RunDoctorResult } from "../../src/commands/doctor";
import type { RunImportOptions } from "../../src/commands/import";

function createModel(overrides: Partial<DashboardModel> = {}): DashboardModel {
  return {
    agents: [],
    skills: [],
    selectedAgentId: "codex",
    selectedSkillId: "terminal-ui",
    lastScanAt: null,
    issueCount: 0,
    ...overrides
  };
}

function enabledRow(): TuiEnabledSkillRow {
  return {
    id: "terminal-ui",
    kind: "enabled",
    marker: "" as TuiEnabledSkillRow["marker"],
    skillId: "terminal-ui",
    name: "Terminal UI",
    path: join("C:", "skillmux", "skills", "terminal-ui"),
    agentId: "codex",
    activationLinkPath: join(
      "C:",
      "Users",
      "me",
      ".codex",
      "skills",
      "terminal-ui"
    )
  };
}

function enabledOtherRow(): TuiEnabledSkillRow {
  return {
    id: "find-skills",
    kind: "enabled",
    marker: "" as TuiEnabledSkillRow["marker"],
    skillId: "find-skills",
    name: "Find Skills",
    path: join("C:", "skillmux", "skills", "find-skills"),
    agentId: "codex",
    activationLinkPath: join(
      "C:",
      "Users",
      "me",
      ".codex",
      "skills",
      "find-skills"
    )
  };
}

function disabledRow(): TuiDisabledSkillRow {
  return {
    id: "terminal-ui",
    kind: "disabled",
    marker: "" as TuiDisabledSkillRow["marker"],
    skillId: "terminal-ui",
    name: "Terminal UI",
    path: join("C:", "skillmux", "skills", "terminal-ui"),
    agentId: "codex",
    activationLinkPath: null
  };
}

function unmanagedRow(): TuiSkillRow {
  return {
    id: "unmanaged:terminal-ui",
    kind: "unmanaged",
    marker: "?",
    skillName: "terminal-ui",
    name: "terminal-ui",
    path: join("C:", "Users", "me", ".codex", "skills", "terminal-ui"),
    agentId: "codex",
    entryKind: "unmanaged-directory"
  };
}

function issueRow(): TuiSkillRow {
  return {
    id: "issue:codex:unknown-entry:notes.txt",
    kind: "issue",
    marker: "!",
    issueCode: "unknown-entry",
    severity: "warning",
    message: "Unknown entry",
    path: join("C:", "Users", "me", ".codex", "skills", "notes.txt"),
    agentId: "codex"
  };
}

function createModelWithSelectedSkill(
  selectedSkill: TuiSkillRow,
  extraSkills: TuiSkillRow[] = []
): DashboardModel {
  return createModel({
    skills: [...extraSkills, selectedSkill],
    selectedAgentId: selectedSkill.agentId,
    selectedSkillId: selectedSkill.id
  });
}

function createServices(
  overrides: Partial<TuiActionServices> = {}
): TuiActionServices {
  return {
    runConfigAddAgent: vi.fn().mockResolvedValue({
      agentId: "claude-code",
      output: "Added agent\n"
    }),
    runConfigUpdateAgent: vi.fn().mockResolvedValue({
      agentId: "codex",
      output: "Updated agent\n"
    }),
    runConfigRemoveAgent: vi.fn().mockResolvedValue({
      output: "Removed agent\n"
    }),
    runImport: vi.fn().mockResolvedValue({
      output: "Imported skill\n"
    }),
    runDoctor: vi.fn().mockResolvedValue({
      skillmuxHome: "C:/skillmux",
      manifest: {
        version: 1,
        skillmuxHome: "C:/skillmux",
        skills: {},
        agents: {},
        activations: [],
        lastScan: {
          at: null,
          issues: []
        }
      },
      config: {
        version: 1,
        agents: {}
      },
      agents: [],
      entries: [],
      issues: [],
      output: "Doctor ok\n"
    }),
    runEnable: vi.fn().mockResolvedValue({ output: "Enabled terminal-ui\n" }),
    runDisable: vi.fn().mockResolvedValue({ output: "Disabled terminal-ui\n" }),
    runAdopt: vi.fn().mockResolvedValue({ output: "Adopted terminal-ui\n" }),
    runRemove: vi.fn().mockResolvedValue({ output: "Removed terminal-ui\n" }),
    runScan: vi.fn().mockResolvedValue({ output: "Scanned skills\n" }),
    reload: vi.fn().mockResolvedValue(createModel({ selectedSkillId: "reloaded" })),
    ...overrides
  };
}

function agentRow(overrides: Partial<DashboardModel["agents"][number]> = {}) {
  return {
    id: "codex",
    name: "codex",
    stableName: "OpenAI Codex",
    path: join("C:", "Users", "me", ".codex", "skills"),
    homeRelativeRootPath: ".codex",
    skillsDirectoryPath: "skills",
    supportedPlatforms: ["win32", "linux", "darwin"],
    enabledByDefault: true,
    discovery: "builtin" as const,
    exists: true,
    supported: true,
    hasUserOverride: false,
    canEditOverride: false,
    canRemoveOverride: false,
    enabledCount: 0,
    disabledCount: 0,
    unmanagedCount: 0,
    issueCount: 0,
    ...overrides
  };
}

function createPendingCommand(
  command: TuiPendingCommand,
  model: DashboardModel = createModel()
) {
  return {
    action: command,
    model
  } as const;
}

describe("dispatchTuiAction", () => {
  it("enables a disabled managed row, reloads, and trims trailing newlines", async () => {
    const model = createModelWithSelectedSkill(disabledRow());
    const reloadedModel = createModel({ selectedSkillId: "terminal-ui" });
    const services = createServices({
      runEnable: vi.fn().mockResolvedValue({ output: "Enabled terminal-ui\n\n" }),
      reload: vi.fn().mockResolvedValue(reloadedModel)
    });

    const result = await dispatchTuiAction({
      action: "toggle",
      model,
      homeDir: "HOME",
      skillmuxHome: "SKILLMUX",
      platform: "win32",
      services
    });

    expect(services.runEnable).toHaveBeenCalledWith({
      homeDir: "HOME",
      skillmuxHome: "SKILLMUX",
      skill: "terminal-ui",
      agent: "codex"
    });
    expect(services.reload).toHaveBeenCalledWith({
      homeDir: "HOME",
      skillmuxHome: "SKILLMUX",
      platform: "win32",
      selectedAgentId: "codex",
      selectedSkillId: "terminal-ui"
    });
    expect(result).toEqual({
      model: reloadedModel,
      statusMessage: "Enabled terminal-ui"
    });
  });

  it("uses the model selected row instead of an externally supplied row", async () => {
    const selectedRow = disabledRow();
    const model = createModel({
      skills: [enabledOtherRow(), selectedRow],
      selectedSkillId: selectedRow.id
    });
    const services = createServices();

    await dispatchTuiAction({
      action: "toggle",
      model,
      services
    });

    expect(services.runEnable).toHaveBeenCalledWith({
      homeDir: undefined,
      skillmuxHome: undefined,
      skill: "terminal-ui",
      agent: "codex"
    });
    expect(services.runDisable).not.toHaveBeenCalled();
  });

  it("disables an enabled managed row", async () => {
    const model = createModelWithSelectedSkill(enabledRow());
    const services = createServices();

    await dispatchTuiAction({
      action: "toggle",
      model,
      services
    });

    expect(services.runDisable).toHaveBeenCalledWith({
      homeDir: undefined,
      skillmuxHome: undefined,
      skill: "terminal-ui",
      agent: "codex"
    });
  });

  it("adopts an unmanaged row using the row skill name", async () => {
    const model = createModelWithSelectedSkill(unmanagedRow());
    const services = createServices();

    await dispatchTuiAction({
      action: "adopt",
      model,
      services
    });

    expect(services.runAdopt).toHaveBeenCalledWith({
      homeDir: undefined,
      skillmuxHome: undefined,
      agent: "codex",
      skill: "terminal-ui"
    });
  });

  it("adopts all unmanaged skills for the selected agent without a skill id", async () => {
    const model = createModel({
      agents: [
        agentRow({ unmanagedCount: 2 })
      ],
      selectedAgentId: "codex",
      selectedSkillId: null
    });
    const reloadedModel = createModel({ selectedAgentId: "codex" });
    const services = createServices({
      runAdopt: vi.fn().mockResolvedValue({ output: "Adopted all\n" }),
      reload: vi.fn().mockResolvedValue(reloadedModel)
    });

    const result = await dispatchTuiAction({
      action: "adopt-all" as never,
      model,
      services
    });

    expect(services.runAdopt).toHaveBeenCalledWith({
      homeDir: undefined,
      skillmuxHome: undefined,
      agent: "codex"
    });
    expect(services.reload).toHaveBeenCalledWith({
      homeDir: undefined,
      skillmuxHome: undefined,
      platform: undefined,
      selectedAgentId: "codex",
      selectedSkillId: undefined
    });
    expect(result).toEqual({
      model: reloadedModel,
      statusMessage: "Adopted all"
    });
  });

  it("refuses to adopt non-adoptable rows", async () => {
    const model = createModelWithSelectedSkill(issueRow());
    const services = createServices();

    const result = await dispatchTuiAction({
      action: "adopt",
      model,
      services
    });

    expect(services.runAdopt).not.toHaveBeenCalled();
    expect(result.model).toBe(model);
    expect(result.statusMessage).toBe("Adopt is only available for unmanaged rows");
  });

  it("asks for a selection when the selected row is missing", async () => {
    const model = createModel({
      skills: [disabledRow()],
      selectedSkillId: "missing-row"
    });
    const services = createServices();

    const result = await dispatchTuiAction({
      action: "toggle",
      model,
      services
    });

    expect(services.runEnable).not.toHaveBeenCalled();
    expect(services.runDisable).not.toHaveBeenCalled();
    expect(result).toEqual({
      model,
      statusMessage: "Select a skill first"
    });
  });

  it("refuses to remove enabled rows", async () => {
    const model = createModelWithSelectedSkill(enabledRow());
    const services = createServices();

    const result = await dispatchTuiAction({
      action: "remove",
      model,
      services
    });

    expect(services.runRemove).not.toHaveBeenCalled();
    expect(result.model).toBe(model);
    expect(result.statusMessage).toBe("Disable this skill before removing it");
  });

  it("removes a disabled managed row using the row skill id", async () => {
    const model = createModelWithSelectedSkill(disabledRow());
    const services = createServices();

    await dispatchTuiAction({
      action: "remove",
      model,
      services
    });

    expect(services.runRemove).toHaveBeenCalledWith({
      homeDir: undefined,
      skillmuxHome: undefined,
      skill: "terminal-ui"
    });
  });

  it("keeps the original model and hides stack traces when a command fails", async () => {
    const model = createModelWithSelectedSkill(unmanagedRow());
    const services = createServices({
      runAdopt: vi
        .fn()
        .mockRejectedValue(new Error("Cannot adopt\n    at internal.ts:1:1")),
      reload: vi.fn()
    });

    const result = await dispatchTuiAction({
      action: "adopt",
      model,
      services
    });

    expect(result.model).toBe(model);
    expect(result.statusMessage).toBe("Adopt failed: Cannot adopt");
    expect(result.statusMessage).not.toContain("internal.ts");
    expect(services.reload).not.toHaveBeenCalled();
  });

  it("refuses bulk adopt when there is no selected agent", async () => {
    const model = createModel({
      selectedAgentId: null,
      selectedSkillId: null
    });
    const services = createServices();

    const result = await dispatchTuiAction({
      action: "adopt-all" as never,
      model,
      services
    });

    expect(services.runAdopt).not.toHaveBeenCalled();
    expect(result.model).toBe(model);
    expect(result.statusMessage).toBe("Select an agent first");
  });

  it("scans and reloads dashboard state", async () => {
    const model = createModel({
      selectedAgentId: "codex",
      selectedSkillId: "terminal-ui"
    });
    const reloadedModel = createModel({ selectedSkillId: "terminal-ui" });
    const services = createServices({
      runScan: vi.fn().mockResolvedValue({ output: "Scan complete\n" }),
      reload: vi.fn().mockResolvedValue(reloadedModel)
    });

    const result = await dispatchTuiAction({
      action: "scan",
      model,
      homeDir: "HOME",
      skillmuxHome: "SKILLMUX",
      platform: "win32",
      services
    });

    expect(services.runScan).toHaveBeenCalledWith({
      homeDir: "HOME",
      skillmuxHome: "SKILLMUX",
      platform: "win32"
    });
    expect(services.reload).toHaveBeenCalledWith({
      homeDir: "HOME",
      skillmuxHome: "SKILLMUX",
      platform: "win32",
      selectedAgentId: "codex",
      selectedSkillId: "terminal-ui"
    });
    expect(result).toEqual({
      model: reloadedModel,
      statusMessage: "Scan complete"
    });
  });

  it("calls config add agent with a normalized payload and reloads the new agent", async () => {
    const model = createModel({
      selectedAgentId: "codex",
      selectedSkillId: "terminal-ui"
    });
    const reloadedModel = createModel({
      selectedAgentId: "claude-code",
      selectedSkillId: null
    });
    const services = createServices({
      runConfigAddAgent: vi.fn().mockResolvedValue({
        output: "Added agent\n\n"
      }),
      reload: vi.fn().mockResolvedValue(reloadedModel)
    });
    const command: TuiPendingCommand = {
      kind: "config-add-agent",
      input: {
        id: "  Claude Code  ",
        root: " agents ",
        skills: "  skills  ",
        name: "  Claude Code  ",
        platforms: ["win32", "linux", "linux"],
        disabledByDefault: true
      } satisfies RunConfigAddAgentOptions
    };

    const result = await dispatchTuiAction({
      ...createPendingCommand(command, model),
      services
    });

    expect(services.runConfigAddAgent).toHaveBeenCalledWith({
      homeDir: undefined,
      skillmuxHome: undefined,
      id: "Claude Code",
      root: "agents",
      skills: "skills",
      name: "Claude Code",
      platforms: ["win32", "linux"],
      disabledByDefault: true
    });
    expect(services.reload).toHaveBeenCalledWith({
      homeDir: undefined,
      skillmuxHome: undefined,
      platform: undefined,
      selectedAgentId: "claude-code",
      selectedSkillId: undefined
    });
    expect(result).toEqual({
      model: reloadedModel,
      statusMessage: "Added agent"
    });
  });

  it("calls config update agent and keeps the edited agent selected after reload", async () => {
    const model = createModel({
      selectedAgentId: "codex",
      selectedSkillId: "terminal-ui"
    });
    const reloadedModel = createModel({
      selectedAgentId: "codex",
      selectedSkillId: null
    });
    const services = createServices({
      runConfigUpdateAgent: vi.fn().mockResolvedValue({
        output: "Updated agent\n"
      }),
      reload: vi.fn().mockResolvedValue(reloadedModel)
    });
    const command: TuiPendingCommand = {
      kind: "config-update-agent",
      input: {
        id: "codex",
        root: "agents",
        skills: "skills",
        name: "OpenAI Codex",
        platforms: ["linux"],
        disabledByDefault: true
      } satisfies RunConfigUpdateAgentOptions
    };

    const result = await dispatchTuiAction({
      ...createPendingCommand(command, model),
      services
    });

    expect(services.runConfigUpdateAgent).toHaveBeenCalledWith({
      homeDir: undefined,
      skillmuxHome: undefined,
      id: "codex",
      root: "agents",
      skills: "skills",
      name: "OpenAI Codex",
      platforms: ["linux"],
      disabledByDefault: true
    });
    expect(services.reload).toHaveBeenCalledWith({
      homeDir: undefined,
      skillmuxHome: undefined,
      platform: undefined,
      selectedAgentId: "codex",
      selectedSkillId: undefined
    });
    expect(result).toEqual({
      model: reloadedModel,
      statusMessage: "Updated agent"
    });
  });

  it("preserves sparse update-agent patches instead of baking inherited defaults into config", async () => {
    const model = createModel({
      selectedAgentId: "codex",
      selectedSkillId: "terminal-ui"
    });
    const reloadedModel = createModel({
      selectedAgentId: "codex",
      selectedSkillId: null
    });
    const services = createServices({
      runConfigUpdateAgent: vi.fn().mockResolvedValue({
        output: "Updated sparse agent\n"
      }),
      reload: vi.fn().mockResolvedValue(reloadedModel)
    });
    const command: TuiPendingCommand = {
      kind: "config-update-agent",
      input: {
        id: "codex",
        name: "Codex Override"
      } satisfies RunConfigUpdateAgentOptions
    };

    const result = await dispatchTuiAction({
      ...createPendingCommand(command, model),
      services
    });

    expect(services.runConfigUpdateAgent).toHaveBeenCalledWith({
      homeDir: undefined,
      skillmuxHome: undefined,
      id: "codex",
      name: "Codex Override"
    });
    expect(result).toEqual({
      model: reloadedModel,
      statusMessage: "Updated sparse agent"
    });
  });

  it("calls config remove agent and clears the selected agent before reloading", async () => {
    const model = createModel({
      selectedAgentId: "codex",
      selectedSkillId: "terminal-ui"
    });
    const reloadedModel = createModel({
      selectedAgentId: "claude",
      selectedSkillId: null
    });
    const services = createServices({
      runConfigRemoveAgent: vi.fn().mockResolvedValue({
        output: "Removed agent\n"
      }),
      reload: vi.fn().mockResolvedValue(reloadedModel)
    });
    const command: TuiPendingCommand = {
      kind: "config-remove-agent",
      input: {
        id: "codex"
      } satisfies RunConfigRemoveAgentOptions
    };

    const result = await dispatchTuiAction({
      ...createPendingCommand(command, model),
      services
    });

    expect(services.runConfigRemoveAgent).toHaveBeenCalledWith({
      homeDir: undefined,
      skillmuxHome: undefined,
      id: "codex"
    });
    expect(services.reload).toHaveBeenCalledWith({
      homeDir: undefined,
      skillmuxHome: undefined,
      platform: undefined,
      selectedAgentId: undefined,
      selectedSkillId: undefined
    });
    expect(result).toEqual({
      model: reloadedModel,
      statusMessage: "Removed agent"
    });
  });

  it("calls import with the staged payload and reloads the current selection", async () => {
    const model = createModel({
      selectedAgentId: "codex",
      selectedSkillId: "terminal-ui"
    });
    const reloadedModel = createModel({
      selectedAgentId: "codex",
      selectedSkillId: "terminal-ui"
    });
    const services = createServices({
      runImport: vi.fn().mockResolvedValue({
        output: "Imported skill\n"
      }),
      reload: vi.fn().mockResolvedValue(reloadedModel)
    });
    const command: TuiPendingCommand = {
      kind: "import-skill",
      input: {
        sourcePath: "C:/source/skill",
        skillName: "find-skills"
      } satisfies RunImportOptions
    };

    const result = await dispatchTuiAction({
      ...createPendingCommand(command, model),
      services
    });

    expect(services.runImport).toHaveBeenCalledWith({
      homeDir: undefined,
      skillmuxHome: undefined,
      sourcePath: "C:/source/skill",
      skillName: "find-skills"
    });
    expect(services.reload).toHaveBeenCalledWith({
      homeDir: undefined,
      skillmuxHome: undefined,
      platform: undefined,
      selectedAgentId: "codex",
      selectedSkillId: "terminal-ui"
    });
    expect(result).toEqual({
      model: reloadedModel,
      statusMessage: "Imported skill"
    });
  });

  it("returns structured doctor output without forcing a dashboard reload", async () => {
    const model = createModel({
      selectedAgentId: "codex",
      selectedSkillId: "terminal-ui"
    });
    const doctorResult: RunDoctorResult = {
      skillmuxHome: "C:/skillmux",
      manifest: {
        version: 1,
        skillmuxHome: "C:/skillmux",
        skills: {},
        agents: {},
        activations: [],
        lastScan: {
          at: null,
          issues: []
        }
      },
      config: {
        version: 1,
        agents: {}
      },
      agents: [],
      entries: [],
      issues: [
        {
          code: "missing-agent",
          severity: "warning",
          path: "C:/Users/me/.codex/skills",
          message: "Missing agent"
        }
      ],
      output: "Doctor found issues\n"
    };
    const services = createServices({
      runDoctor: vi.fn().mockResolvedValue(doctorResult),
      reload: vi.fn()
    });
    const command: TuiPendingCommand = {
      kind: "doctor"
    };

    const result = await dispatchTuiAction({
      ...createPendingCommand(command, model),
      services
    });

    expect(services.runDoctor).toHaveBeenCalledWith({
      homeDir: undefined,
      skillmuxHome: undefined,
      platform: undefined
    });
    expect(services.reload).not.toHaveBeenCalled();
    expect(result).toEqual({
      model,
      statusMessage: "Doctor found issues",
      doctor: doctorResult
    });
  });
});

import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  dispatchTuiAction,
  type TuiActionServices
} from "../../src/tui/actions";
import type {
  DashboardModel,
  TuiDisabledSkillRow,
  TuiEnabledSkillRow,
  TuiSkillRow
} from "../../src/tui/dashboard-model";

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

function createServices(
  overrides: Partial<TuiActionServices> = {}
): TuiActionServices {
  return {
    runEnable: vi.fn().mockResolvedValue({ output: "Enabled terminal-ui\n" }),
    runDisable: vi.fn().mockResolvedValue({ output: "Disabled terminal-ui\n" }),
    runAdopt: vi.fn().mockResolvedValue({ output: "Adopted terminal-ui\n" }),
    runRemove: vi.fn().mockResolvedValue({ output: "Removed terminal-ui\n" }),
    runScan: vi.fn().mockResolvedValue({ output: "Scanned skills\n" }),
    reload: vi.fn().mockResolvedValue(createModel({ selectedSkillId: "reloaded" })),
    ...overrides
  };
}

describe("dispatchTuiAction", () => {
  it("enables a disabled managed row, reloads, and trims trailing newlines", async () => {
    const model = createModel({ selectedSkillId: "terminal-ui" });
    const reloadedModel = createModel({ selectedSkillId: "terminal-ui" });
    const services = createServices({
      runEnable: vi.fn().mockResolvedValue({ output: "Enabled terminal-ui\n\n" }),
      reload: vi.fn().mockResolvedValue(reloadedModel)
    });

    const result = await dispatchTuiAction({
      action: "toggle",
      model,
      selectedSkill: disabledRow(),
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

  it("disables an enabled managed row", async () => {
    const model = createModel();
    const services = createServices();

    await dispatchTuiAction({
      action: "toggle",
      model,
      selectedSkill: enabledRow(),
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
    const model = createModel({ selectedSkillId: "unmanaged:terminal-ui" });
    const services = createServices();

    await dispatchTuiAction({
      action: "adopt",
      model,
      selectedSkill: unmanagedRow(),
      services
    });

    expect(services.runAdopt).toHaveBeenCalledWith({
      homeDir: undefined,
      skillmuxHome: undefined,
      agent: "codex",
      skill: "terminal-ui"
    });
  });

  it("refuses to adopt non-adoptable rows", async () => {
    const model = createModel({
      selectedSkillId: "issue:codex:unknown-entry:notes.txt"
    });
    const services = createServices();

    const result = await dispatchTuiAction({
      action: "adopt",
      model,
      selectedSkill: issueRow(),
      services
    });

    expect(services.runAdopt).not.toHaveBeenCalled();
    expect(result.model).toBe(model);
    expect(result.statusMessage).toBe("Adopt is only available for unmanaged rows");
  });

  it("refuses to remove enabled rows", async () => {
    const model = createModel();
    const services = createServices();

    const result = await dispatchTuiAction({
      action: "remove",
      model,
      selectedSkill: enabledRow(),
      services
    });

    expect(services.runRemove).not.toHaveBeenCalled();
    expect(result.model).toBe(model);
    expect(result.statusMessage).toBe("Disable this skill before removing it");
  });

  it("removes a disabled managed row using the row skill id", async () => {
    const model = createModel();
    const services = createServices();

    await dispatchTuiAction({
      action: "remove",
      model,
      selectedSkill: disabledRow(),
      services
    });

    expect(services.runRemove).toHaveBeenCalledWith({
      homeDir: undefined,
      skillmuxHome: undefined,
      skill: "terminal-ui"
    });
  });

  it("keeps the original model and hides stack traces when a command fails", async () => {
    const model = createModel({ selectedSkillId: "unmanaged:terminal-ui" });
    const services = createServices({
      runAdopt: vi
        .fn()
        .mockRejectedValue(new Error("Cannot adopt\n    at internal.ts:1:1")),
      reload: vi.fn()
    });

    const result = await dispatchTuiAction({
      action: "adopt",
      model,
      selectedSkill: unmanagedRow(),
      services
    });

    expect(result.model).toBe(model);
    expect(result.statusMessage).toBe("Adopt failed: Cannot adopt");
    expect(result.statusMessage).not.toContain("internal.ts");
    expect(services.reload).not.toHaveBeenCalled();
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
      selectedSkill: null,
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
});

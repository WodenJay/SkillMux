import React from "react";
import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import { App } from "../../src/tui/app";
import type {
  DashboardModel,
  TuiAgentRow,
  TuiEnabledSkillRow
} from "../../src/tui/dashboard-model";

function agent(overrides: Partial<TuiAgentRow> = {}): TuiAgentRow {
  return {
    id: "codex",
    name: "codex",
    path: "C:\\Users\\me\\.codex\\skills",
    discovery: "builtin",
    exists: true,
    supported: true,
    hasUserOverride: false,
    canEditOverride: false,
    canRemoveOverride: false,
    enabledCount: 1,
    disabledCount: 0,
    unmanagedCount: 0,
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
    marker: "*" as TuiEnabledSkillRow["marker"],
    skillId: "using-superpowers",
    name: "using-superpowers",
    path: "C:\\Users\\me\\.skillmux\\skills\\using-superpowers",
    agentId: "codex",
    activationLinkPath: "C:\\Users\\me\\.codex\\skills\\using-superpowers",
    ...overrides
  };
}

function model(overrides: Partial<DashboardModel> = {}): DashboardModel {
  const skills = overrides.skills ?? [enabledSkill()];

  return {
    agents: overrides.agents ?? [agent()],
    skills,
    selectedAgentId: overrides.selectedAgentId ?? "codex",
    selectedSkillId: overrides.selectedSkillId ?? skills[0]?.id ?? null,
    lastScanAt: null,
    issueCount: 0,
    ...overrides
  };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe("TUI focus input", () => {
  it("uses right arrow to move focus to skills so Space can toggle", async () => {
    const loadDashboardState = vi.fn().mockResolvedValue(model());
    const dispatchTuiAction = vi.fn().mockResolvedValue({
      model: model(),
      statusMessage: "Toggled using-superpowers"
    });
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

  it("does not use Tab as a focus switch", async () => {
    const loadDashboardState = vi.fn().mockResolvedValue(model());
    const dispatchTuiAction = vi.fn().mockResolvedValue({
      model: model(),
      statusMessage: "Toggled using-superpowers"
    });
    const { stdin } = render(
      <App
        services={{ loadDashboardState, dispatchTuiAction }}
        terminalWidth={80}
        terminalHeight={24}
      />
    );

    await settle();
    stdin.write("\t");
    await settle();
    stdin.write(" ");
    await settle();
    await settle();

    expect(dispatchTuiAction).not.toHaveBeenCalled();
  });

  it("uses left arrow to move focus back to agents", async () => {
    const loadDashboardState = vi.fn().mockResolvedValue(model());
    const dispatchTuiAction = vi.fn().mockResolvedValue({
      model: model(),
      statusMessage: "Toggled using-superpowers"
    });
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
    stdin.write("\u001B[D");
    await settle();
    stdin.write(" ");
    await settle();
    await settle();

    expect(dispatchTuiAction).not.toHaveBeenCalled();
  });
});

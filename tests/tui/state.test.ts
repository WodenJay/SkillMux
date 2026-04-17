import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type {
  DashboardModel,
  TuiAgentRow,
  TuiDisabledSkillRow,
  TuiEnabledSkillRow,
  TuiIssueSkillRow,
  TuiUnmanagedSkillRow
} from "../../src/tui/dashboard-model";
import {
  createInitialTuiState,
  getAvailableActions,
  getSelectedSkill,
  getVisibleAgents,
  getVisibleSkills,
  updateTuiState
} from "../../src/tui/state";

function agent(id: string, name = id): TuiAgentRow {
  return {
    id,
    name,
    path: join("C:", "Users", "me", `.${id}`, "skills"),
    discovery: "builtin",
    exists: true,
    supported: true,
    enabledCount: 0,
    disabledCount: 0,
    unmanagedCount: 0,
    issueCount: 0
  };
}

function enabledSkill(overrides: Partial<TuiEnabledSkillRow> = {}): TuiEnabledSkillRow {
  const skillId = overrides.skillId ?? "terminal-ui";
  const agentId = overrides.agentId ?? "codex";

  return {
    id: overrides.id ?? skillId,
    kind: "enabled",
    marker: "" as TuiEnabledSkillRow["marker"],
    skillId,
    name: overrides.name ?? "Terminal UI",
    path: join("C:", "skillmux", "skills", skillId),
    agentId,
    activationLinkPath: join("C:", "Users", "me", `.${agentId}`, "skills", skillId),
    ...overrides
  };
}

function disabledSkill(
  overrides: Partial<TuiDisabledSkillRow> = {}
): TuiDisabledSkillRow {
  const skillId = overrides.skillId ?? "paper-polish";
  const agentId = overrides.agentId ?? "codex";

  return {
    id: overrides.id ?? skillId,
    kind: "disabled",
    marker: "" as TuiDisabledSkillRow["marker"],
    skillId,
    name: overrides.name ?? "Paper Polish",
    path: join("C:", "skillmux", "skills", skillId),
    agentId,
    activationLinkPath: null,
    ...overrides
  };
}

function unmanagedSkill(
  overrides: Partial<TuiUnmanagedSkillRow> = {}
): TuiUnmanagedSkillRow {
  const skillName = overrides.skillName ?? "find-skills";
  const agentId = overrides.agentId ?? "codex";

  return {
    id: overrides.id ?? `unmanaged:${skillName}`,
    kind: "unmanaged",
    marker: "?",
    skillName,
    name: overrides.name ?? "Find Skills",
    path: join("C:", "Users", "me", `.${agentId}`, "skills", skillName),
    agentId,
    entryKind: "unmanaged-directory",
    ...overrides
  };
}

function issueSkill(overrides: Partial<TuiIssueSkillRow> = {}): TuiIssueSkillRow {
  const agentId = overrides.agentId ?? "codex";

  return {
    id: overrides.id ?? "issue:codex:broken",
    kind: "issue",
    marker: "!",
    issueCode: "broken",
    severity: "warning",
    message: "Broken skill entry",
    path: join("C:", "Users", "me", `.${agentId}`, "skills", "broken"),
    agentId,
    ...overrides
  };
}

function model(overrides: Partial<DashboardModel> = {}): DashboardModel {
  const agents = overrides.agents ?? [agent("codex"), agent("claude"), agent("gemini")];
  const skills =
    overrides.skills ??
    [
      enabledSkill({ id: "terminal-ui" }),
      disabledSkill({ id: "paper-polish" }),
      unmanagedSkill({ id: "unmanaged:find-skills" }),
      issueSkill({ id: "issue:codex:broken" })
    ];

  return {
    agents,
    skills,
    selectedAgentId: overrides.selectedAgentId ?? agents[0]?.id ?? null,
    selectedSkillId: overrides.selectedSkillId ?? skills[0]?.id ?? null,
    lastScanAt: null,
    issueCount: 0,
    ...overrides
  };
}

describe("TUI state reducer", () => {
  it("cycles focus forward and backward", () => {
    const initial = createInitialTuiState(model());

    const skillsFocused = updateTuiState(initial, { type: "focus-next" });
    const detailFocused = updateTuiState(skillsFocused, { type: "focus-next" });
    const agentsFocused = updateTuiState(detailFocused, { type: "focus-next" });

    expect(skillsFocused.focus).toBe("skills");
    expect(detailFocused.focus).toBe("detail");
    expect(agentsFocused.focus).toBe("agents");
    expect(updateTuiState(agentsFocused, { type: "focus-previous" }).focus).toBe(
      "detail"
    );
  });

  it("opens remove confirmation only for disabled managed rows", () => {
    const disabled = updateTuiState(
      createInitialTuiState(model({ selectedSkillId: "paper-polish" })),
      { type: "focus-next" }
    );
    const enabled = createInitialTuiState(
      model({ selectedSkillId: "terminal-ui" })
    );

    expect(updateTuiState(disabled, { type: "request-remove" }).modal).toEqual({
      kind: "confirm-remove",
      skillId: "paper-polish"
    });
    expect(updateTuiState(enabled, { type: "request-remove" }).modal).toBeNull();
  });

  it("opens search on the focused list and filters only that panel", () => {
    const initial = createInitialTuiState(model());
    const agentSearch = updateTuiState(initial, { type: "open-search" });
    const filteredAgents = updateTuiState(agentSearch, {
      type: "search-query-changed",
      query: "cla"
    });
    const skillsFocused = updateTuiState(initial, { type: "focus-next" });
    const skillSearch = updateTuiState(skillsFocused, { type: "open-search" });
    const filteredSkills = updateTuiState(skillSearch, {
      type: "search-query-changed",
      query: "paper"
    });

    expect(agentSearch.search).toEqual({ panel: "agents", query: "" });
    expect(getVisibleAgents(filteredAgents).map((row) => row.id)).toEqual([
      "claude"
    ]);
    expect(getVisibleSkills(filteredAgents)).toHaveLength(0);
    expect(skillSearch.search).toEqual({ panel: "skills", query: "" });
    expect(getVisibleSkills(filteredSkills).map((row) => row.id)).toEqual([
      "paper-polish"
    ]);
    expect(getVisibleAgents(filteredSkills)).toHaveLength(3);
  });

  it("closes search with close without changing selection", () => {
    const searching = updateTuiState(createInitialTuiState(model()), {
      type: "open-search"
    });
    const closed = updateTuiState(searching, { type: "close" });

    expect(closed.search).toBeNull();
    expect(closed.model.selectedAgentId).toBe("codex");
  });

  it("opens the help modal", () => {
    const state = createInitialTuiState(model());

    expect(updateTuiState(state, { type: "open-help" }).modal).toEqual({
      kind: "help"
    });
  });

  it("derives footer action availability from selected row state", () => {
    const baseState = updateTuiState(createInitialTuiState(model()), {
      type: "focus-next"
    });

    expect(getAvailableActions(baseState).toggle).toBe(true);
    expect(
      getAvailableActions(
        updateTuiState(
          createInitialTuiState(model({ selectedSkillId: "paper-polish" })),
          { type: "focus-next" }
        )
      )
    ).toMatchObject({ toggle: true, remove: true, adopt: false });
    expect(
      getAvailableActions(
        updateTuiState(
          createInitialTuiState(model({ selectedSkillId: "unmanaged:find-skills" })),
          { type: "focus-next" }
        )
      )
    ).toMatchObject({ toggle: false, remove: false, adopt: true });
    expect(
      getAvailableActions(
        updateTuiState(
          createInitialTuiState(model({ selectedSkillId: "issue:codex:broken" })),
          { type: "focus-next" }
        )
      )
    ).toMatchObject({ toggle: false, remove: false, adopt: false });
  });

  it("updates selected model row ids while navigating visible rows", () => {
    const state = createInitialTuiState(
      model({
        agents: [agent("codex"), agent("claude")],
        skills: [
          enabledSkill({ id: "codex-skill", skillId: "codex-skill", agentId: "codex" }),
          enabledSkill({
            id: "claude-skill",
            skillId: "claude-skill",
            agentId: "claude"
          })
        ],
        selectedAgentId: "codex",
        selectedSkillId: "codex-skill"
      })
    );

    const nextAgent = updateTuiState(state, { type: "next-row" });
    const skillsFocused = updateTuiState(nextAgent, { type: "focus-next" });
    const nextSkill = updateTuiState(skillsFocused, { type: "next-row" });

    expect(nextAgent.agentCursor).toBe(1);
    expect(nextAgent.model.selectedAgentId).toBe("claude");
    expect(nextAgent.model.selectedSkillId).toBe("claude-skill");
    expect(nextSkill.skillCursor).toBe(0);
    expect(nextSkill.model.selectedSkillId).toBe("claude-skill");
    expect(getSelectedSkill(nextSkill)?.id).toBe("claude-skill");
  });

  it("sets pending toggle action only for managed skill rows", () => {
    const enabled = updateTuiState(
      createInitialTuiState(model({ selectedSkillId: "terminal-ui" })),
      { type: "focus-next" }
    );
    const unmanaged = updateTuiState(
      createInitialTuiState(model({ selectedSkillId: "unmanaged:find-skills" })),
      { type: "focus-next" }
    );

    expect(updateTuiState(enabled, { type: "request-toggle" }).pendingAction).toBe(
      "toggle"
    );
    expect(
      updateTuiState(unmanaged, { type: "request-toggle" }).pendingAction
    ).toBeNull();
  });

  it("opens adopt confirmation only for unmanaged rows", () => {
    const unmanaged = updateTuiState(
      createInitialTuiState(model({ selectedSkillId: "unmanaged:find-skills" })),
      { type: "focus-next" }
    );
    const disabled = updateTuiState(
      createInitialTuiState(model({ selectedSkillId: "paper-polish" })),
      { type: "focus-next" }
    );

    expect(updateTuiState(unmanaged, { type: "request-adopt" }).modal).toEqual({
      kind: "confirm-adopt",
      skillId: "find-skills",
      agentId: "codex"
    });
    expect(updateTuiState(disabled, { type: "request-adopt" }).modal).toBeNull();
  });

  it("traps dashboard events while a modal is open but allows close and status updates", () => {
    const withModal = updateTuiState(createInitialTuiState(model()), {
      type: "open-help"
    });
    const moved = updateTuiState(withModal, { type: "focus-next" });
    const searched = updateTuiState(withModal, { type: "open-search" });
    const requested = updateTuiState(withModal, { type: "request-scan" });
    const busy = updateTuiState(withModal, { type: "set-busy", busy: true });
    const status = updateTuiState(withModal, {
      type: "set-status",
      message: "Scanning"
    });

    expect(moved).toMatchObject({
      focus: "agents",
      agentCursor: 0,
      skillCursor: 0,
      modal: { kind: "help" }
    });
    expect(searched.search).toBeNull();
    expect(requested.pendingAction).toBeNull();
    expect(busy.busy).toBe(true);
    expect(status.statusMessage).toBe("Scanning");
    expect(updateTuiState(withModal, { type: "close" }).modal).toBeNull();
  });

  it("gates footer and requested row actions to skills focus", () => {
    const agentsFocused = createInitialTuiState(
      model({ selectedSkillId: "paper-polish" })
    );
    const skillsFocused = updateTuiState(agentsFocused, { type: "focus-next" });

    expect(getAvailableActions(agentsFocused)).toMatchObject({
      toggle: false,
      adopt: false,
      remove: false
    });
    expect(getAvailableActions(skillsFocused)).toMatchObject({
      toggle: true,
      remove: true
    });
    expect(
      updateTuiState(agentsFocused, { type: "request-toggle" }).pendingAction
    ).toBeNull();
    expect(updateTuiState(agentsFocused, { type: "request-remove" }).modal).toBeNull();
    expect(
      updateTuiState(skillsFocused, { type: "request-toggle" }).pendingAction
    ).toBe("toggle");
  });

  it("tracks selected agent and skill rows when search filtering hides the previous selection", () => {
    const searchAgents = updateTuiState(createInitialTuiState(model()), {
      type: "open-search"
    });
    const filteredAgents = updateTuiState(searchAgents, {
      type: "search-query-changed",
      query: "cla"
    });
    const skillsFocused = updateTuiState(createInitialTuiState(model()), {
      type: "focus-next"
    });
    const searchSkills = updateTuiState(skillsFocused, { type: "open-search" });
    const filteredSkills = updateTuiState(searchSkills, {
      type: "search-query-changed",
      query: "paper"
    });

    expect(filteredAgents.model.selectedAgentId).toBe("claude");
    expect(filteredAgents.model.selectedSkillId).toBeNull();
    expect(filteredSkills.model.selectedSkillId).toBe("paper-polish");
    expect(getSelectedSkill(filteredSkills)?.id).toBe("paper-polish");
    expect(getAvailableActions(filteredSkills)).toMatchObject({
      toggle: true,
      remove: true
    });
  });
});

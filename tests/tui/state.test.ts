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
  consumePendingCommandIntent,
  consumeAgentSelectionIntent,
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
    stableName: name,
    path: join("C:", "Users", "me", `.${id}`, "skills"),
    homeRelativeRootPath: `.${id}`,
    skillsDirectoryPath: "skills",
    supportedPlatforms: ["win32", "linux", "darwin"],
    enabledByDefault: true,
    discovery: "builtin",
    exists: true,
    supported: true,
    hasUserOverride: false,
    canEditOverride: false,
    canRemoveOverride: false,
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
  it("cycles focus only between agents and skills", () => {
    const initial = createInitialTuiState(model());

    const skillsFocused = updateTuiState(initial, { type: "focus-next" });
    const agentsFocused = updateTuiState(skillsFocused, { type: "focus-next" });

    expect(skillsFocused.focus).toBe("skills");
    expect(agentsFocused.focus).toBe("agents");
    expect(updateTuiState(agentsFocused, { type: "focus-previous" }).focus).toBe(
      "skills"
    );
  });

  it("keeps the selected agent while skills has focus", () => {
    const initial = createInitialTuiState(
      model({
        agents: [agent("codex"), agent("claude")],
        selectedAgentId: "claude",
        selectedSkillId: null,
        skills: []
      })
    );

    const skillsFocused = updateTuiState(initial, { type: "focus-next" });

    expect(skillsFocused.focus).toBe("skills");
    expect(skillsFocused.model.selectedAgentId).toBe("claude");
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

    expect(agentSearch.search).toMatchObject({ panel: "agents", query: "" });
    expect(getVisibleAgents(filteredAgents).map((row) => row.id)).toEqual([
      "claude"
    ]);
    expect(getVisibleSkills(filteredAgents)).toHaveLength(0);
    expect(skillSearch.search).toMatchObject({ panel: "skills", query: "" });
    expect(getVisibleSkills(filteredSkills).map((row) => row.id)).toEqual([
      "paper-polish"
    ]);
    expect(getVisibleAgents(filteredSkills)).toHaveLength(3);
  });

  it("hides missing agents without local state from the default list but keeps them searchable", () => {
    const initial = createInitialTuiState(
      model({
        agents: [
          agent("codex", "OpenAI Codex"),
          {
            ...agent("gemini", "Gemini CLI"),
            exists: false
          },
          {
            ...agent("openclaw", "OpenClaw"),
            exists: false
          },
          {
            ...agent("agents", "Agents"),
            exists: false,
            issueCount: 1
          },
          {
            ...agent("claude", "Claude Code"),
            exists: false
          }
        ]
      })
    );
    const search = updateTuiState(initial, { type: "open-search" });
    const filtered = updateTuiState(search, {
      type: "search-query-changed",
      query: "claude"
    });

    expect(getVisibleAgents(initial).map((row) => row.id)).toEqual([
      "codex",
      "agents"
    ]);
    expect(getVisibleAgents(filtered).map((row) => row.id)).toEqual(["claude"]);
  });

  it("closes search with close without changing selection", () => {
    const searching = updateTuiState(createInitialTuiState(model()), {
      type: "open-search"
    });
    const closed = updateTuiState(searching, { type: "close" });

    expect(closed.search).toBeNull();
    expect(closed.model.selectedAgentId).toBe("codex");
  });

  it("restores the previous selection when cancelling a filtered search", () => {
    const agentSearch = updateTuiState(createInitialTuiState(model()), {
      type: "open-search"
    });
    const noMatchingAgents = updateTuiState(agentSearch, {
      type: "search-query-changed",
      query: "missing-agent"
    });
    const restoredAgents = updateTuiState(noMatchingAgents, { type: "close" });
    const skillsFocused = updateTuiState(createInitialTuiState(model()), {
      type: "focus-next"
    });
    const skillSearch = updateTuiState(skillsFocused, { type: "open-search" });
    const filteredSkills = updateTuiState(skillSearch, {
      type: "search-query-changed",
      query: "paper"
    });
    const restoredSkills = updateTuiState(filteredSkills, { type: "close" });

    expect(restoredAgents.search).toBeNull();
    expect(restoredAgents.model.selectedAgentId).toBe("codex");
    expect(restoredAgents.model.selectedSkillId).toBe("terminal-ui");
    expect(restoredAgents.pendingAgentId).toBeNull();
    expect(restoredSkills.search).toBeNull();
    expect(restoredSkills.model.selectedSkillId).toBe("terminal-ui");
  });

  it("keeps the current filtered selection when submitting search", () => {
    const agentSearch = updateTuiState(createInitialTuiState(model()), {
      type: "open-search"
    });
    const filteredAgents = updateTuiState(agentSearch, {
      type: "search-query-changed",
      query: "cla"
    });
    const submittedAgents = updateTuiState(filteredAgents, {
      type: "submit-search"
    });
    const skillsFocused = updateTuiState(createInitialTuiState(model()), {
      type: "focus-next"
    });
    const skillSearch = updateTuiState(skillsFocused, { type: "open-search" });
    const filteredSkills = updateTuiState(skillSearch, {
      type: "search-query-changed",
      query: "paper"
    });
    const submittedSkills = updateTuiState(filteredSkills, {
      type: "submit-search"
    });

    expect(submittedAgents.search).toBeNull();
    expect(submittedAgents.model.selectedAgentId).toBe("claude");
    expect(submittedAgents.pendingAgentId).toBe("claude");
    expect(submittedSkills.search).toBeNull();
    expect(submittedSkills.model.selectedSkillId).toBe("paper-polish");
  });

  it("restores the previous selection when submitting a search with no matches", () => {
    const agentSearch = updateTuiState(createInitialTuiState(model()), {
      type: "open-search"
    });
    const noMatchingAgents = updateTuiState(agentSearch, {
      type: "search-query-changed",
      query: "missing-agent"
    });
    const submittedAgents = updateTuiState(noMatchingAgents, {
      type: "submit-search"
    });
    const skillsFocused = updateTuiState(createInitialTuiState(model()), {
      type: "focus-next"
    });
    const skillSearch = updateTuiState(skillsFocused, { type: "open-search" });
    const noMatchingSkills = updateTuiState(skillSearch, {
      type: "search-query-changed",
      query: "missing-skill"
    });
    const submittedSkills = updateTuiState(noMatchingSkills, {
      type: "submit-search"
    });

    expect(submittedAgents.search).toBeNull();
    expect(submittedAgents.model.selectedAgentId).toBe("codex");
    expect(submittedAgents.model.selectedSkillId).toBe("terminal-ui");
    expect(submittedAgents.pendingAgentId).toBeNull();
    expect(submittedSkills.search).toBeNull();
    expect(submittedSkills.model.selectedAgentId).toBe("codex");
    expect(submittedSkills.model.selectedSkillId).toBe("terminal-ui");
  });

  it("opens the help modal", () => {
    const state = createInitialTuiState(model());

    expect(updateTuiState(state, { type: "open-help" }).modal).toEqual({
      kind: "help"
    });
  });

  it("keeps config-only agent overrides visible in the default agent list", () => {
    const initial = createInitialTuiState(
      model({
        agents: [
          {
            ...agent("codex"),
            exists: false,
            hasUserOverride: true,
            canEditOverride: true,
            canRemoveOverride: true
          },
          agent("claude")
        ],
        selectedAgentId: "claude",
        selectedSkillId: null
      })
    );

    expect(getVisibleAgents(initial).map((row) => row.id)).toEqual([
      "codex",
      "claude"
    ]);
  });

  it("exposes the parity workflow actions for the selected agent", () => {
    const overrideAgent = createInitialTuiState(
      model({
        agents: [
          {
            ...agent("codex"),
            hasUserOverride: true,
            canEditOverride: true,
            canRemoveOverride: true
          },
          {
            ...agent("gemini"),
            exists: false,
            hasUserOverride: true,
            canEditOverride: false,
            canRemoveOverride: false
          },
          agent("claude")
        ],
        selectedAgentId: "codex",
        selectedSkillId: null
      })
    );
    const blockedOverride = createInitialTuiState(
      model({
        agents: [
          {
            ...agent("codex"),
            hasUserOverride: true,
            canEditOverride: false,
            canRemoveOverride: false
          }
        ],
        selectedAgentId: "codex",
        selectedSkillId: null
      })
    );
    const builtinOnly = createInitialTuiState(
      model({
        agents: [agent("codex"), agent("claude")],
        selectedAgentId: "codex",
        selectedSkillId: null
      })
    );

    expect(getAvailableActions(overrideAgent)).toEqual(
      expect.objectContaining({
        addAgent: true,
        editAgent: true,
        removeAgent: true,
        importSkill: true,
        doctor: true
      })
    );
    expect(getAvailableActions(blockedOverride)).toEqual(
      expect.objectContaining({
        addAgent: true,
        editAgent: false,
        removeAgent: false,
        importSkill: true,
        doctor: true
      })
    );
    expect(
      updateTuiState(
        blockedOverride,
        { type: "open-edit-agent" }
      ).statusMessage
    ).toBe("Select an agent override first");
    expect(
      updateTuiState(blockedOverride, { type: "open-remove-agent" }).statusMessage
    ).toBe("Select an agent override first");
    expect(getAvailableActions(builtinOnly)).toEqual(
      expect.objectContaining({
        addAgent: true,
        editAgent: false,
        removeAgent: false,
        importSkill: true,
        doctor: true
      })
    );
  });

  it("opens parity workflow modals from dedicated reducer events", () => {
    const overrideState = createInitialTuiState(
      model({
        agents: [
          {
            ...agent("codex"),
            hasUserOverride: true,
            canEditOverride: true,
            canRemoveOverride: true,
            overrideStableName: "Codex Override",
            overrideHomeRelativeRootPath: ".codex-custom",
            overrideSkillsDirectoryPath: "custom-skills",
            overrideSupportedPlatforms: ["linux"],
            overrideEnabledByDefault: true
          }
        ],
        selectedAgentId: "codex",
        selectedSkillId: null
      })
    );
    const builtinState = createInitialTuiState(
      model({
        agents: [agent("codex")],
        selectedAgentId: "codex",
        selectedSkillId: null
      })
    );

    expect(updateTuiState(builtinState, { type: "open-add-agent" }).modal).toMatchObject({
      kind: "add-agent"
    });
    expect(updateTuiState(overrideState, { type: "open-edit-agent" }).modal).toMatchObject({
      kind: "edit-agent",
      agentId: "codex",
      form: {
        values: {
          root: ".codex-custom",
          skills: "custom-skills",
          name: "Codex Override",
          platforms: ["linux"],
          enabledByDefault: true,
          disabledByDefault: false
        }
      }
    });
    expect(updateTuiState(overrideState, { type: "open-remove-agent" }).modal).toEqual({
      kind: "confirm-remove-agent",
      agentId: "codex"
    });
    expect(updateTuiState(overrideState, { type: "open-discard-dirty-form" }).modal).toMatchObject({
      kind: "confirm-discard-dirty-form"
    });
    expect(updateTuiState(builtinState, { type: "open-import" }).modal).toMatchObject({
      kind: "import"
    });
    expect(updateTuiState(builtinState, { type: "open-doctor" }).modal).toEqual({
      kind: "doctor",
      status: "loading"
    });
  });

  it("updates add, edit, and import form fields while tracking dirtiness", () => {
    const addState = updateTuiState(createInitialTuiState(model()), {
      type: "open-add-agent"
    });
    const editedAddState = updateTuiState(addState, {
      type: "add-agent-form-field-changed",
      field: "platforms",
      value: ["win32", "linux"]
    });
    const importState = updateTuiState(createInitialTuiState(model()), {
      type: "open-import"
    });
    const editedImportState = updateTuiState(importState, {
      type: "import-form-field-changed",
      field: "skillName",
      value: "find-skills"
    });
    const editState = updateTuiState(
      createInitialTuiState(
        model({
          agents: [
            {
              ...agent("codex"),
              hasUserOverride: true,
              canEditOverride: true,
              canRemoveOverride: true,
              overrideSupportedPlatforms: ["linux"]
            }
          ],
          selectedAgentId: "codex",
          selectedSkillId: null
        })
      ),
      { type: "open-edit-agent" }
    );
    const editedEditState = updateTuiState(editState, {
      type: "edit-agent-form-field-changed",
      field: "platforms",
      value: ["darwin"]
    });

    expect(editedAddState.modal).toMatchObject({
      kind: "add-agent",
      form: {
        values: {
          platforms: ["win32", "linux"]
        },
        dirty: true
      }
    });
    expect(editedImportState.modal).toMatchObject({
      kind: "import",
      form: {
        values: {
          skillName: "find-skills"
        },
        dirty: true
      }
    });
    expect(editedEditState.modal).toMatchObject({
      kind: "edit-agent",
      form: {
        values: {
          platforms: ["darwin"]
        },
        dirty: true
      }
    });
  });

  it("keeps form array baselines isolated from later platform-array mutation", () => {
    const addState = updateTuiState(createInitialTuiState(model()), {
      type: "open-add-agent"
    });

    if (addState.modal?.kind !== "add-agent") {
      throw new Error("expected add-agent modal");
    }

    addState.modal.form.values.platforms.push("linux");

    expect(addState.modal.form.values.platforms).toEqual(["linux"]);
    expect(addState.modal.form.initialValues.platforms).toEqual([]);
    expect(addState.modal.form.values.platforms).not.toBe(
      addState.modal.form.initialValues.platforms
    );
  });

  it("keeps edit form default flags mutually exclusive", () => {
    const editState = updateTuiState(
      createInitialTuiState(
        model({
          agents: [
            {
              ...agent("codex"),
              hasUserOverride: true,
              canEditOverride: true,
              canRemoveOverride: true,
              overrideEnabledByDefault: true
            }
          ],
          selectedAgentId: "codex",
          selectedSkillId: null
        })
      ),
      { type: "open-edit-agent" }
    );
    const enabled = updateTuiState(editState, {
      type: "edit-agent-form-field-changed",
      field: "enabledByDefault",
      value: true
    });
    const disabled = updateTuiState(enabled, {
      type: "edit-agent-form-field-changed",
      field: "disabledByDefault",
      value: true
    });

    expect(enabled.modal).toMatchObject({
      kind: "edit-agent",
      form: {
        values: {
          enabledByDefault: true,
          disabledByDefault: false
        }
      }
    });
    expect(disabled.modal).toMatchObject({
      kind: "edit-agent",
      form: {
        values: {
          enabledByDefault: false,
          disabledByDefault: true
        }
      }
    });
  });

  it("preserves unset enabled-by-default override state without emitting new flags", () => {
    const editState = updateTuiState(
      createInitialTuiState(
        model({
          agents: [
            {
              ...agent("codex"),
              hasUserOverride: true,
              canEditOverride: true,
              canRemoveOverride: true,
              enabledByDefault: true,
              overrideEnabledByDefault: undefined
            }
          ],
          selectedAgentId: "codex",
          selectedSkillId: null
        })
      ),
      { type: "open-edit-agent" }
    );
    const submitted = updateTuiState(editState, {
      type: "submit-edit-agent-form"
    });
    const consumed = consumePendingCommandIntent(submitted);

    expect(editState.modal).toMatchObject({
      kind: "edit-agent",
      form: {
        values: {
          enabledByDefault: false,
          disabledByDefault: false,
          preserveEnabledByDefault: true
        }
      }
    });
    expect(consumed.command).toEqual({
      kind: "config-update-agent",
      input: {
        id: "codex"
      }
    });
  });

  it("stages config remove agent when confirming a remove-agent modal", () => {
    const removeModalState = updateTuiState(
      createInitialTuiState(
        model({
          agents: [
            {
              ...agent("codex"),
              hasUserOverride: true,
              canEditOverride: true,
              canRemoveOverride: true
            }
          ],
          selectedAgentId: "codex",
          selectedSkillId: null
        })
      ),
      { type: "open-remove-agent" }
    );
    const submitted = updateTuiState(removeModalState, {
      type: "submit-remove-agent"
    });
    const consumed = consumePendingCommandIntent(submitted);

    expect(consumed.command).toEqual({
      kind: "config-remove-agent",
      input: { id: "codex" }
    });
  });

  it("tracks dirty add forms and asks for confirmation before discarding them", () => {
    const addState = updateTuiState(createInitialTuiState(model()), {
      type: "open-add-agent"
    });
    const dirtyAddState = updateTuiState(addState, {
      type: "add-agent-form-field-changed",
      field: "name",
      value: "Claude Code"
    });
    const discardPrompt = updateTuiState(dirtyAddState, { type: "close" });

    expect(dirtyAddState.modal).toMatchObject({
      kind: "add-agent",
      form: { dirty: true }
    });
    expect(discardPrompt.modal).toEqual({
      kind: "confirm-discard-dirty-form",
      modal: {
        kind: "add-agent",
        form: expect.any(Object)
      }
    });
  });

  it("stages validated submit intents as payload-bearing commands", () => {
    const addState = updateTuiState(createInitialTuiState(model()), {
      type: "open-add-agent"
    });
    const preparedAdd = updateTuiState(addState, {
      type: "add-agent-form-field-changed",
      field: "id",
      value: "Claude Code"
    });
    const submittedAdd = updateTuiState(preparedAdd, {
      type: "submit-add-agent-form"
    });
    const consumedAdd = consumePendingCommandIntent(submittedAdd);

    expect(consumedAdd.command).toEqual({
      kind: "config-add-agent",
      input: {
        id: "Claude Code",
        root: "root",
        skills: "skills"
      }
    });
    expect(consumedAdd.state.pendingCommand).toBeNull();
    expect(consumedAdd.state.modal).toMatchObject({
      kind: "add-agent",
      form: {
        dirty: true,
        error: null
      }
    });
  });

  it("keeps invalid submit attempts inside the modal with a short error", () => {
    const importState = updateTuiState(createInitialTuiState(model()), {
      type: "open-import"
    });
    const submittedImport = updateTuiState(importState, {
      type: "submit-import-form"
    });

    expect(submittedImport.pendingCommand).toBeNull();
    expect(submittedImport.modal).toMatchObject({
      kind: "import",
      form: {
        error: "Skill name and source path are required"
      }
    });
  });

  it("keeps the doctor modal in loading, ready, and error states", () => {
    const loading = updateTuiState(createInitialTuiState(model()), {
      type: "open-doctor"
    });
    const ready = updateTuiState(loading, {
      type: "doctor-result-loaded",
      report: {
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
        output: "Doctor output\n"
      }
    });
    const failed = updateTuiState(ready, {
      type: "doctor-result-failed",
      errorMessage: "Doctor failed"
    });

    expect(loading.modal).toEqual({ kind: "doctor", status: "loading" });
    expect(ready.modal).toEqual({
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
        output: "Doctor output\n"
      }
    });
    expect(failed.modal).toEqual({
      kind: "doctor",
      status: "error",
      errorMessage: "Doctor failed"
    });
  });

  it("refuses edit and remove requests for agents without user overrides", () => {
    const builtinState = createInitialTuiState(
      model({
        agents: [agent("codex")],
        selectedAgentId: "codex",
        selectedSkillId: null
      })
    );

    expect(updateTuiState(builtinState, { type: "open-edit-agent" }).statusMessage).toBe(
      "Select an agent override first"
    );
    expect(updateTuiState(builtinState, { type: "open-remove-agent" }).statusMessage).toBe(
      "Select an agent override first"
    );
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

  it("exposes adopt-all for the selected agent when it has unmanaged skills", () => {
    const state = createInitialTuiState(
      model({
        agents: [
          agent("codex"),
          {
            ...agent("claude"),
            unmanagedCount: 2
          }
        ],
        selectedAgentId: "claude",
        selectedSkillId: null
      })
    );

    expect(getAvailableActions(state)).toMatchObject({ adoptAll: true });
  });

  it("hides adopt-all when no selected agent exists or it has no unmanaged skills", () => {
    const noSelectedAgent = createInitialTuiState(
      model({
        selectedAgentId: null,
        selectedSkillId: null
      })
    );
    const noUnmanaged = createInitialTuiState(
      model({
        agents: [
          agent("codex"),
          {
            ...agent("claude"),
            unmanagedCount: 0
          }
        ],
        selectedAgentId: "claude",
        selectedSkillId: null
      })
    );

    expect(getAvailableActions(noSelectedAgent)).toMatchObject({
      adoptAll: false
    });
    expect(getAvailableActions(noUnmanaged)).toMatchObject({ adoptAll: false });
  });

  it("records an agent selection intent when navigation selects another agent", () => {
    const state = createInitialTuiState(
      model({
        agents: [agent("codex"), agent("claude")],
        skills: [
          enabledSkill({ id: "codex-skill", skillId: "codex-skill", agentId: "codex" })
        ],
        selectedAgentId: "codex",
        selectedSkillId: "codex-skill"
      })
    );

    const nextAgent = updateTuiState(state, { type: "next-row" });
    const consumed = consumeAgentSelectionIntent(nextAgent);

    expect(nextAgent.agentCursor).toBe(1);
    expect(nextAgent.model.selectedAgentId).toBe("claude");
    expect(nextAgent.model.selectedSkillId).toBeNull();
    expect(nextAgent.pendingAgentId).toBe("claude");
    expect(consumed.agentId).toBe("claude");
    expect(consumed.state.pendingAgentId).toBeNull();
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

  it("opens bulk adopt confirmation for the selected agent even when focus is agents", () => {
    const withUnmanagedAgent = createInitialTuiState(
      model({
        agents: [
          {
            ...agent("codex"),
            unmanagedCount: 2
          },
          {
            ...agent("claude"),
            unmanagedCount: 0
          }
        ],
        selectedAgentId: "codex",
        selectedSkillId: null
      })
    );

    expect(
      updateTuiState(withUnmanagedAgent, { type: "request-adopt-all" }).modal
    ).toEqual({
      kind: "confirm-adopt-all",
      agentId: "codex",
      unmanagedCount: 2
    });
  });

  it("keeps request-adopt unchanged for a focused unmanaged row", () => {
    const unmanaged = updateTuiState(
      createInitialTuiState(model({ selectedSkillId: "unmanaged:find-skills" })),
      { type: "focus-next" }
    );

    expect(updateTuiState(unmanaged, { type: "request-adopt" }).modal).toEqual({
      kind: "confirm-adopt",
      skillId: "find-skills",
      agentId: "codex"
    });
  });

  it("refuses bulk adopt when the current agent has no unmanaged skills", () => {
    const noUnmanaged = createInitialTuiState(
      model({
        agents: [
          agent("codex"),
          {
            ...agent("claude"),
            unmanagedCount: 0
          }
        ],
        selectedAgentId: "claude",
        selectedSkillId: null
      })
    );

    expect(updateTuiState(noUnmanaged, { type: "request-adopt-all" }).statusMessage)
      .toBe("No unmanaged skills to adopt for this agent");
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

  it("suppresses available actions while a modal is open or work is busy", () => {
    const skillsFocused = updateTuiState(
      createInitialTuiState(model({ selectedSkillId: "paper-polish" })),
      { type: "focus-next" }
    );
    const withModal = updateTuiState(skillsFocused, { type: "open-help" });
    const busy = updateTuiState(skillsFocused, { type: "set-busy", busy: true });

    expect(getAvailableActions(skillsFocused)).toMatchObject({
      toggle: true,
      remove: true,
      scan: true,
      help: true
    });
    expect(getAvailableActions(withModal)).toEqual({
      addAgent: false,
      editAgent: false,
      removeAgent: false,
      importSkill: false,
      doctor: false,
      toggle: false,
      adopt: false,
      adoptAll: false,
      remove: false,
      scan: false,
      help: false
    });
    expect(getAvailableActions(busy)).toEqual({
      addAgent: false,
      editAgent: false,
      removeAgent: false,
      importSkill: false,
      doctor: false,
      toggle: false,
      adopt: false,
      adoptAll: false,
      remove: false,
      scan: false,
      help: false
    });
  });

  it("refuses pending and modal-opening actions while busy", () => {
    const skillsFocused = updateTuiState(
      createInitialTuiState(model({ selectedSkillId: "paper-polish" })),
      { type: "focus-next" }
    );
    const busy = updateTuiState(skillsFocused, { type: "set-busy", busy: true });

    expect(updateTuiState(busy, { type: "request-toggle" }).pendingAction).toBeNull();
    expect(updateTuiState(busy, { type: "request-remove" }).modal).toBeNull();
    expect(updateTuiState(busy, { type: "request-scan" }).pendingAction).toBeNull();
    expect(updateTuiState(busy, { type: "open-help" }).modal).toBeNull();
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
    expect(filteredAgents.pendingAgentId).toBe("claude");
    expect(filteredSkills.model.selectedSkillId).toBe("paper-polish");
    expect(getSelectedSkill(filteredSkills)?.id).toBe("paper-polish");
    expect(getAvailableActions(filteredSkills)).toMatchObject({
      toggle: true,
      remove: true
    });
  });

  it("hides stale current-agent skills when agent search has no matches", () => {
    const searchAgents = updateTuiState(createInitialTuiState(model()), {
      type: "open-search"
    });
    const noMatchingAgents = updateTuiState(searchAgents, {
      type: "search-query-changed",
      query: "missing-agent"
    });
    const skillsFocused = updateTuiState(noMatchingAgents, { type: "focus-next" });
    const movedSkill = updateTuiState(skillsFocused, { type: "next-row" });
    const toggled = updateTuiState(movedSkill, { type: "request-toggle" });

    expect(noMatchingAgents.model.selectedAgentId).toBeNull();
    expect(noMatchingAgents.model.selectedSkillId).toBeNull();
    expect(getVisibleSkills(noMatchingAgents)).toEqual([]);
    expect(getVisibleSkills(skillsFocused)).toEqual([]);
    expect(movedSkill.model.selectedSkillId).toBeNull();
    expect(getSelectedSkill(movedSkill)).toBeNull();
    expect(getAvailableActions(movedSkill)).toMatchObject({
      toggle: false,
      adopt: false,
      remove: false
    });
    expect(toggled.pendingAction).toBeNull();
  });
});

import type { TuiAction } from "./actions";
import type {
  DashboardModel,
  TuiAgentRow,
  TuiSkillRow
} from "./dashboard-model";

export type TuiFocus = "agents" | "skills" | "detail";

export type TuiModal =
  | { kind: "help" }
  | { kind: "confirm-adopt"; skillId: string; agentId: string }
  | {
      kind: "confirm-adopt-all";
      agentId: string;
      unmanagedCount: number;
    }
  | { kind: "confirm-remove"; skillId: string }
  | { kind: "add-agent" }
  | { kind: "edit-agent"; agentId: string }
  | { kind: "confirm-remove-agent"; agentId: string }
  | { kind: "import" }
  | { kind: "doctor" }
  | { kind: "confirm-discard-dirty-form" };

export type TuiSearch = {
  panel: "agents" | "skills";
  query: string;
  previousSelection: {
    selectedAgentId: string | null;
    selectedSkillId: string | null;
    agentCursor: number;
    skillCursor: number;
    pendingAgentId: string | null;
  };
};

export type TuiState = {
  model: DashboardModel;
  focus: TuiFocus;
  agentCursor: number;
  skillCursor: number;
  search: TuiSearch | null;
  statusMessage: string | null;
  modal: TuiModal | null;
  busy: boolean;
  pendingAction: TuiAction | null;
  pendingAgentId: string | null;
};

export type TuiStateEvent =
  | { type: "focus-next" }
  | { type: "focus-previous" }
  | { type: "next-row" }
  | { type: "previous-row" }
  | { type: "first-row" }
  | { type: "last-row" }
  | { type: "open-search" }
  | { type: "search-query-changed"; query: string }
  | { type: "submit-search" }
  | { type: "close" }
  | { type: "open-help" }
  | { type: "open-add-agent" }
  | { type: "open-edit-agent" }
  | { type: "open-remove-agent" }
  | { type: "open-import" }
  | { type: "open-doctor" }
  | { type: "open-discard-dirty-form" }
  | { type: "request-adopt" }
  | { type: "request-adopt-all" }
  | { type: "request-remove" }
  | { type: "request-toggle" }
  | { type: "request-scan" }
  | { type: "set-busy"; busy: boolean }
  | { type: "set-status"; message: string | null }
  | { type: "clear-pending-action" };

export type TuiAvailableActions = {
  addAgent?: boolean;
  editAgent?: boolean;
  removeAgent?: boolean;
  importSkill?: boolean;
  doctor?: boolean;
  toggle: boolean;
  adopt: boolean;
  adoptAll: boolean;
  remove: boolean;
  scan: boolean;
  help: boolean;
};

const focusOrder: TuiFocus[] = ["agents", "skills"];

function clampCursor(cursor: number, rowCount: number): number {
  if (rowCount <= 0) {
    return 0;
  }

  return Math.min(Math.max(cursor, 0), rowCount - 1);
}

function normalizeQuery(query: string): string {
  return query.trim().toLocaleLowerCase();
}

function includesQuery(values: Array<string | null>, query: string): boolean {
  const normalizedQuery = normalizeQuery(query);

  if (normalizedQuery.length === 0) {
    return true;
  }

  return values.some((value) =>
    (value ?? "").toLocaleLowerCase().includes(normalizedQuery)
  );
}

function isRelevantAgentRow(
  row: TuiAgentRow,
  selectedAgentId: string | null
): boolean {
  return (
    row.id === selectedAgentId ||
    row.hasUserOverride === true ||
    row.exists ||
    (row.activationCount ?? 0) > 0 ||
    row.enabledCount > 0 ||
    row.unmanagedCount > 0 ||
    row.issueCount > 0
  );
}

function skillMatchesQuery(row: TuiSkillRow, query: string): boolean {
  if (row.kind === "issue") {
    return includesQuery(
      [row.id, row.issueCode, row.message, row.path, row.agentId],
      query
    );
  }

  if (row.kind === "unmanaged") {
    return includesQuery(
      [row.id, row.skillName, row.name, row.path, row.agentId],
      query
    );
  }

  return includesQuery([row.id, row.skillId, row.name, row.path, row.agentId], query);
}

function replaceModelSelection(
  state: TuiState,
  selection: Pick<DashboardModel, "selectedAgentId" | "selectedSkillId">
): TuiState {
  return {
    ...state,
    model: {
      ...state.model,
      ...selection
    }
  };
}

function clearTransientIntent(state: TuiState): TuiState {
  return {
    ...state,
    pendingAction: null,
    statusMessage: null
  };
}

function restoreSearchSelection(state: TuiState): TuiState {
  if (state.search === null) {
    return state;
  }

  const previousSelection = state.search.previousSelection;

  return {
    ...state,
    model: {
      ...state.model,
      selectedAgentId: previousSelection.selectedAgentId,
      selectedSkillId: previousSelection.selectedSkillId
    },
    agentCursor: previousSelection.agentCursor,
    skillCursor: previousSelection.skillCursor,
    pendingAgentId: previousSelection.pendingAgentId
  };
}

function searchHasVisibleResults(state: TuiState): boolean {
  if (state.search === null) {
    return false;
  }

  return state.search.panel === "agents"
    ? getVisibleAgents(state).length > 0
    : getVisibleSkills(state).length > 0;
}

function selectedAgentIndex(model: DashboardModel): number {
  if (model.selectedAgentId === null) {
    return 0;
  }

  const index = model.agents.findIndex((row) => row.id === model.selectedAgentId);
  return index < 0 ? 0 : index;
}

function selectedSkillIndex(model: DashboardModel): number {
  if (model.selectedSkillId === null) {
    return 0;
  }

  const index = model.skills.findIndex((row) => row.id === model.selectedSkillId);
  return index < 0 ? 0 : index;
}

function selectedAgentSkill(
  skills: TuiSkillRow[],
  agentId: string | null
): TuiSkillRow | null {
  if (agentId === null) {
    return null;
  }

  return skills.find((row) => row.agentId === agentId) ?? null;
}

function selectedAgentRow(state: TuiState): TuiAgentRow | null {
  if (state.model.selectedAgentId === null) {
    return null;
  }

  return (
    state.model.agents.find((row) => row.id === state.model.selectedAgentId) ?? null
  );
}

function moveFocus(focus: TuiFocus, direction: 1 | -1): TuiFocus {
  const currentIndex = focusOrder.indexOf(focus);
  const nextIndex =
    (currentIndex + direction + focusOrder.length) % focusOrder.length;

  return focusOrder[nextIndex] ?? "agents";
}

function stateWithAgentCursor(state: TuiState, cursor: number): TuiState {
  const visibleAgents = getVisibleAgents(state);
  const agentCursor = clampCursor(cursor, visibleAgents.length);
  const selectedAgent = visibleAgents[agentCursor] ?? null;
  const selectedSkill = selectedAgentSkill(state.model.skills, selectedAgent?.id ?? null);
  const previousAgentId = state.model.selectedAgentId;
  const selectedAgentId = selectedAgent?.id ?? null;
  const model = {
    ...state.model,
    selectedAgentId,
    selectedSkillId: selectedSkill?.id ?? null
  };
  const skillCursor =
    selectedSkill === null
      ? 0
      : clampCursor(
          getVisibleSkills({ ...state, model }).findIndex(
            (row) => row.id === selectedSkill.id
          ),
          getVisibleSkills({ ...state, model }).length
        );

  return {
    ...state,
    model,
    agentCursor,
    skillCursor,
    pendingAgentId:
      selectedAgentId !== null && selectedAgentId !== previousAgentId
        ? selectedAgentId
        : state.pendingAgentId
  };
}

function stateWithSkillCursor(state: TuiState, cursor: number): TuiState {
  const visibleSkills = getVisibleSkills(state);
  const skillCursor = clampCursor(cursor, visibleSkills.length);
  const selectedSkill = visibleSkills[skillCursor] ?? null;

  return replaceModelSelection(
    {
      ...state,
      skillCursor
    },
    {
      selectedAgentId: state.model.selectedAgentId,
      selectedSkillId: selectedSkill?.id ?? null
    }
  );
}

function moveCursor(state: TuiState, cursor: number): TuiState {
  if (state.focus === "agents") {
    return stateWithAgentCursor(state, cursor);
  }

  if (state.focus === "skills") {
    return stateWithSkillCursor(state, cursor);
  }

  return state;
}

function isModalBackgroundEvent(event: TuiStateEvent): boolean {
  return (
    event.type === "focus-next" ||
    event.type === "focus-previous" ||
    event.type === "next-row" ||
    event.type === "previous-row" ||
    event.type === "first-row" ||
    event.type === "last-row" ||
    event.type === "open-search" ||
    event.type === "search-query-changed" ||
    event.type === "open-help" ||
    event.type === "open-add-agent" ||
    event.type === "open-edit-agent" ||
    event.type === "open-remove-agent" ||
    event.type === "open-import" ||
    event.type === "open-doctor" ||
    event.type === "open-discard-dirty-form" ||
    event.type === "request-adopt" ||
    event.type === "request-adopt-all" ||
    event.type === "request-remove" ||
    event.type === "request-toggle" ||
    event.type === "request-scan" ||
    event.type === "clear-pending-action"
  );
}

export function getVisibleAgents(state: TuiState): TuiAgentRow[] {
  if (state.search?.panel !== "agents") {
    return state.model.agents.filter((row) =>
      isRelevantAgentRow(row, state.model.selectedAgentId)
    );
  }

  return state.model.agents.filter((row) =>
    includesQuery([row.id, row.name, row.path, row.discovery], state.search?.query ?? "")
  );
}

export function getVisibleSkills(state: TuiState): TuiSkillRow[] {
  if (state.model.selectedAgentId === null) {
    return [];
  }

  const agentSkills =
    state.model.skills.filter((row) => row.agentId === state.model.selectedAgentId);

  if (state.search?.panel !== "skills") {
    return agentSkills;
  }

  return agentSkills.filter((row) => skillMatchesQuery(row, state.search?.query ?? ""));
}

export function getSelectedSkill(state: TuiState): TuiSkillRow | null {
  if (state.model.selectedSkillId === null) {
    return null;
  }

  return (
    state.model.skills.find((row) => row.id === state.model.selectedSkillId) ?? null
  );
}

export function getAvailableActions(state: TuiState): TuiAvailableActions {
  const selectedSkill = getSelectedSkill(state);
  const selectedAgent = selectedAgentRow(state);
  const canAcceptActions = state.modal === null && !state.busy;
  const hasFocusedSkill = canAcceptActions && state.focus === "skills";
  const canEditSelectedAgent = selectedAgent?.canEditOverride === true;
  const canRemoveSelectedAgent = selectedAgent?.canRemoveOverride === true;

  return {
    addAgent: canAcceptActions,
    editAgent: canAcceptActions && canEditSelectedAgent,
    removeAgent: canAcceptActions && canRemoveSelectedAgent,
    importSkill: canAcceptActions,
    doctor: canAcceptActions,
    toggle:
      hasFocusedSkill &&
      (selectedSkill?.kind === "enabled" || selectedSkill?.kind === "disabled"),
    adopt: hasFocusedSkill && selectedSkill?.kind === "unmanaged",
    adoptAll: canAcceptActions && (selectedAgent?.unmanagedCount ?? 0) > 0,
    remove: hasFocusedSkill && selectedSkill?.kind === "disabled",
    scan: canAcceptActions,
    help: canAcceptActions
  };
}

export function consumeActionIntent(state: TuiState): {
  state: TuiState;
  action: TuiAction | null;
} {
  return {
    state: {
      ...state,
      pendingAction: null
    },
    action: state.pendingAction
  };
}

export function consumeAgentSelectionIntent(state: TuiState): {
  state: TuiState;
  agentId: string | null;
} {
  return {
    state: {
      ...state,
      pendingAgentId: null
    },
    agentId: state.pendingAgentId
  };
}

export function createInitialTuiState(model: DashboardModel): TuiState {
  const state: TuiState = {
    model,
    focus: "agents",
    agentCursor: selectedAgentIndex(model),
    skillCursor: selectedSkillIndex(model),
    search: null,
    statusMessage: null,
    modal: null,
    busy: false,
    pendingAction: null,
    pendingAgentId: null
  };

  return {
    ...state,
    agentCursor: clampCursor(state.agentCursor, getVisibleAgents(state).length),
    skillCursor: clampCursor(state.skillCursor, getVisibleSkills(state).length)
  };
}

export function updateTuiState(state: TuiState, event: TuiStateEvent): TuiState {
  if (state.modal !== null) {
    if (event.type === "close") {
      return {
        ...state,
        modal: null,
        pendingAction: null
      };
    }

    if (event.type === "set-busy") {
      return {
        ...state,
        busy: event.busy
      };
    }

    if (event.type === "set-status") {
      return {
        ...state,
        statusMessage: event.message
      };
    }

    if (isModalBackgroundEvent(event)) {
      return state;
    }
  }

  if (state.busy) {
    if (event.type === "set-busy") {
      return {
        ...state,
        busy: event.busy
      };
    }

    if (event.type === "set-status") {
      return {
        ...state,
        statusMessage: event.message
      };
    }

    if (
      event.type === "request-toggle" ||
      event.type === "request-adopt" ||
      event.type === "request-remove" ||
      event.type === "request-scan" ||
      event.type === "open-help" ||
      event.type === "open-add-agent" ||
      event.type === "open-edit-agent" ||
      event.type === "open-remove-agent" ||
      event.type === "open-import" ||
      event.type === "open-doctor" ||
      event.type === "open-discard-dirty-form"
    ) {
      return {
        ...state,
        pendingAction: null
      };
    }
  }

  const readyState = clearTransientIntent(state);

  if (event.type === "focus-next") {
    return {
      ...readyState,
      focus: moveFocus(state.focus, 1)
    };
  }

  if (event.type === "focus-previous") {
    return {
      ...readyState,
      focus: moveFocus(state.focus, -1)
    };
  }

  if (event.type === "next-row") {
    return moveCursor(
      readyState,
      state.focus === "agents" ? state.agentCursor + 1 : state.skillCursor + 1
    );
  }

  if (event.type === "previous-row") {
    return moveCursor(
      readyState,
      state.focus === "agents" ? state.agentCursor - 1 : state.skillCursor - 1
    );
  }

  if (event.type === "first-row") {
    return moveCursor(readyState, 0);
  }

  if (event.type === "last-row") {
    const rowCount =
      state.focus === "agents"
        ? getVisibleAgents(state).length
        : getVisibleSkills(state).length;

    return moveCursor(readyState, rowCount - 1);
  }

  if (event.type === "open-search") {
    if (state.focus !== "agents" && state.focus !== "skills") {
      return {
        ...readyState,
        statusMessage: "Search is available for agents and skills"
      };
    }

    return {
      ...readyState,
      search: {
        panel: state.focus,
        query: "",
        previousSelection: {
          selectedAgentId: state.model.selectedAgentId,
          selectedSkillId: state.model.selectedSkillId,
          agentCursor: state.agentCursor,
          skillCursor: state.skillCursor,
          pendingAgentId: state.pendingAgentId
        }
      }
    };
  }

  if (event.type === "search-query-changed") {
    if (state.search === null) {
      return readyState;
    }

    const searchedState = {
      ...readyState,
      search: {
        ...state.search,
        query: event.query
      }
    };
    const rowCount =
      searchedState.search.panel === "agents"
        ? getVisibleAgents(searchedState).length
        : getVisibleSkills(searchedState).length;

    return searchedState.search.panel === "agents"
      ? stateWithAgentCursor(searchedState, clampCursor(searchedState.agentCursor, rowCount))
      : stateWithSkillCursor(searchedState, clampCursor(searchedState.skillCursor, rowCount));
  }

  if (event.type === "close") {
    if (state.search !== null) {
      return {
        ...restoreSearchSelection(readyState),
        search: null
      };
    }

    if (state.modal !== null) {
      return {
        ...readyState,
        modal: null
      };
    }

    return readyState;
  }

  if (event.type === "submit-search") {
    if (state.search !== null) {
      if (!searchHasVisibleResults(state)) {
        return {
          ...restoreSearchSelection(readyState),
          search: null
        };
      }

      return {
        ...readyState,
        search: null
      };
    }

    return readyState;
  }

  if (event.type === "open-help") {
    return {
      ...readyState,
      modal: { kind: "help" }
    };
  }

  if (event.type === "open-add-agent") {
    return {
      ...readyState,
      modal: { kind: "add-agent" }
    };
  }

  if (event.type === "open-edit-agent") {
    const selectedAgent = selectedAgentRow(state);

    if (selectedAgent?.canEditOverride !== true) {
      return {
        ...readyState,
        statusMessage: "Select an agent override first"
      };
    }

    return {
      ...readyState,
      modal: { kind: "edit-agent", agentId: selectedAgent.id }
    };
  }

  if (event.type === "open-remove-agent") {
    const selectedAgent = selectedAgentRow(state);

    if (selectedAgent?.canRemoveOverride !== true) {
      return {
        ...readyState,
        statusMessage: "Select an agent override first"
      };
    }

    return {
      ...readyState,
      modal: { kind: "confirm-remove-agent", agentId: selectedAgent.id }
    };
  }

  if (event.type === "open-import") {
    return {
      ...readyState,
      modal: { kind: "import" }
    };
  }

  if (event.type === "open-doctor") {
    return {
      ...readyState,
      modal: { kind: "doctor" }
    };
  }

  if (event.type === "open-discard-dirty-form") {
    return {
      ...readyState,
      modal: { kind: "confirm-discard-dirty-form" }
    };
  }

  if (event.type === "request-adopt") {
    if (state.focus !== "skills") {
      return readyState;
    }

    const selectedSkill = getSelectedSkill(state);

    if (selectedSkill?.kind !== "unmanaged") {
      return {
        ...readyState,
        statusMessage: "Adopt is only available for unmanaged rows"
      };
    }

    return {
      ...readyState,
      modal: {
        kind: "confirm-adopt",
        skillId: selectedSkill.skillName,
        agentId: selectedSkill.agentId
      }
    };
  }

  if (event.type === "request-adopt-all") {
    const selectedAgent = selectedAgentRow(state);

    if (selectedAgent === null) {
      return {
        ...readyState,
        statusMessage: "Select an agent first"
      };
    }

    if (selectedAgent.unmanagedCount <= 0) {
      return {
        ...readyState,
        statusMessage: "No unmanaged skills to adopt for this agent"
      };
    }

    return {
      ...readyState,
      modal: {
        kind: "confirm-adopt-all",
        agentId: selectedAgent.id,
        unmanagedCount: selectedAgent.unmanagedCount
      }
    };
  }

  if (event.type === "request-remove") {
    if (state.focus !== "skills") {
      return readyState;
    }

    const selectedSkill = getSelectedSkill(state);

    if (selectedSkill?.kind !== "disabled") {
      return {
        ...readyState,
        statusMessage:
          selectedSkill?.kind === "enabled"
            ? "Disable this skill before removing it"
            : "Remove is only available for disabled rows"
      };
    }

    return {
      ...readyState,
      modal: {
        kind: "confirm-remove",
        skillId: selectedSkill.skillId
      }
    };
  }

  if (event.type === "request-toggle") {
    if (state.focus !== "skills") {
      return readyState;
    }

    const selectedSkill = getSelectedSkill(state);

    if (selectedSkill?.kind !== "enabled" && selectedSkill?.kind !== "disabled") {
      return {
        ...readyState,
        statusMessage: "Toggle is only available for managed rows"
      };
    }

    return {
      ...readyState,
      pendingAction: "toggle"
    };
  }

  if (event.type === "request-scan") {
    return {
      ...readyState,
      pendingAction: "scan"
    };
  }

  if (event.type === "set-busy") {
    return {
      ...readyState,
      busy: event.busy
    };
  }

  if (event.type === "set-status") {
    return {
      ...readyState,
      statusMessage: event.message
    };
  }

  return readyState;
}

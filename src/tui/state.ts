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
  | { kind: "confirm-remove"; skillId: string };

export type TuiSearch = {
  panel: "agents" | "skills";
  query: string;
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
  | { type: "close" }
  | { type: "open-help" }
  | { type: "request-adopt" }
  | { type: "request-remove" }
  | { type: "request-toggle" }
  | { type: "request-scan" }
  | { type: "set-busy"; busy: boolean }
  | { type: "set-status"; message: string | null }
  | { type: "clear-pending-action" };

export type TuiAvailableActions = {
  toggle: boolean;
  adopt: boolean;
  remove: boolean;
  scan: boolean;
  help: boolean;
};

const focusOrder: TuiFocus[] = ["agents", "skills", "detail"];

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
  const model = {
    ...state.model,
    selectedAgentId: selectedAgent?.id ?? null,
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
    skillCursor
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

export function getVisibleAgents(state: TuiState): TuiAgentRow[] {
  if (state.search?.panel !== "agents") {
    return state.model.agents;
  }

  return state.model.agents.filter((row) =>
    includesQuery([row.id, row.name, row.path, row.discovery], state.search?.query ?? "")
  );
}

export function getVisibleSkills(state: TuiState): TuiSkillRow[] {
  const agentSkills =
    state.model.selectedAgentId === null
      ? state.model.skills
      : state.model.skills.filter((row) => row.agentId === state.model.selectedAgentId);

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

  return {
    toggle:
      selectedSkill?.kind === "enabled" || selectedSkill?.kind === "disabled",
    adopt: selectedSkill?.kind === "unmanaged",
    remove: selectedSkill?.kind === "disabled",
    scan: true,
    help: true
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
    pendingAction: null
  };

  return {
    ...state,
    agentCursor: clampCursor(state.agentCursor, getVisibleAgents(state).length),
    skillCursor: clampCursor(state.skillCursor, getVisibleSkills(state).length)
  };
}

export function updateTuiState(state: TuiState, event: TuiStateEvent): TuiState {
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
        query: ""
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
      ? {
          ...searchedState,
          agentCursor: clampCursor(searchedState.agentCursor, rowCount)
        }
      : {
          ...searchedState,
          skillCursor: clampCursor(searchedState.skillCursor, rowCount)
        };
  }

  if (event.type === "close") {
    if (state.search !== null) {
      return {
        ...readyState,
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

  if (event.type === "open-help") {
    return {
      ...readyState,
      modal: { kind: "help" }
    };
  }

  if (event.type === "request-adopt") {
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

  if (event.type === "request-remove") {
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

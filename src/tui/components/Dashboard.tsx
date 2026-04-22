import { Box, Text } from "ink";
import {
  getAvailableActions,
  getSelectedSkill,
  getVisibleAgents,
  getVisibleSkills,
  type TuiState
} from "../state";
import { AgentList } from "./AgentList";
import { ConfirmDialog, confirmDialogHeight } from "./ConfirmDialog";
import { DetailPane } from "./DetailPane";
import { Footer } from "./Footer";
import { HelpOverlay } from "./HelpOverlay";
import { SkillList } from "./SkillList";
import { StatusLine } from "./StatusLine";

export type DashboardProps = {
  state: TuiState;
  width: number;
  height: number;
};

const minimumWidth = 80;
const minimumHeight = 24;
const agentRatio = 0.26;
const skillRatio = 0.3;
const detailRatio = 0.44;
const agentMinimumWidth = 20;
const skillMinimumWidth = 24;
const detailMinimumWidth = 28;

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

export function Dashboard({
  state,
  width,
  height
}: DashboardProps) {
  if (width < minimumWidth || height < minimumHeight) {
    return (
      <Box
        flexDirection="column"
        width={width}
        height={height}
        justifyContent="center"
        alignItems="center"
      >
        <Text>Terminal too small. Resize to at least 80x24.</Text>
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
  const overlayHeight =
    state.modal?.kind === "help"
      ? 8
      : state.modal?.kind === "confirm-adopt" ||
          state.modal?.kind === "confirm-remove"
        ? confirmDialogHeight
        : 0;
  const bodyHeight = Math.max(height - 1 - footerHeight - overlayHeight, 0);
  const { agentWidth, skillWidth, detailWidth } = paneWidths(width);

  return (
    <Box flexDirection="column" width={width} height={height}>
      <StatusLine
        busy={state.busy}
        statusMessage={state.statusMessage}
        lastScanAt={state.model.lastScanAt}
        issueCount={state.model.issueCount}
      />
      <Box flexDirection="row" width={width} height={bodyHeight}>
        <AgentList
          agents={visibleAgents}
          selectedAgentId={state.model.selectedAgentId}
          focused={state.focus === "agents"}
          searchQuery={state.search?.panel === "agents" ? state.search.query : undefined}
          width={agentWidth}
          height={bodyHeight}
        />
        <SkillList
          agentId={state.model.selectedAgentId}
          skills={visibleSkills}
          selectedSkillId={state.model.selectedSkillId}
          focused={state.focus === "skills"}
          searchQuery={state.search?.panel === "skills" ? state.search.query : undefined}
          loadingAgentName={loadingAgent?.name ?? null}
          width={skillWidth}
          height={bodyHeight}
        />
        <DetailPane
          selectedAgent={selectedAgent}
          selectedSkill={selectedSkill}
          focused={state.focus === "detail"}
          loadingAgentName={loadingAgent?.name ?? null}
          width={detailWidth}
          height={bodyHeight}
        />
      </Box>
      {state.modal?.kind === "help" ? <HelpOverlay /> : null}
      {state.modal?.kind === "confirm-adopt" ||
      state.modal?.kind === "confirm-remove" ? (
        <ConfirmDialog modal={state.modal} />
      ) : null}
      {state.modal === null ? (
        <Footer actions={actions} search={state.search} />
      ) : (
        <Box height={3} />
      )}
    </Box>
  );
}

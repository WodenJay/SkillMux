import { Box, Text } from "ink";
import {
  getAvailableActions,
  getSelectedSkill,
  getVisibleAgents,
  getVisibleSkills,
  type TuiState
} from "../state";
import { AgentList } from "./AgentList";
import { ConfirmDialog } from "./ConfirmDialog";
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

export function Dashboard({
  state,
  width,
  height
}: DashboardProps) {
  if (width < minimumWidth || height < minimumHeight) {
    return <Text>Terminal too small. Resize to at least 80x24.</Text>;
  }

  const visibleAgents = getVisibleAgents(state);
  const visibleSkills = getVisibleSkills(state);
  const selectedAgent =
    state.model.agents.find((agent) => agent.id === state.model.selectedAgentId) ??
    null;
  const selectedSkill = getSelectedSkill(state);
  const actions = getAvailableActions(state);

  return (
    <Box flexDirection="column" width={minimumWidth} height={minimumHeight}>
      <StatusLine
        busy={state.busy}
        statusMessage={state.statusMessage}
        lastScanAt={state.model.lastScanAt}
        issueCount={state.model.issueCount}
      />
      <Box flexDirection="row" height={18}>
        <AgentList
          agents={visibleAgents}
          selectedAgentId={state.model.selectedAgentId}
          focused={state.focus === "agents"}
        />
        <SkillList
          agentId={state.model.selectedAgentId}
          skills={visibleSkills}
          selectedSkillId={state.model.selectedSkillId}
          focused={state.focus === "skills"}
        />
        <DetailPane
          selectedAgent={selectedAgent}
          selectedSkill={selectedSkill}
          focused={state.focus === "detail"}
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

import { Box, Text } from "ink";
import {
  getAvailableActions,
  getSelectedSkill,
  getVisibleAgents,
  getVisibleSkills,
  type TuiState
} from "../state";
import { useTheme } from "../theme";
import { AgentList } from "./AgentList";
import { ConfirmDialog, confirmDialogHeight } from "./ConfirmDialog";
import { DoctorDialog } from "./DoctorDialog";
import { DetailPane } from "./DetailPane";
import { Footer } from "./Footer";
import { HelpOverlay } from "./HelpOverlay";
import { FormDialog } from "./FormDialog";
import { SkillList } from "./SkillList";
import { StatusLine } from "./StatusLine";

export type DashboardModalInteraction = {
  fieldIndex: number;
  platformIndex: number;
  doctorScrollOffset: number;
};

export type DashboardProps = {
  state: TuiState;
  width: number;
  height: number;
  modalInteraction?: DashboardModalInteraction;
};

const minimumWidth = 80;
const minimumHeight = 24;
const agentRatio = 0.26;
const skillRatio = 0.3;
const detailRatio = 0.44;
const agentMinimumWidth = 20;
const skillMinimumWidth = 24;
const detailMinimumWidth = 28;
const largeModalWidth = 72;
const largeModalHeight = 14;

export function horizontalBorder(
  left: string,
  mid: string,
  right: string,
  ...widths: number[]
): string {
  const h = "\u2500";
  let result = left;
  for (let i = 0; i < widths.length; i++) {
    result += h.repeat(widths[i]);
    if (i < widths.length - 1) {
      result += mid;
    }
  }
  result += right;
  return result;
}

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
  height,
  modalInteraction
}: DashboardProps) {
  const theme = useTheme();
  const interaction = modalInteraction ?? {
    fieldIndex: 0,
    platformIndex: 0,
    doctorScrollOffset: 0
  };
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
  const largeModal =
    state.modal?.kind === "add-agent" ||
    state.modal?.kind === "edit-agent" ||
    state.modal?.kind === "import" ||
    state.modal?.kind === "doctor" ||
    state.modal?.kind === "confirm-remove-agent";
  const overlayHeight =
    largeModal
      ? 0
      : state.modal?.kind === "help"
      ? 8
      : state.modal?.kind === "confirm-adopt" ||
          state.modal?.kind === "confirm-adopt-all" ||
          state.modal?.kind === "confirm-remove"
        ? confirmDialogHeight
      : 0;
  const footerSpace =
    state.modal === null ? footerHeight : largeModal ? 0 : footerHeight;
  const bodyHeight = Math.max(height - 1 - footerSpace - overlayHeight, 0);
  const { agentWidth, skillWidth, detailWidth } = paneWidths(width);
  const modalWidth = Math.min(width - 4, largeModalWidth);
  const modalHeight = Math.min(bodyHeight, largeModalHeight);
  const adjustedDetailWidth = Math.max(0, detailWidth - 2);
  const contentHeight = Math.max(0, bodyHeight - 2);
  const separatorBorder1 =
    state.focus === "agents" ? theme.border.focused : theme.border.default;
  const separatorBorder2 =
    state.focus === "skills" ? theme.border.focused : theme.border.default;

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Box height={1}>
        <StatusLine
          busy={state.busy}
          statusMessage={state.statusMessage}
          model={state.model}
        />
      </Box>
      {largeModal ? (
        <Box
          flexDirection="column"
          width={width}
          height={bodyHeight}
          justifyContent="center"
          alignItems="center"
        >
          <Box width={modalWidth} height={modalHeight}>
            {state.modal?.kind === "add-agent" || state.modal?.kind === "edit-agent" || state.modal?.kind === "import" ? (
              <FormDialog
                modal={state.modal}
                fieldIndex={interaction.fieldIndex}
                platformIndex={interaction.platformIndex}
                width={modalWidth}
                height={modalHeight}
              />
            ) : state.modal?.kind === "doctor" ? (
              <DoctorDialog
                modal={state.modal}
                scrollOffset={interaction.doctorScrollOffset}
                width={modalWidth}
                height={modalHeight}
              />
            ) : state.modal?.kind === "confirm-remove-agent" ? (
              <ConfirmDialog modal={state.modal} />
            ) : null}
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column">
          <Text color={theme.border.default}>
            {horizontalBorder("\u251C", "\u252C", "\u2524", agentWidth, skillWidth, detailWidth)}
          </Text>
          <Box flexDirection="row" width={width} height={contentHeight}>
            <AgentList
              agents={visibleAgents}
              selectedAgentId={state.model.selectedAgentId}
              focused={state.focus === "agents"}
              searchQuery={state.search?.panel === "agents" ? state.search.query : undefined}
              width={agentWidth}
              height={contentHeight}
            />
            <Text color={separatorBorder1}>{"\u2502"}</Text>
            <SkillList
              agentId={state.model.selectedAgentId}
              skills={visibleSkills}
              selectedSkillId={state.model.selectedSkillId}
              focused={state.focus === "skills"}
              searchQuery={state.search?.panel === "skills" ? state.search.query : undefined}
              loadingAgentName={loadingAgent?.name ?? null}
              width={skillWidth}
              height={contentHeight}
            />
            <Text color={separatorBorder2}>{"\u2502"}</Text>
            <DetailPane
              selectedAgent={selectedAgent}
              selectedSkill={selectedSkill}
              focused={state.focus === "detail"}
              loadingAgentName={loadingAgent?.name ?? null}
              width={adjustedDetailWidth}
              height={contentHeight}
            />
          </Box>
        </Box>
      )}
      {state.modal?.kind === "help" ? <HelpOverlay /> : null}
      {state.modal?.kind === "confirm-adopt" ||
      state.modal?.kind === "confirm-adopt-all" ||
      state.modal?.kind === "confirm-remove" ||
      state.modal?.kind === "confirm-discard-dirty-form" ? (
        <ConfirmDialog modal={state.modal} />
      ) : null}
      {state.modal === null ? (
        <Footer actions={actions} search={state.search} />
      ) : largeModal ? null : (
        <Box height={3} />
      )}
    </Box>
  );
}

import { Box, Text } from "ink";
import type { DashboardModel } from "../dashboard-model";
import { useTheme } from "../theme";

export type StatusLineProps = {
  busy: boolean;
  statusMessage: string | null;
  model: DashboardModel;
};

export function StatusLine({ busy, statusMessage, model }: StatusLineProps) {
  const theme = useTheme();

  if (busy) {
    return (
      <Box height={1}>
        <Text bold color={theme.status.info}>
          ⚡ SkillMux
        </Text>
        <Text color={theme.fg.muted}> · </Text>
        <Text color={theme.status.info}>{statusMessage ?? "scanning..."}</Text>
      </Box>
    );
  }

  const agentCount = model.agents.length;
  let enabled = 0;
  let disabled = 0;
  let unmanaged = 0;
  let issueCount = 0;
  for (const agent of model.agents) {
    enabled += agent.enabledCount;
    disabled += agent.disabledCount;
    unmanaged += agent.unmanagedCount;
    issueCount += agent.issueCount;
  }

  if (statusMessage !== null) {
    return (
      <Box height={1}>
        <Text bold color={theme.fg.emphasis}>
          ⚡ SkillMux
        </Text>
        <Text color={theme.fg.muted}> · </Text>
        <Text color={theme.status.warning}>{statusMessage}</Text>
      </Box>
    );
  }

  return (
    <Box height={1}>
      <Text bold color={theme.fg.emphasis}>
        ⚡ SkillMux
      </Text>
      <Text color={theme.fg.muted}> · </Text>
      <Text dimColor>
        {agentCount} agent{agentCount !== 1 ? "s" : ""}
      </Text>
      <Text color={theme.fg.muted}> │ </Text>
      <Text color={theme.status.success}>
        {enabled} enabled
      </Text>
      <Text color={theme.fg.muted}> │ </Text>
      <Text dimColor>
        {disabled} disabled
      </Text>
      <Text color={theme.fg.muted}> │ </Text>
      <Text color={theme.status.warning}>
        {unmanaged} unmanaged
      </Text>
      {issueCount > 0 ? (
        <>
          <Text color={theme.fg.muted}> │ </Text>
          <Text color={theme.status.error}>
            {issueCount} issue{issueCount !== 1 ? "s" : ""}
          </Text>
        </>
      ) : null}
      {model.lastScanAt ? (
        <>
          <Text color={theme.fg.muted}> │ </Text>
          <Text dimColor>Last scan: {model.lastScanAt}</Text>
        </>
      ) : null}
    </Box>
  );
}

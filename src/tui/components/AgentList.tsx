import { Box, Text } from "ink";
import type { TuiAgentRow } from "../dashboard-model";
import { useTheme } from "../theme";

export type AgentListProps = {
  agents: TuiAgentRow[];
  selectedAgentId: string | null;
  focused: boolean;
  searchQuery?: string;
  width?: number;
  height?: number;
};

function statusColor(agent: TuiAgentRow, theme: ReturnType<typeof useTheme>): string {
  if (!agent.supported) return theme.status.error;
  if (!agent.exists || agent.issueCount > 0) return theme.status.warning;
  return theme.status.success;
}

function statusLabel(agent: TuiAgentRow): string {
  if (!agent.supported) return "!";
  if (!agent.exists) return "?";
  if (agent.issueCount > 0) return "*";
  return "*";
}

export function AgentList({
  agents,
  selectedAgentId,
  focused,
  searchQuery,
  width = 24,
  height = 18
}: AgentListProps) {
  const theme = useTheme();
  const emptyMessage =
    searchQuery !== undefined && searchQuery.trim().length > 0
      ? "No matching agents"
      : "No agents found";

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Text bold color={focused ? theme.fg.emphasis : theme.fg.muted}>
        Agents
      </Text>
      {agents.length === 0 ? (
        <Text dimColor>{emptyMessage}</Text>
      ) : (
        agents.map((agent) => {
          const selected = agent.id === selectedAgentId && focused;
          const prefix = selected ? ">" : " ";

          return (
            <Text key={agent.id}>
              <Text backgroundColor={selected ? theme.bg.selection : undefined}>
                <Text color={statusColor(agent, theme)}>{statusLabel(agent)}</Text>
                <Text color={selected ? theme.fg.emphasis : theme.fg.default}>
                  {" "}
                  {prefix} {agent.name}
                </Text>
              </Text>
            </Text>
          );
        })
      )}
    </Box>
  );
}

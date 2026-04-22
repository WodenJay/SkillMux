import { Box, Text } from "ink";
import type { TuiAgentRow } from "../dashboard-model";

export type AgentListProps = {
  agents: TuiAgentRow[];
  selectedAgentId: string | null;
  focused: boolean;
  searchQuery?: string;
  width?: number;
  height?: number;
};

function statusMarker(agent: TuiAgentRow): string {
  if (!agent.supported) {
    return "!";
  }

  if (!agent.exists) {
    return "?";
  }

  return "*";
}

function statusColor(agent: TuiAgentRow): string | undefined {
  if (!agent.supported) {
    return "red";
  }

  if (!agent.exists || agent.issueCount > 0) {
    return "yellow";
  }

  return "green";
}

export function AgentList({
  agents,
  selectedAgentId,
  focused,
  searchQuery,
  width = 24,
  height = 18
}: AgentListProps) {
  const emptyMessage =
    searchQuery !== undefined && searchQuery.trim().length > 0
      ? "No matching agents"
      : "No agents found";

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Text bold color={focused ? "cyan" : undefined}>
        Agents
      </Text>
      {agents.length === 0 ? (
        <Text dimColor>{emptyMessage}</Text>
      ) : (
        agents.map((agent) => {
          const selected = agent.id === selectedAgentId;
          const selectionPrefix = selected ? ">" : " ";

          return (
            <Text key={agent.id} inverse={selected}>
              <Text color={statusColor(agent)}>{statusMarker(agent)}</Text>
              <Text>{selectionPrefix} {agent.name}</Text>
            </Text>
          );
        })
      )}
    </Box>
  );
}

import { Box, Text } from "ink";
import type { TuiAgentRow } from "../dashboard-model";

export type AgentListProps = {
  agents: TuiAgentRow[];
  selectedAgentId: string | null;
  focused: boolean;
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
  focused
}: AgentListProps) {
  return (
    <Box flexDirection="column" width={24} height={18}>
      <Text bold color={focused ? "cyan" : undefined}>
        Agents
      </Text>
      {agents.length === 0 ? (
        <Text dimColor>No agents found</Text>
      ) : (
        agents.map((agent) => {
          const selected = agent.id === selectedAgentId;
          const counts = `E${agent.enabledCount} D${agent.disabledCount} U${agent.unmanagedCount} !${agent.issueCount}`;

          return (
            <Text key={agent.id} inverse={focused && selected}>
              <Text color={statusColor(agent)}>{statusMarker(agent)}</Text>
              <Text> {agent.name}</Text>
              <Text dimColor> {counts}</Text>
            </Text>
          );
        })
      )}
    </Box>
  );
}

import { Box, Text } from "ink";
import type { TuiSkillRow } from "../dashboard-model";

export type SkillListProps = {
  agentId: string | null;
  skills: TuiSkillRow[];
  selectedSkillId: string | null;
  focused: boolean;
  searchQuery?: string;
  loadingAgentName?: string | null;
  width?: number;
  height?: number;
};

function markerColor(skill: TuiSkillRow): string {
  if (skill.kind === "enabled") {
    return "green";
  }

  if (skill.kind === "issue") {
    return skill.severity === "error" ? "red" : "yellow";
  }

  if (skill.kind === "unmanaged") {
    return "yellow";
  }

  return "gray";
}

function skillLabel(skill: TuiSkillRow): string {
  if (skill.kind === "issue") {
    return skill.issueCode;
  }

  return skill.name;
}

export function SkillList({
  agentId,
  skills,
  selectedSkillId,
  focused,
  searchQuery,
  loadingAgentName = null,
  width = 28,
  height = 18
}: SkillListProps) {
  const emptyMessage =
    loadingAgentName !== null
      ? `Loading skills for ${loadingAgentName}...`
      : agentId === null
      ? "Select an agent"
      : searchQuery !== undefined && searchQuery.trim().length > 0
        ? "No matching skills"
        : "No skills for this agent";

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Text bold color={focused ? "cyan" : undefined}>
        Skills for {agentId ?? "none"}
      </Text>
      {skills.length === 0 ? (
        <Text dimColor>{emptyMessage}</Text>
      ) : (
        skills.map((skill) => {
          const selected = skill.id === selectedSkillId;

          return (
            <Text key={skill.id} inverse={focused && selected}>
              <Text color={markerColor(skill)}>{skill.marker}</Text>
              <Text> {skillLabel(skill)}</Text>
            </Text>
          );
        })
      )}
    </Box>
  );
}

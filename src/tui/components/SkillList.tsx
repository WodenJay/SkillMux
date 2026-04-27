import { Box, Text } from "ink";
import type { TuiSkillRow } from "../dashboard-model";
import { useTheme } from "../theme";

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

function statusLabel(skill: TuiSkillRow): string {
  if (skill.kind === "enabled") return "\u25CF";
  if (skill.kind === "disabled") return "\u25CB";
  if (skill.kind === "unmanaged") return "?";
  if (skill.severity === "error") return "!";
  return "*";
}

function statusColor(
  skill: TuiSkillRow,
  theme: ReturnType<typeof useTheme>
): string {
  if (skill.kind === "enabled") return theme.status.success;
  if (skill.kind === "disabled") return theme.fg.muted;
  if (skill.kind === "unmanaged") return theme.status.warning;
  return skill.severity === "error" ? theme.status.error : theme.status.warning;
}

function rowLabel(skill: TuiSkillRow): string {
  return skill.kind === "issue" ? skill.issueCode : skill.name;
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
  const theme = useTheme();

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
      <Text bold color={focused ? theme.fg.emphasis : theme.fg.muted}>
        Skills for {agentId ?? "none"}
      </Text>
      {skills.length === 0 ? (
        <Text dimColor>{emptyMessage}</Text>
      ) : (
        skills.map((skill) => {
          const selected = skill.id === selectedSkillId;

          return (
            <Text key={skill.id}>
              <Text
                backgroundColor={
                  focused && selected ? theme.bg.selection : undefined
                }
              >
                <Text bold color={statusColor(skill, theme)}>
                  {statusLabel(skill)}
                </Text>
                <Text
                  color={
                    focused && selected ? theme.fg.emphasis : theme.fg.default
                  }
                >
                  {" "}
                  {rowLabel(skill)}
                </Text>
              </Text>
            </Text>
          );
        })
      )}
    </Box>
  );
}

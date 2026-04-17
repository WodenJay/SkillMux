import { Box, Text } from "ink";
import type { TuiAgentRow, TuiSkillRow } from "../dashboard-model";

export type DetailPaneProps = {
  selectedAgent: TuiAgentRow | null;
  selectedSkill: TuiSkillRow | null;
  focused: boolean;
};

function detailLines(skill: TuiSkillRow): Array<[string, string]> {
  if (skill.kind === "enabled") {
    return [
      ["Name", skill.name],
      ["Status", "enabled"],
      ["Skill path", skill.path],
      ["Agent link", skill.activationLinkPath]
    ];
  }

  if (skill.kind === "disabled") {
    return [
      ["Name", skill.name],
      ["Status", "disabled"],
      ["Skill path", skill.path],
      ["Agent link", skill.activationLinkPath ?? "not linked"]
    ];
  }

  if (skill.kind === "unmanaged") {
    return [
      ["Name", skill.name],
      ["Status", "unmanaged"],
      ["Entry", skill.entryKind],
      ["Path", skill.path]
    ];
  }

  return [
    ["Status", "issue"],
    ["Code", skill.issueCode],
    ["Severity", skill.severity],
    ["Message", skill.message],
    ["Path", skill.path ?? "none"]
  ];
}

export function DetailPane({
  selectedAgent,
  selectedSkill,
  focused
}: DetailPaneProps) {
  return (
    <Box flexDirection="column" width={28} height={18}>
      <Text bold color={focused ? "cyan" : undefined}>
        Detail
      </Text>
      {selectedAgent === null ? (
        <Text dimColor>Select an agent</Text>
      ) : (
        <Text dimColor>Agent: {selectedAgent.name}</Text>
      )}
      {selectedSkill === null ? (
        <Text dimColor>Select a skill row</Text>
      ) : (
        detailLines(selectedSkill).map(([label, value]) => (
          <Text key={label}>
            <Text dimColor>{label}: </Text>
            <Text>{value}</Text>
          </Text>
        ))
      )}
    </Box>
  );
}

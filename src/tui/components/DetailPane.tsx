import { Box, Text } from "ink";
import type { TuiAgentRow, TuiSkillRow } from "../dashboard-model";
import { useTheme } from "../theme";

export type DetailPaneProps = {
  selectedAgent: TuiAgentRow | null;
  selectedSkill: TuiSkillRow | null;
  focused: boolean;
  loadingAgentName?: string | null;
  width?: number;
  height?: number;
};

type DetailLine = {
  label: string;
  value: string;
  compact: boolean;
};

function compactPath(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const separator = value.includes("\\") ? "\\" : "/";
  const parts = value.split(/[\\/]+/).filter((part) => part.length > 0);
  let suffix = parts.at(-1) ?? value;
  for (let index = parts.length - 2; index >= 0; index -= 1) {
    const candidate = `${parts[index]}${separator}${suffix}`;
    if (`...${separator}${candidate}`.length > maxLength) break;
    suffix = candidate;
  }
  const shortened = `...${separator}${suffix}`;
  if (shortened.length <= maxLength) return shortened;
  if (maxLength <= 3) return ".".repeat(maxLength);
  return `...${suffix.slice(-(maxLength - 3))}`;
}

function detailLines(skill: TuiSkillRow): DetailLine[] {
  if (skill.kind === "enabled") {
    return [
      { label: "Name", value: skill.name, compact: false },
      { label: "Status", value: "enabled", compact: false },
      { label: "Store", value: skill.path, compact: true },
      { label: "Link", value: skill.activationLinkPath, compact: true }
    ];
  }
  if (skill.kind === "disabled") {
    return [
      { label: "Name", value: skill.name, compact: false },
      { label: "Status", value: "disabled", compact: false },
      { label: "Store", value: skill.path, compact: true },
      {
        label: "Link",
        value: skill.activationLinkPath ?? "not linked",
        compact: skill.activationLinkPath !== null
      }
    ];
  }
  if (skill.kind === "unmanaged") {
    return [
      { label: "Name", value: skill.name, compact: false },
      { label: "Status", value: "unmanaged", compact: false },
      { label: "Entry", value: skill.entryKind, compact: false },
      { label: "Path", value: skill.path, compact: true }
    ];
  }
  return [
    { label: "Status", value: "issue", compact: false },
    { label: "Code", value: skill.issueCode, compact: false },
    { label: "Severity", value: skill.severity, compact: false },
    { label: "Message", value: skill.message, compact: false },
    { label: "Path", value: skill.path ?? "none", compact: skill.path !== null }
  ];
}

export function DetailPane({
  selectedAgent,
  selectedSkill,
  focused: _focused,
  loadingAgentName = null,
  width = 28,
  height = 18
}: DetailPaneProps) {
  const theme = useTheme();

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Text bold color={theme.fg.emphasis}>
        Detail
      </Text>
      {selectedAgent === null ? (
        <Text dimColor>Select an agent</Text>
      ) : (
        <Text color={theme.fg.muted}>Agent: {selectedAgent.name}</Text>
      )}
      {selectedSkill === null ? (
        loadingAgentName !== null ? (
          <Text dimColor>Loading details for {loadingAgentName}...</Text>
        ) : (
          <Text dimColor>Select a skill row</Text>
        )
      ) : (
        detailLines(selectedSkill).map(({ label, value, compact }) => {
          const valueWidth = Math.max(width - (label.length + 2), 8);
          const renderedValue = compact ? compactPath(value, valueWidth) : value;

          return (
            <Text key={label}>
              <Text bold color={theme.accent.primary}>
                {label}:{" "}
              </Text>
              <Text color={theme.fg.default}>{renderedValue}</Text>
            </Text>
          );
        })
      )}
    </Box>
  );
}

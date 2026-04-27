import { Box, Text } from "ink";
import { useTheme } from "../theme";

export function HelpOverlay() {
  const theme = useTheme();

  return (
    <Box flexDirection="column" height={8}>
      <Text bold color={theme.fg.emphasis}>Help</Text>
      <Text>
        <Text bold color={theme.accent.primary}>Navigation</Text>
        <Text color={theme.fg.default}>: Left/Right switch panels, j/k or Up/Down move, g/G jump.</Text>
      </Text>
      <Text>
        <Text bold color={theme.accent.primary}>Actions</Text>
        <Text color={theme.fg.default}>
          : Space toggles, a adopts, Shift+A current-agent bulk adopt, r removes, s scans, n add agent, e edit selected override, X remove selected override, i import, d doctor.
        </Text>
      </Text>
      <Text>
        <Text bold color={theme.accent.primary}>Search</Text>
        <Text color={theme.fg.default}>: / filters the focused list, Enter keeps the result, Esc cancels.</Text>
      </Text>
      <Text>
        <Text bold color={theme.accent.primary}>Skill markers</Text>
        <Text color={theme.fg.default}>: </Text>
        <Text color={theme.status.success}>{"\u25CF"} enabled</Text>
        <Text color={theme.fg.default}>  </Text>
        <Text color={theme.fg.muted}>{"\u25CB"} disabled</Text>
        <Text color={theme.fg.default}>  </Text>
        <Text color={theme.status.warning}>? unmanaged</Text>
        <Text color={theme.fg.default}>  </Text>
        <Text color={theme.status.error}>! issue</Text>
      </Text>
      <Text>
        <Text bold color={theme.accent.primary}>Safety</Text>
        <Text color={theme.fg.default}>: Toggle, adopt, remove, and scan can update SkillMux state and agent links.</Text>
      </Text>
    </Box>
  );
}

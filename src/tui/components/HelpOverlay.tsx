import { Box, Text } from "ink";

export function HelpOverlay() {
  return (
    <Box flexDirection="column" height={8}>
      <Text bold>Help</Text>
      <Text>
        <Text bold>Navigation</Text>
        <Text>: Left/Right switch panels, j/k or Up/Down move, g/G jump.</Text>
      </Text>
      <Text>
        <Text bold>Actions</Text>
        <Text>
          : Space toggles, a adopts, Shift+A current-agent bulk adopt, r removes, s scans, n add agent, e edit selected override, X remove selected override, i import, d doctor.
        </Text>
      </Text>
      <Text>
        <Text bold>Search</Text>
        <Text>: / filters the focused list, Enter keeps the result, Esc cancels.</Text>
      </Text>
      <Text>
        <Text bold>Agent icons</Text>
        <Text>: * ready, yellow * issues, ? missing, ! unsupported.</Text>
      </Text>
      <Text>
        <Text bold>Skill markers</Text>
        <Text>: ● enabled, ○ disabled, ? unmanaged, ! issue.</Text>
      </Text>
      <Text>
        <Text bold>Safety</Text>
        <Text>
          : Toggle, adopt, remove, and scan can update SkillMux state and agent links.
        </Text>
      </Text>
    </Box>
  );
}

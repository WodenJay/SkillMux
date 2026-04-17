import { Box, Text } from "ink";

export function HelpOverlay() {
  return (
    <Box flexDirection="column" height={7}>
      <Text bold>Help</Text>
      <Text>
        <Text bold>Navigation</Text>
        <Text>: Tab focus, j/k or arrows move, g/G jump.</Text>
      </Text>
      <Text>
        <Text bold>Actions</Text>
        <Text>: Space toggles managed skills, a adopts, r removes, s scans.</Text>
      </Text>
      <Text>
        <Text bold>Search</Text>
        <Text>: / filters the focused list, Esc closes search.</Text>
      </Text>
      <Text>
        <Text bold>Safety</Text>
        <Text>
          : Toggle, adopt, remove, and scan can write local SkillMux state or agent skill links.
        </Text>
      </Text>
    </Box>
  );
}

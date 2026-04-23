import { Box, Text } from "ink";
import type { TuiAvailableActions, TuiSearch } from "../state";

const agentLegend =
  "Agent icons: * ready  yellow * issues  ? missing  ! unsupported";
const skillLegend = "Skill markers: ● enabled  ○ disabled  ? unmanaged  ! issue";

export type FooterProps = {
  actions: TuiAvailableActions;
  search: TuiSearch | null;
};

export function Footer({ actions, search }: FooterProps) {
  const shortcuts = [
    "[Left/Right]focus",
    actions.toggle ? "[Space]toggle" : null,
    actions.adopt ? "[a]adopt" : null,
    actions.adoptAll ? "[Shift+A]adopt all" : null,
    actions.remove ? "[r]remove" : null,
    actions.scan ? "[s]scan" : null,
    actions.help ? "[?]help" : null,
    "[q]quit"
  ].filter((shortcut): shortcut is string => shortcut !== null);

  return (
    <Box flexDirection="column" height={3}>
      {search === null ? (
        <>
          <Text>{shortcuts.join("   ")}</Text>
          <Text dimColor>{agentLegend}</Text>
          <Text dimColor>{skillLegend}</Text>
        </>
      ) : (
        <Text>
          <Text color="cyan">/</Text>
          <Text>{search.query}</Text>
          <Text dimColor>   [Enter]keep   [Esc]cancel</Text>
        </Text>
      )}
    </Box>
  );
}

import { Box, Text } from "ink";
import type { TuiAvailableActions, TuiSearch } from "../state";

export type FooterProps = {
  actions: TuiAvailableActions;
  search: TuiSearch | null;
};

export function Footer({ actions, search }: FooterProps) {
  const shortcuts = [
    "[Left/Right]focus",
    actions.toggle ? "[Space]toggle" : null,
    actions.adopt ? "[a]adopt" : null,
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
          <Text dimColor>
            Agent icons: * ready, yellow warning on issues, ? missing, ! unsupported | Skill markers: filled circle enabled, hollow circle disabled, ? unmanaged, ! issue
          </Text>
        </>
      ) : (
        <Text>
          <Text color="cyan">/</Text>
          <Text>{search.query}</Text>
          <Text dimColor>   [Esc]close search</Text>
        </Text>
      )}
    </Box>
  );
}

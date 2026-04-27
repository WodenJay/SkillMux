import { Box, Text } from "ink";
import type { TuiAvailableActions, TuiSearch } from "../state";
import { useTheme } from "../theme";

export type FooterProps = {
  actions: TuiAvailableActions;
  search: TuiSearch | null;
};

export function Footer({ actions, search }: FooterProps) {
  const theme = useTheme();

  const shortcuts = [
    actions.addAgent ? "[n]add agent" : null,
    actions.editAgent ? "[e]edit agent" : null,
    actions.removeAgent ? "[X]remove agent" : null,
    actions.importSkill ? "[i]import" : null,
    actions.doctor ? "[d]doctor" : null,
    "\u2190\u2192 focus",
    actions.toggle ? "[Space]toggle" : null,
    actions.adopt ? "[a]adopt" : null,
    actions.adoptAll ? "[Shift+A]adopt all" : null,
    actions.remove ? "[r]remove" : null,
    actions.scan ? "[s]scan" : null,
    actions.help ? "[?]help" : null,
    "[q]quit"
  ].filter((shortcut): shortcut is string => shortcut !== null);

  const legendParts = [
    { label: "enabled", color: theme.status.success },
    { label: "disabled", color: theme.fg.muted },
    { label: "unmanaged", color: theme.status.warning },
    { label: "issue", color: theme.status.error }
  ];

  if (search !== null) {
    return (
      <Box flexDirection="column" height={3}>
        <Text>
          <Text color={theme.accent.primary}>/</Text>
          <Text color={theme.fg.default}>{search.query}</Text>
          <Text dimColor>   [Enter]keep   [Esc]cancel</Text>
        </Text>
        <Text dimColor>
          {legendParts.map((p, i) => (
            <Text key={p.label}>
              <Text color={p.color}>{p.label}</Text>
              {i < legendParts.length - 1 ? "  " : ""}
            </Text>
          ))}
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height={3}>
      <Text dimColor>{shortcuts.join("   ")}</Text>
      <Text dimColor>
        SkillMux {"\u00b7"} [j/k]move {"\u00b7"} [g/G]top/bottom {"\u00b7"} [/]search
      </Text>
      <Text dimColor>
        {legendParts.map((p, i) => (
          <Text key={p.label}>
            <Text color={p.color}>{p.label}</Text>
            {i < legendParts.length - 1 ? " \u00b7 " : ""}
          </Text>
        ))}
      </Text>
    </Box>
  );
}

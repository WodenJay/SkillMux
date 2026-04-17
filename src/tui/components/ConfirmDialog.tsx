import { Box, Text } from "ink";
import type { TuiModal } from "../state";

export type ConfirmDialogProps = {
  modal: Extract<
    TuiModal,
    { kind: "confirm-adopt" } | { kind: "confirm-remove" }
  >;
};

function confirmationText(modal: ConfirmDialogProps["modal"]): string {
  if (modal.kind === "confirm-adopt") {
    return `Adopt ${modal.skillId} for ${modal.agentId}?`;
  }

  return `Remove ${modal.skillId} from SkillMux?`;
}

export function ConfirmDialog({ modal }: ConfirmDialogProps) {
  return (
    <Box flexDirection="column" height={4}>
      <Text bold color={modal.kind === "confirm-remove" ? "yellow" : "cyan"}>
        Confirm
      </Text>
      <Text>{confirmationText(modal)}</Text>
      <Text>[y] confirm   [Esc] cancel</Text>
    </Box>
  );
}

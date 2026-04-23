import { Box, Text } from "ink";
import type { TuiModal } from "../state";

export type ConfirmDialogProps = {
  modal: Extract<
    TuiModal,
    { kind: "confirm-adopt" } | { kind: "confirm-adopt-all" } | { kind: "confirm-remove" }
  >;
};

export const confirmDialogHeight = 4;

function confirmationText(modal: ConfirmDialogProps["modal"]): string {
  if (modal.kind === "confirm-adopt") {
    return `Adopt ${modal.skillId} for ${modal.agentId}?`;
  }

  if (modal.kind === "confirm-adopt-all") {
    return `Adopt all unmanaged skills for ${modal.agentId}?`;
  }

  return `Remove ${modal.skillId} from SkillMux?`;
}

function confirmationDetails(modal: ConfirmDialogProps["modal"]): string | null {
  if (modal.kind !== "confirm-adopt-all") {
    return null;
  }

  return `${modal.unmanagedCount} unmanaged skills will be moved under SkillMux management.`;
}

export function ConfirmDialog({ modal }: ConfirmDialogProps) {
  return (
    <Box flexDirection="column" height={confirmDialogHeight}>
      <Text bold color={modal.kind === "confirm-remove" ? "yellow" : "cyan"}>
        Confirm
      </Text>
      <Text>{confirmationText(modal)}</Text>
      {confirmationDetails(modal) === null ? null : <Text>{confirmationDetails(modal)}</Text>}
      <Text>[y] confirm   [Esc] cancel</Text>
    </Box>
  );
}

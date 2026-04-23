import { Box, Text } from "ink";
import type { ReactElement } from "react";
import type { TuiModal } from "../state";

export type FormDialogModal = Extract<
  TuiModal,
  { kind: "add-agent" } | { kind: "edit-agent" } | { kind: "import" }
>;

export type FormDialogProps = {
  modal: FormDialogModal;
  fieldIndex?: number;
  platformIndex?: number;
  width?: number;
  height?: number;
};

const platformOptions = ["win32", "linux", "darwin"] as const;

function checkbox(value: boolean): string {
  return value ? "[x]" : "[ ]";
}

function renderTextField(
  label: string,
  value: string,
  active: boolean
): ReactElement {
  return (
    <Text key={label} inverse={active}>
      <Text bold>{label}: </Text>
      <Text>{value.length > 0 ? value : " "}</Text>
    </Text>
  );
}

function renderBooleanField(
  label: string,
  value: boolean,
  active: boolean
): ReactElement {
  return (
    <Text key={label} inverse={active}>
      <Text bold>{label}: </Text>
      <Text>{checkbox(value)}</Text>
    </Text>
  );
}

function renderPlatformField(
  selectedPlatforms: string[],
  activePlatformIndex: number,
  active: boolean
): ReactElement[] {
  return platformOptions.map((platform, index) => {
    const selected = selectedPlatforms.includes(platform);
    const isCurrent = active && index === activePlatformIndex;

    return (
      <Text key={platform} inverse={isCurrent}>
        <Text>{isCurrent ? "> " : "  "}</Text>
        <Text>{checkbox(selected)} </Text>
        <Text>{platform}</Text>
      </Text>
    );
  });
}

export function FormDialog({
  modal,
  fieldIndex = 0,
  platformIndex = 0,
  width = 72,
  height = 14
}: FormDialogProps) {
  const activeField = fieldIndex;

  if (modal.kind === "import") {
    return (
      <Box flexDirection="column" width={width} height={height}>
        <Text bold>Import skill</Text>
        {renderTextField(
          "Source path",
          modal.form.values.sourcePath,
          activeField === 0
        )}
        {renderTextField(
          "Skill name",
          modal.form.values.skillName,
          activeField === 1
        )}
        <Text dimColor>[Tab] next   [Shift+Tab] previous   [Enter] submit   [Esc] cancel</Text>
      </Box>
    );
  }

  const title =
    modal.kind === "add-agent"
      ? "Add agent"
      : `Edit agent ${modal.agentId}`;
  const fields =
    modal.kind === "add-agent"
      ? [
          renderTextField("Agent id", modal.form.values.id, activeField === 0),
          renderTextField("Root path", modal.form.values.root, activeField === 1),
          renderTextField("Skills path", modal.form.values.skills, activeField === 2),
          renderTextField("Display name", modal.form.values.name, activeField === 3)
        ]
      : [
          renderTextField("Root path", modal.form.values.root, activeField === 0),
          renderTextField("Skills path", modal.form.values.skills, activeField === 1),
          renderTextField("Display name", modal.form.values.name, activeField === 2)
        ];

  const platformFieldIndex = modal.kind === "add-agent" ? 4 : 3;
  const booleanFieldIndex = modal.kind === "add-agent" ? 5 : 4;
  const platformLines = renderPlatformField(
    modal.form.values.platforms,
    platformIndex,
    activeField === platformFieldIndex
  );
  const booleanLabel =
    modal.kind === "add-agent"
      ? "Disabled by default"
      : "Enabled by default";
  const booleanValue =
    modal.kind === "add-agent"
      ? modal.form.values.disabledByDefault
      : modal.form.values.enabledByDefault;
  const secondaryBooleanLabel =
    modal.kind === "add-agent" ? null : "Disabled by default";

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Text bold>{title}</Text>
      {fields}
      <Text bold inverse={activeField === platformFieldIndex}>
        Platforms
      </Text>
      {platformLines}
      {renderBooleanField(
        booleanLabel,
        booleanValue,
        activeField === booleanFieldIndex
      )}
      {secondaryBooleanLabel === null
        ? null
        : renderBooleanField(
            secondaryBooleanLabel,
            modal.form.values.disabledByDefault,
            activeField === booleanFieldIndex + 1
          )}
      {modal.kind === "edit-agent" ? (
        <Text dimColor>Leaving both defaults unchecked preserves the current setting.</Text>
      ) : null}
      <Text dimColor>[Tab] next   [Shift+Tab] previous   [Enter] submit   [Esc] cancel</Text>
    </Box>
  );
}

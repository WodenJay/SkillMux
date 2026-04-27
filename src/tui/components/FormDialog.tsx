import { Box, Text } from "ink";
import type { ReactElement } from "react";
import type { TuiModal } from "../state";
import { useTheme } from "../theme";

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
  active: boolean,
  theme: ReturnType<typeof useTheme>
): ReactElement {
  if (active) {
    return (
      <Text key={label} backgroundColor={theme.bg.selection}>
        <Text bold color={theme.fg.emphasis}>{label}: </Text>
        <Text color={theme.fg.emphasis}>{value.length > 0 ? value : " "}</Text>
      </Text>
    );
  }
  return (
    <Text key={label}>
      <Text bold color={theme.accent.primary}>{label}: </Text>
      <Text color={theme.fg.default}>{value.length > 0 ? value : " "}</Text>
    </Text>
  );
}

function renderBooleanField(
  label: string,
  value: boolean,
  active: boolean,
  theme: ReturnType<typeof useTheme>
): ReactElement {
  if (active) {
    return (
      <Text key={label} backgroundColor={theme.bg.selection}>
        <Text bold color={theme.fg.emphasis}>{label}: </Text>
        <Text color={theme.fg.emphasis}>{checkbox(value)}</Text>
      </Text>
    );
  }
  return (
    <Text key={label}>
      <Text bold color={theme.accent.primary}>{label}: </Text>
      <Text color={theme.fg.default}>{checkbox(value)}</Text>
    </Text>
  );
}

function renderPlatformField(
  selectedPlatforms: string[],
  activePlatformIndex: number,
  active: boolean,
  theme: ReturnType<typeof useTheme>
): ReactElement[] {
  return platformOptions.map((platform, index) => {
    const selected = selectedPlatforms.includes(platform);
    const isCurrent = active && index === activePlatformIndex;

    if (isCurrent) {
      return (
        <Text key={platform} backgroundColor={theme.bg.selection}>
          <Text color={theme.fg.emphasis}>{"> "}{checkbox(selected)} {platform}</Text>
        </Text>
      );
    }
    return (
      <Text key={platform}>
        <Text color={selected ? theme.status.success : theme.fg.muted}>
          {"  "}{checkbox(selected)} {platform}
        </Text>
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
  const theme = useTheme();
  const activeField = fieldIndex;

  if (modal.kind === "import") {
    const submitFieldIndex = 2;
    return (
      <Box flexDirection="column" width={width} height={height}>
        <Text bold color={theme.fg.emphasis}>Import skill</Text>
        {modal.form.error === null ? null : <Text color={theme.status.error}>{modal.form.error}</Text>}
        {renderTextField(
          "Source path",
          modal.form.values.sourcePath,
          activeField === 0,
          theme
        )}
        {renderTextField(
          "Skill name",
          modal.form.values.skillName,
          activeField === 1,
          theme
        )}
        <Text>
          {activeField === submitFieldIndex ? (
            <Text backgroundColor={theme.bg.selection}>
              <Text bold color={theme.fg.emphasis}>Submit</Text>
            </Text>
          ) : (
            <Text bold color={theme.accent.primary}>Submit</Text>
          )}
        </Text>
        <Text dimColor>[Up/Down] move   [Enter] submit selected row   [Esc] cancel</Text>
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
          renderTextField("Agent id", modal.form.values.id, activeField === 0, theme),
          renderTextField("Root path", modal.form.values.root, activeField === 1, theme),
          renderTextField("Skills path", modal.form.values.skills, activeField === 2, theme),
          renderTextField("Display name", modal.form.values.name, activeField === 3, theme)
        ]
      : [
          renderTextField("Root path", modal.form.values.root, activeField === 0, theme),
          renderTextField("Skills path", modal.form.values.skills, activeField === 1, theme),
          renderTextField("Display name", modal.form.values.name, activeField === 2, theme)
        ];

  const platformFieldIndex = modal.kind === "add-agent" ? 4 : 3;
  const booleanFieldIndex = modal.kind === "add-agent" ? 5 : 4;
  const submitFieldIndex = 6;
  const platformLines = renderPlatformField(
    modal.form.values.platforms,
    platformIndex,
    activeField === platformFieldIndex,
    theme
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
      <Text bold color={theme.fg.emphasis}>{title}</Text>
      {modal.form.error === null ? null : <Text color={theme.status.error}>{modal.form.error}</Text>}
      {fields}
      <Text>
        {activeField === platformFieldIndex ? (
          <Text backgroundColor={theme.bg.selection}>
            <Text bold color={theme.fg.emphasis}>Platforms</Text>
          </Text>
        ) : (
          <Text bold color={theme.accent.primary}>Platforms</Text>
        )}
      </Text>
      {platformLines}
      {renderBooleanField(
        booleanLabel,
        booleanValue,
        activeField === booleanFieldIndex,
        theme
      )}
      {secondaryBooleanLabel === null
        ? null
        : renderBooleanField(
            secondaryBooleanLabel,
            modal.form.values.disabledByDefault,
            activeField === booleanFieldIndex + 1,
            theme
          )}
      <Text>
        {activeField === submitFieldIndex ? (
          <Text backgroundColor={theme.bg.selection}>
            <Text bold color={theme.fg.emphasis}>Submit</Text>
          </Text>
        ) : (
          <Text bold color={theme.accent.primary}>Submit</Text>
        )}
      </Text>
      {modal.kind === "edit-agent" ? (
        <Text dimColor>Leaving both defaults unchecked preserves the current setting.</Text>
      ) : null}
      <Text dimColor>[Up/Down] move   [Enter] submit   [Esc] cancel</Text>
    </Box>
  );
}

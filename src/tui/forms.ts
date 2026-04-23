import type { RunConfigAddAgentOptions } from "../commands/config-add-agent";
import type { RunConfigUpdateAgentOptions } from "../commands/config-update-agent";
import type { RunImportOptions } from "../commands/import";

type FormState<TValues extends Record<string, unknown>> = {
  values: TValues;
  initialValues: TValues;
  dirty: boolean;
  error: string | null;
};

export type ConfigAddAgentFormValues = {
  id: string;
  root: string;
  skills: string;
  name: string;
  platforms: string[];
  disabledByDefault: boolean;
};

export type ConfigAddAgentForm = FormState<ConfigAddAgentFormValues>;

export type ConfigUpdateAgentFormValues = {
  root: string;
  skills: string;
  name: string;
  platforms: string[];
  enabledByDefault: boolean;
  disabledByDefault: boolean;
  preserveEnabledByDefault: boolean;
};

export type ConfigUpdateAgentForm = FormState<ConfigUpdateAgentFormValues>;

export type ImportSkillFormValues = {
  sourcePath: string;
  skillName: string;
};

export type ImportSkillForm = FormState<ImportSkillFormValues>;

function cloneValues<TValues extends Record<string, unknown>>(values: TValues): TValues {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      Array.isArray(value) ? [...value] : value
    ])
  ) as TValues;
}

function isDirty<TValues extends Record<string, unknown>>(
  values: TValues,
  initialValues: TValues
): boolean {
  return JSON.stringify(values) !== JSON.stringify(initialValues);
}

function trimOrEmpty(value: string | undefined): string {
  return (value ?? "").trim();
}

function normalizePlatformList(value: string[]): string[] | undefined {
  const platforms = value
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

  return platforms.length === 0 ? undefined : [...new Set(platforms)];
}

function updateFormField<TValues extends Record<string, unknown>, TField extends keyof TValues>(
  form: FormState<TValues>,
  field: TField,
  value: TValues[TField]
): FormState<TValues> {
  const nextValues = {
    ...form.values,
    [field]: value
  } as TValues;

  return {
    values: nextValues,
    initialValues: form.initialValues,
    dirty: isDirty(nextValues, form.initialValues),
    error: null
  };
}

function buildConfigAddAgentDefaults(): ConfigAddAgentFormValues {
  return {
    id: "",
    root: "root",
    skills: "skills",
    name: "",
    platforms: [],
    disabledByDefault: false
  };
}

function buildConfigUpdateAgentDefaults(): ConfigUpdateAgentFormValues {
  return {
    root: "",
    skills: "skills",
    name: "",
    platforms: [],
    enabledByDefault: false,
    disabledByDefault: false,
    preserveEnabledByDefault: false
  };
}

function buildImportDefaults(): ImportSkillFormValues {
  return {
    sourcePath: "",
    skillName: ""
  };
}

function normalizeConfigAddAgentValues(
  values: ConfigAddAgentFormValues
): RunConfigAddAgentOptionsLike {
  return {
    id: trimOrEmpty(values.id),
    root: trimOrEmpty(values.root),
    skills: trimOrEmpty(values.skills) || undefined,
    name: trimOrEmpty(values.name) || undefined,
    platforms: normalizePlatformList(values.platforms),
    disabledByDefault: values.disabledByDefault ? true : undefined
  };
}

function normalizeConfigUpdateAgentValues(
  values: ConfigUpdateAgentFormValues,
  agentId: string
): RunConfigUpdateAgentOptionsLike {
  const enabledByDefault = values.enabledByDefault ? true : undefined;
  const disabledByDefault = values.disabledByDefault ? true : undefined;

  return {
    id: agentId,
    root: trimOrEmpty(values.root) || undefined,
    skills: trimOrEmpty(values.skills) || undefined,
    name: trimOrEmpty(values.name) || undefined,
    platforms: normalizePlatformList(values.platforms),
    ...(values.preserveEnabledByDefault
      ? {}
      : {
          enabledByDefault,
          disabledByDefault
        })
  };
}

function normalizeImportValues(values: ImportSkillFormValues): RunImportOptionsLike {
  return {
    sourcePath: trimOrEmpty(values.sourcePath),
    skillName: trimOrEmpty(values.skillName)
  };
}

type RunConfigAddAgentOptionsLike = Pick<
  RunConfigAddAgentOptions,
  "id" | "root" | "skills" | "name" | "platforms" | "disabledByDefault"
>;

type RunConfigUpdateAgentOptionsLike = Pick<
  RunConfigUpdateAgentOptions,
  "id" | "root" | "skills" | "name" | "platforms" | "enabledByDefault" | "disabledByDefault"
>;

type RunImportOptionsLike = Pick<RunImportOptions, "sourcePath" | "skillName">;

export function createConfigAddAgentForm(
  values: Partial<ConfigAddAgentFormValues> = {}
): ConfigAddAgentForm {
  const initialValues = {
    ...buildConfigAddAgentDefaults(),
    ...values
  };

  return {
    values: cloneValues(initialValues),
    initialValues: cloneValues(initialValues),
    dirty: false,
    error: null
  };
}

export function updateConfigAddAgentFormField<TField extends keyof ConfigAddAgentFormValues>(
  form: ConfigAddAgentForm,
  field: TField,
  value: ConfigAddAgentFormValues[TField]
): ConfigAddAgentForm {
  return updateFormField(form, field, value);
}

export function validateConfigAddAgentForm(form: ConfigAddAgentForm): string | null {
  const values = normalizeConfigAddAgentValues(form.values);

  if (values.id.length === 0 || values.root.length === 0) {
    return "Agent id and root are required";
  }

  return null;
}

export function buildRunConfigAddAgentOptions(
  form: ConfigAddAgentForm
): RunConfigAddAgentOptionsLike {
  return normalizeConfigAddAgentValues(form.values);
}

export function normalizeRunConfigAddAgentOptions(
  input: RunConfigAddAgentOptionsLike
): RunConfigAddAgentOptionsLike {
  return {
    id: trimOrEmpty(input.id),
    root: trimOrEmpty(input.root),
    skills: input.skills === undefined ? undefined : trimOrEmpty(input.skills),
    name: input.name === undefined ? undefined : trimOrEmpty(input.name),
    platforms:
      input.platforms === undefined
        ? undefined
        : [...new Set(input.platforms.map((entry) => entry.trim().toLowerCase()).filter((entry) => entry.length > 0))],
    disabledByDefault: input.disabledByDefault === true ? true : undefined
  };
}

export function createConfigUpdateAgentForm(
  values: Partial<ConfigUpdateAgentFormValues> = {}
): ConfigUpdateAgentForm {
  const initialValues = {
    ...buildConfigUpdateAgentDefaults(),
    ...values
  };

  return {
    values: cloneValues(initialValues),
    initialValues: cloneValues(initialValues),
    dirty: false,
    error: null
  };
}

export function updateConfigUpdateAgentFormField<TField extends keyof ConfigUpdateAgentFormValues>(
  form: ConfigUpdateAgentForm,
  field: TField,
  value: ConfigUpdateAgentFormValues[TField]
): ConfigUpdateAgentForm {
  const next =
    field === "enabledByDefault" && value === true
      ? updateFormField(
          updateFormField(form, field, value),
          "disabledByDefault",
          false
        )
      : field === "disabledByDefault" && value === true
        ? updateFormField(updateFormField(form, field, value), "enabledByDefault", false)
        : updateFormField(form, field, value);

  return {
    ...next,
    values: {
      ...next.values,
      enabledByDefault:
        field === "disabledByDefault" && value === true ? false : next.values.enabledByDefault,
      disabledByDefault:
        field === "enabledByDefault" && value === true ? false : next.values.disabledByDefault,
      preserveEnabledByDefault:
        field === "enabledByDefault" || field === "disabledByDefault"
          ? false
          : next.values.preserveEnabledByDefault
    }
  };
}

export function validateConfigUpdateAgentForm(form: ConfigUpdateAgentForm): string | null {
  const values = normalizeConfigUpdateAgentValues(form.values, "agent");

  if (values.root !== undefined && values.root.length === 0) {
    return "Root path cannot be empty";
  }

  if (form.values.enabledByDefault && form.values.disabledByDefault) {
    return "Enabled by default and disabled by default cannot both be set";
  }

  return null;
}

export type ConfigUpdateAgentSeed = {
  id: string;
  stableName?: string;
  homeRelativeRootPath?: string;
  skillsDirectoryPath?: string;
  supportedPlatforms?: string[];
  overrideEnabledByDefault?: boolean;
};

export function createConfigUpdateAgentFormFromSeed(
  seed: ConfigUpdateAgentSeed
): ConfigUpdateAgentForm {
  return createConfigUpdateAgentForm({
    root: seed.homeRelativeRootPath ?? "",
    skills: seed.skillsDirectoryPath ?? "",
    name: seed.stableName ?? "",
    platforms: [...(seed.supportedPlatforms ?? [])],
    enabledByDefault: seed.overrideEnabledByDefault === true,
    disabledByDefault: seed.overrideEnabledByDefault === false,
    preserveEnabledByDefault: seed.overrideEnabledByDefault === undefined
  });
}

export function buildRunConfigUpdateAgentOptions(
  form: ConfigUpdateAgentForm,
  agentId: string
): RunConfigUpdateAgentOptionsLike {
  const values = normalizeConfigUpdateAgentValues(form.values, agentId);

  return {
    id: values.id,
    ...(values.root === undefined ? {} : { root: values.root }),
    ...(values.skills === undefined ? {} : { skills: values.skills }),
    ...(values.name === undefined ? {} : { name: values.name }),
    ...(values.platforms === undefined ? {} : { platforms: values.platforms }),
    ...(values.enabledByDefault === undefined ? {} : { enabledByDefault: true }),
    ...(values.disabledByDefault === undefined ? {} : { disabledByDefault: true })
  };
}

export function normalizeRunConfigUpdateAgentOptions(
  input: RunConfigUpdateAgentOptionsLike
): RunConfigUpdateAgentOptionsLike {
  return {
    id: trimOrEmpty(input.id),
    ...(input.root === undefined ? {} : { root: trimOrEmpty(input.root) }),
    ...(input.skills === undefined ? {} : { skills: trimOrEmpty(input.skills) }),
    ...(input.name === undefined ? {} : { name: trimOrEmpty(input.name) }),
    ...(input.platforms === undefined
      ? {}
      : {
          platforms: [...new Set(input.platforms.map((entry) => entry.trim().toLowerCase()))]
        }),
    ...(input.enabledByDefault === true ? { enabledByDefault: true } : {}),
    ...(input.disabledByDefault === true ? { disabledByDefault: true } : {})
  };
}

export function createImportSkillForm(
  values: Partial<ImportSkillFormValues> = {}
): ImportSkillForm {
  const initialValues = {
    ...buildImportDefaults(),
    ...values
  };

  return {
    values: cloneValues(initialValues),
    initialValues: cloneValues(initialValues),
    dirty: false,
    error: null
  };
}

export function updateImportSkillFormField<TField extends keyof ImportSkillFormValues>(
  form: ImportSkillForm,
  field: TField,
  value: ImportSkillFormValues[TField]
): ImportSkillForm {
  return updateFormField(form, field, value);
}

export function validateImportSkillForm(form: ImportSkillForm): string | null {
  const values = normalizeImportValues(form.values);

  if (values.sourcePath.length === 0 || values.skillName.length === 0) {
    return "Skill name and source path are required";
  }

  return null;
}

export function buildRunImportOptions(form: ImportSkillForm): RunImportOptionsLike {
  return normalizeImportValues(form.values);
}

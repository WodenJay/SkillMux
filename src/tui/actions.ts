import { runAdopt as defaultRunAdopt } from "../commands/adopt";
import { runConfigAddAgent as defaultRunConfigAddAgent } from "../commands/config-add-agent";
import { runConfigRemoveAgent as defaultRunConfigRemoveAgent } from "../commands/config-remove-agent";
import { runConfigUpdateAgent as defaultRunConfigUpdateAgent } from "../commands/config-update-agent";
import { runDisable as defaultRunDisable } from "../commands/disable";
import { runDoctor as defaultRunDoctor } from "../commands/doctor";
import { runEnable as defaultRunEnable } from "../commands/enable";
import { runImport as defaultRunImport } from "../commands/import";
import { runRemove as defaultRunRemove } from "../commands/remove";
import { runScan as defaultRunScan } from "../commands/scan";
import { normalizeAgentId } from "../config/agent-override-validation";
import type { RunConfigAddAgentResult } from "../commands/config-add-agent";
import type { RunConfigRemoveAgentResult } from "../commands/config-remove-agent";
import type { RunConfigUpdateAgentResult } from "../commands/config-update-agent";
import type { RunDoctorResult } from "../commands/doctor";
import type { RunImportResult } from "../commands/import";
import type { DashboardModel, TuiSkillRow } from "./dashboard-model";
import {
  normalizeRunConfigAddAgentOptions,
  normalizeRunConfigUpdateAgentOptions
} from "./forms";
import {
  loadDashboardState,
  type LoadDashboardStateOptions
} from "./load-dashboard-state";
import type { TuiPendingCommand } from "./state";

export type { TuiPendingCommand } from "./state";

export type TuiAction = "toggle" | "adopt" | "adopt-all" | "remove" | "scan";

type CommandOutput = {
  output: string;
};

export type TuiActionServices = {
  runEnable: (options: {
    homeDir?: string;
    skillmuxHome?: string;
    skill: string;
    agent: string;
  }) => Promise<CommandOutput>;
  runDisable: (options: {
    homeDir?: string;
    skillmuxHome?: string;
    skill: string;
    agent: string;
  }) => Promise<CommandOutput>;
  runAdopt: (options: {
    homeDir?: string;
    skillmuxHome?: string;
    agent: string;
    skill?: string;
  }) => Promise<CommandOutput>;
  runConfigAddAgent: (options: {
    homeDir?: string;
    skillmuxHome?: string;
    id: string;
    root: string;
    skills?: string;
    name?: string;
    platforms?: string[];
    disabledByDefault?: boolean;
  }) => Promise<Pick<RunConfigAddAgentResult, "output" | "agentId">>;
  runConfigUpdateAgent: (options: {
    homeDir?: string;
    skillmuxHome?: string;
    id: string;
    root?: string;
    skills?: string;
    name?: string;
    platforms?: string[];
    enabledByDefault?: boolean;
    disabledByDefault?: boolean;
  }) => Promise<Pick<RunConfigUpdateAgentResult, "output" | "agentId">>;
  runConfigRemoveAgent: (options: {
    homeDir?: string;
    skillmuxHome?: string;
    id: string;
  }) => Promise<Pick<RunConfigRemoveAgentResult, "output">>;
  runImport: (options: {
    homeDir?: string;
    skillmuxHome?: string;
    sourcePath: string;
    skillName: string;
  }) => Promise<Pick<RunImportResult, "output">>;
  runDoctor: (options: {
    homeDir?: string;
    skillmuxHome?: string;
    platform?: NodeJS.Platform;
  }) => Promise<RunDoctorResult>;
  runRemove: (options: {
    homeDir?: string;
    skillmuxHome?: string;
    skill: string;
  }) => Promise<CommandOutput>;
  runScan: (options: {
    homeDir?: string;
    skillmuxHome?: string;
    platform?: NodeJS.Platform;
  }) => Promise<CommandOutput>;
  reload: (options: LoadDashboardStateOptions) => Promise<DashboardModel>;
};

export type DispatchTuiActionInput = {
  action: TuiAction | TuiPendingCommand;
  model: DashboardModel;
  homeDir?: string;
  skillmuxHome?: string;
  platform?: NodeJS.Platform;
  services?: Partial<TuiActionServices>;
};

export type DispatchTuiActionResult = {
  model: DashboardModel;
  statusMessage: string;
  doctor?: RunDoctorResult;
  commandSucceeded?: boolean;
};

const defaultServices: TuiActionServices = {
  runEnable: defaultRunEnable,
  runDisable: defaultRunDisable,
  runAdopt: defaultRunAdopt,
  runConfigAddAgent: defaultRunConfigAddAgent,
  runConfigUpdateAgent: defaultRunConfigUpdateAgent,
  runConfigRemoveAgent: defaultRunConfigRemoveAgent,
  runImport: defaultRunImport,
  runDoctor: defaultRunDoctor,
  runRemove: defaultRunRemove,
  runScan: defaultRunScan,
  reload: loadDashboardState
};

function stripTrailingNewlines(output: string): string {
  return output.replace(/[\r\n]+$/u, "");
}

function actionLabel(action: TuiAction): string {
  return action.charAt(0).toUpperCase() + action.slice(1);
}

function commandLabel(kind: TuiPendingCommand["kind"]): string {
  if (kind === "config-add-agent") {
    return "Config add agent";
  }

  if (kind === "config-update-agent") {
    return "Config update agent";
  }

  if (kind === "config-remove-agent") {
    return "Config remove agent";
  }

  if (kind === "import-skill") {
    return "Import skill";
  }

  return "Doctor";
}

function errorReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const firstLine = message.split(/\r?\n/u)[0]?.trim();

  return firstLine === undefined || firstLine.length === 0
    ? "Unknown error"
    : firstLine;
}

function reloadOptions(
  input: DispatchTuiActionInput,
  selection: {
    selectedAgentId?: string | null;
    selectedSkillId?: string | null;
  } = {}
): LoadDashboardStateOptions {
  const hasSelectedAgentId = Object.prototype.hasOwnProperty.call(
    selection,
    "selectedAgentId"
  );
  const hasSelectedSkillId = Object.prototype.hasOwnProperty.call(
    selection,
    "selectedSkillId"
  );

  return {
    homeDir: input.homeDir,
    skillmuxHome: input.skillmuxHome,
    platform: input.platform,
    selectedAgentId: hasSelectedAgentId
      ? selection.selectedAgentId ?? undefined
      : input.model.selectedAgentId ?? undefined,
    selectedSkillId: hasSelectedSkillId
      ? selection.selectedSkillId ?? undefined
      : input.model.selectedSkillId ?? undefined
  };
}

async function reloadAfterCommand(
  input: DispatchTuiActionInput,
  services: TuiActionServices,
  output: string,
  selection: {
    selectedAgentId?: string | null;
    selectedSkillId?: string | null;
  } = {}
): Promise<DispatchTuiActionResult> {
  return {
    model: await services.reload(reloadOptions(input, selection)),
    statusMessage: stripTrailingNewlines(output)
  };
}

function refusal(
  model: DashboardModel,
  statusMessage: string
): DispatchTuiActionResult {
  return { model, statusMessage };
}

function resolveSelectedSkill(model: DashboardModel): TuiSkillRow | null {
  if (model.selectedSkillId === null) {
    return null;
  }

  return model.skills.find((row) => row.id === model.selectedSkillId) ?? null;
}

function resolveSelectedAgent(model: DashboardModel): {
  id: string;
  unmanagedCount: number;
} | null {
  if (model.selectedAgentId === null) {
    return null;
  }

  return (
    model.agents.find((row) => row.id === model.selectedAgentId) ?? null
  );
}

function isPendingCommand(action: TuiAction | TuiPendingCommand): action is TuiPendingCommand {
  return typeof action === "object";
}

export async function dispatchTuiAction(
  input: DispatchTuiActionInput
): Promise<DispatchTuiActionResult> {
  const services = { ...defaultServices, ...input.services };

  try {
    if (isPendingCommand(input.action)) {
      if (input.action.kind === "config-add-agent") {
        const normalizedInput = normalizeRunConfigAddAgentOptions(input.action.input);
        const result = await services.runConfigAddAgent({
          homeDir: input.homeDir,
          skillmuxHome: input.skillmuxHome,
          ...normalizedInput
        });

        return reloadAfterCommand(
          input,
          services,
          result.output,
          {
            selectedAgentId: result.agentId ?? normalizeAgentId(normalizedInput.id),
            selectedSkillId: undefined
          }
        );
      }

      if (input.action.kind === "config-update-agent") {
        const normalizedInput = normalizeRunConfigUpdateAgentOptions(input.action.input);
        const result = await services.runConfigUpdateAgent({
          homeDir: input.homeDir,
          skillmuxHome: input.skillmuxHome,
          ...normalizedInput
        });

        return reloadAfterCommand(
          input,
          services,
          result.output,
          {
            selectedAgentId: result.agentId ?? normalizedInput.id,
            selectedSkillId: undefined
          }
        );
      }

      if (input.action.kind === "config-remove-agent") {
        const result = await services.runConfigRemoveAgent({
          homeDir: input.homeDir,
          skillmuxHome: input.skillmuxHome,
          ...input.action.input
        });

        return reloadAfterCommand(
          input,
          services,
          result.output,
          {
            selectedAgentId: null,
            selectedSkillId: undefined
          }
        );
      }

      if (input.action.kind === "import-skill") {
        const result = await services.runImport({
          homeDir: input.homeDir,
          skillmuxHome: input.skillmuxHome,
          ...input.action.input
        });

        return reloadAfterCommand(input, services, result.output);
      }

      const result = await services.runDoctor({
        homeDir: input.homeDir,
        skillmuxHome: input.skillmuxHome,
        platform: input.platform
      });

      return {
        model: input.model,
        statusMessage: stripTrailingNewlines(result.output),
        doctor: result
      };
    }

    if (input.action === "scan") {
      const result = await services.runScan({
        homeDir: input.homeDir,
        skillmuxHome: input.skillmuxHome,
        platform: input.platform
      });

      return reloadAfterCommand(input, services, result.output);
    }

    if (input.action === "adopt-all") {
      const selectedAgent = resolveSelectedAgent(input.model);

      if (selectedAgent === null) {
        return refusal(input.model, "Select an agent first");
      }

      if (selectedAgent.unmanagedCount <= 0) {
        return refusal(input.model, "No unmanaged skills to adopt for this agent");
      }

      const result = await services.runAdopt({
        homeDir: input.homeDir,
        skillmuxHome: input.skillmuxHome,
        agent: selectedAgent.id
      });

      return reloadAfterCommand(input, services, result.output);
    }

    const selectedSkill = resolveSelectedSkill(input.model);
    if (selectedSkill === null) {
      return refusal(input.model, "Select a skill first");
    }

    if (input.action === "toggle") {
      if (selectedSkill.kind === "enabled") {
        const result = await services.runDisable({
          homeDir: input.homeDir,
          skillmuxHome: input.skillmuxHome,
          skill: selectedSkill.skillId,
          agent: selectedSkill.agentId
        });

        return reloadAfterCommand(input, services, result.output);
      }

      if (selectedSkill.kind === "disabled") {
        const result = await services.runEnable({
          homeDir: input.homeDir,
          skillmuxHome: input.skillmuxHome,
          skill: selectedSkill.skillId,
          agent: selectedSkill.agentId
        });

        return reloadAfterCommand(input, services, result.output);
      }

      return refusal(input.model, "Toggle is only available for managed rows");
    }

    if (input.action === "adopt") {
      if (selectedSkill.kind !== "unmanaged") {
        return refusal(input.model, "Adopt is only available for unmanaged rows");
      }

      const result = await services.runAdopt({
        homeDir: input.homeDir,
        skillmuxHome: input.skillmuxHome,
        agent: selectedSkill.agentId,
        skill: selectedSkill.skillName
      });

      return reloadAfterCommand(input, services, result.output);
    }

    if (selectedSkill.kind === "enabled") {
      return refusal(input.model, "Disable this skill before removing it");
    }

    if (selectedSkill.kind !== "disabled") {
      return refusal(input.model, "Remove is only available for disabled rows");
    }

    const result = await services.runRemove({
      homeDir: input.homeDir,
      skillmuxHome: input.skillmuxHome,
      skill: selectedSkill.skillId
    });

    return reloadAfterCommand(input, services, result.output);
  } catch (error) {
    const label = isPendingCommand(input.action)
      ? commandLabel(input.action.kind)
      : actionLabel(input.action);

    return {
      model: input.model,
      statusMessage: `${label} failed: ${errorReason(error)}`,
      commandSucceeded: false
    };
  }
}

import { runAdopt as defaultRunAdopt } from "../commands/adopt";
import { runDisable as defaultRunDisable } from "../commands/disable";
import { runEnable as defaultRunEnable } from "../commands/enable";
import { runRemove as defaultRunRemove } from "../commands/remove";
import { runScan as defaultRunScan } from "../commands/scan";
import type { DashboardModel, TuiSkillRow } from "./dashboard-model";
import {
  loadDashboardState,
  type LoadDashboardStateOptions
} from "./load-dashboard-state";

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
  action: TuiAction;
  model: DashboardModel;
  homeDir?: string;
  skillmuxHome?: string;
  platform?: NodeJS.Platform;
  services?: Partial<TuiActionServices>;
};

export type DispatchTuiActionResult = {
  model: DashboardModel;
  statusMessage: string;
};

const defaultServices: TuiActionServices = {
  runEnable: defaultRunEnable,
  runDisable: defaultRunDisable,
  runAdopt: defaultRunAdopt,
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

function errorReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const firstLine = message.split(/\r?\n/u)[0]?.trim();

  return firstLine === undefined || firstLine.length === 0
    ? "Unknown error"
    : firstLine;
}

function reloadOptions(input: DispatchTuiActionInput): LoadDashboardStateOptions {
  return {
    homeDir: input.homeDir,
    skillmuxHome: input.skillmuxHome,
    platform: input.platform,
    selectedAgentId: input.model.selectedAgentId ?? undefined,
    selectedSkillId: input.model.selectedSkillId ?? undefined
  };
}

async function reloadAfterCommand(
  input: DispatchTuiActionInput,
  services: TuiActionServices,
  output: string
): Promise<DispatchTuiActionResult> {
  return {
    model: await services.reload(reloadOptions(input)),
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

export async function dispatchTuiAction(
  input: DispatchTuiActionInput
): Promise<DispatchTuiActionResult> {
  const services = { ...defaultServices, ...input.services };

  try {
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
    return {
      model: input.model,
      statusMessage: `${actionLabel(input.action)} failed: ${errorReason(error)}`
    };
  }
}

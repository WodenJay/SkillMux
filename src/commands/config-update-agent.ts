import { homedir } from "node:os";
import {
  normalizeAgentId,
  normalizePlatforms,
  normalizeRelativePath
} from "../config/agent-override-validation";
import { UserConfigValidationError } from "../core/errors";
import { loadUserConfig, type AgentOverride, type UserConfig } from "../config/load-user-config";
import { buildConfigPath, resolveSkillmuxHome } from "../config/resolve-skillmux-home";
import { writeUserConfig } from "../config/write-user-config";
import { printJson } from "../output/print-json";
import { printTable } from "../output/print-table";

export type RunConfigUpdateAgentOptions = {
  homeDir?: string;
  skillmuxHome?: string;
  id: string;
  root?: string;
  skills?: string;
  name?: string;
  platforms?: string[];
  enabledByDefault?: boolean;
  disabledByDefault?: boolean;
  json?: boolean;
};

export type RunConfigUpdateAgentResult = {
  skillmuxHome: string;
  configPath: string;
  agentId: string;
  changed: boolean;
  agent: AgentOverride;
  config: UserConfig;
  output: string;
};

function buildAgentPatch(options: RunConfigUpdateAgentOptions): AgentOverride {
  const patch: AgentOverride = {};

  if (options.root !== undefined) {
    patch.homeRelativeRootPath = normalizeRelativePath(options.root, "root");
  }

  if (options.skills !== undefined) {
    patch.skillsDirectoryPath = normalizeRelativePath(options.skills, "skills");
  }

  if (options.name !== undefined && options.name.trim().length > 0) {
    patch.stableName = options.name.trim();
  }

  if (options.platforms !== undefined) {
    patch.supportedPlatforms = normalizePlatforms(options.platforms);
  }

  if (options.enabledByDefault !== undefined && options.disabledByDefault === true) {
    throw new UserConfigValidationError(
      "enabled-by-default and disabled-by-default cannot both be set"
    );
  }

  if (options.enabledByDefault !== undefined) {
    patch.enabledByDefault = options.enabledByDefault;
  }

  if (options.disabledByDefault === true) {
    patch.enabledByDefault = false;
  }

  return patch;
}

function buildTableOutput(result: Omit<RunConfigUpdateAgentResult, "output">): string {
  const summary = printTable(
    [
      {
        agentId: result.agentId,
        configPath: result.configPath,
        changed: String(result.changed)
      }
    ],
    [
      { key: "agentId", label: "Agent" },
      { key: "configPath", label: "Config Path" },
      { key: "changed", label: "Changed" }
    ]
  );

  const detail = printTable(
    [
      {
        stableName: result.agent.stableName ?? "",
        platforms: (result.agent.supportedPlatforms ?? []).join(","),
        root: result.agent.homeRelativeRootPath ?? "",
        skills: result.agent.skillsDirectoryPath ?? "",
        enabledByDefault:
          result.agent.enabledByDefault === undefined
            ? ""
            : String(result.agent.enabledByDefault)
      }
    ],
    [
      { key: "stableName", label: "Name" },
      { key: "platforms", label: "Platforms" },
      { key: "root", label: "Root" },
      { key: "skills", label: "Skills Dir" },
      { key: "enabledByDefault", label: "Enabled By Default" }
    ]
  );

  return `${summary}${detail}`;
}

export async function runConfigUpdateAgent(
  options: RunConfigUpdateAgentOptions
): Promise<RunConfigUpdateAgentResult> {
  const homeDir = options.homeDir ?? homedir();
  const resolvedPaths = resolveSkillmuxHome(homeDir);
  const skillmuxHome = options.skillmuxHome ?? resolvedPaths.skillmuxHome;
  const configPath = buildConfigPath(skillmuxHome);
  const config = await loadUserConfig(skillmuxHome);
  const agentId = normalizeAgentId(options.id);
  const previous = config.agents[agentId];

  if (previous === undefined) {
    throw new UserConfigValidationError(`Agent override does not exist: ${agentId}`);
  }

  const agent: AgentOverride = {
    ...previous,
    ...buildAgentPatch(options)
  };

  if (previous.autoDiscovered === true) {
    delete agent.autoDiscovered;
  }

  const changed = JSON.stringify(previous) !== JSON.stringify(agent);

  const nextConfig: UserConfig = {
    ...config,
    agents: {
      ...config.agents,
      [agentId]: agent
    }
  };

  if (changed) {
    await writeUserConfig(skillmuxHome, nextConfig);
  }

  const resultWithoutOutput = {
    skillmuxHome,
    configPath,
    agentId,
    changed,
    agent,
    config: nextConfig
  };

  return {
    ...resultWithoutOutput,
    output:
      options.json === true
        ? printJson(resultWithoutOutput)
        : buildTableOutput(resultWithoutOutput)
  };
}

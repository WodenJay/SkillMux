import { homedir } from "node:os";
import { InvalidIdentifierError } from "../core/errors";
import { normalizeId } from "../core/ids";
import { loadUserConfig, type UserConfig } from "../config/load-user-config";
import { buildConfigPath, resolveSkillmuxHome } from "../config/resolve-skillmux-home";
import { writeUserConfig } from "../config/write-user-config";
import { printJson } from "../output/print-json";
import { printTable } from "../output/print-table";

export type RunConfigRemoveAgentOptions = {
  homeDir?: string;
  skillmuxHome?: string;
  id: string;
  json?: boolean;
};

export type RunConfigRemoveAgentResult = {
  skillmuxHome: string;
  configPath: string;
  agentId: string;
  changed: boolean;
  removed: boolean;
  config: UserConfig;
  output: string;
};

function normalizeAgentId(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0 || /[a-z0-9]/i.test(trimmed) === false) {
    throw new InvalidIdentifierError("agent id", value);
  }

  return normalizeId(trimmed);
}

function buildTableOutput(result: Omit<RunConfigRemoveAgentResult, "output">): string {
  return printTable(
    [
      {
        agentId: result.agentId,
        configPath: result.configPath,
        changed: String(result.changed),
        removed: String(result.removed)
      }
    ],
    [
      { key: "agentId", label: "Agent" },
      { key: "configPath", label: "Config Path" },
      { key: "changed", label: "Changed" },
      { key: "removed", label: "Removed" }
    ]
  );
}

export async function runConfigRemoveAgent(
  options: RunConfigRemoveAgentOptions
): Promise<RunConfigRemoveAgentResult> {
  const homeDir = options.homeDir ?? homedir();
  const resolvedPaths = resolveSkillmuxHome(homeDir);
  const skillmuxHome = options.skillmuxHome ?? resolvedPaths.skillmuxHome;
  const configPath = buildConfigPath(skillmuxHome);
  const config = await loadUserConfig(skillmuxHome);
  const agentId = normalizeAgentId(options.id);
  const removed = agentId in config.agents;

  const removedOverride = config.agents[agentId];
  const wasAutoDiscovered = removedOverride?.autoDiscovered === true;

  const removedAutoAgentIds = wasAutoDiscovered
    ? [...(config.removedAutoAgentIds ?? []), agentId]
    : config.removedAutoAgentIds;

  const nextConfig: UserConfig = {
    ...config,
    agents: Object.fromEntries(
      Object.entries(config.agents).filter(([currentAgentId]) => currentAgentId !== agentId)
    ),
    ...(wasAutoDiscovered ? { removedAutoAgentIds } : {})
  };

  if (removed) {
    await writeUserConfig(skillmuxHome, nextConfig);
  }

  const resultWithoutOutput = {
    skillmuxHome,
    configPath,
    agentId,
    changed: removed,
    removed,
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

import { homedir } from "node:os";
import { loadUserConfig, type UserConfig } from "../config/load-user-config";
import { resolveSkillmuxHome } from "../config/resolve-skillmux-home";
import { printJson } from "../output/print-json";
import { printTable } from "../output/print-table";

export type RunConfigOptions = {
  homeDir?: string;
  skillmuxHome?: string;
  json?: boolean;
};

export type RunConfigResult = {
  skillmuxHome: string;
  configPath: string;
  config: UserConfig;
  output: string;
};

function buildTableOutput(result: Omit<RunConfigResult, "output">): string {
  const summary = printTable(
    [
      {
        skillmuxHome: result.skillmuxHome,
        configPath: result.configPath,
        overrides: String(Object.keys(result.config.agents).length)
      }
    ],
    [
      { key: "skillmuxHome", label: "SkillMux Home" },
      { key: "configPath", label: "Config Path" },
      { key: "overrides", label: "Overrides" }
    ]
  );

  const agentRows = Object.entries(result.config.agents)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([agentId, agent]) => ({
      agentId,
      stableName: agent.stableName ?? "",
      root: agent.homeRelativeRootPath ?? "",
      skills: agent.skillsDirectoryPath ?? ""
    }));

  if (agentRows.length === 0) {
    return `${summary}\nNo user overrides configured.\n`;
  }

  return `${summary}\n${printTable(agentRows, [
    { key: "agentId", label: "Agent" },
    { key: "stableName", label: "Name" },
    { key: "root", label: "Root" },
    { key: "skills", label: "Skills Dir" }
  ])}`;
}

export async function runConfig(
  options: RunConfigOptions = {}
): Promise<RunConfigResult> {
  const homeDir = options.homeDir ?? homedir();
  const resolvedPaths = resolveSkillmuxHome(homeDir);
  const skillmuxHome = options.skillmuxHome ?? resolvedPaths.skillmuxHome;
  const config = await loadUserConfig(skillmuxHome);

  const resultWithoutOutput = {
    skillmuxHome,
    configPath: resolvedPaths.configPath,
    config
  };

  return {
    ...resultWithoutOutput,
    output:
      options.json === true
        ? printJson(resultWithoutOutput)
        : buildTableOutput(resultWithoutOutput)
  };
}

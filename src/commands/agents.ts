import { homedir } from "node:os";
import { resolveSkillmuxHome } from "../config/resolve-skillmux-home";
import {
  discoverAgents,
  type DiscoveredAgent
} from "../discovery/discover-agents";
import { printJson } from "../output/print-json";
import { printTable } from "../output/print-table";

export type RunAgentsOptions = {
  homeDir?: string;
  skillmuxHome?: string;
  platform?: NodeJS.Platform;
  json?: boolean;
};

export type RunAgentsResult = {
  agents: DiscoveredAgent[];
  output: string;
};

function buildTableOutput(agents: DiscoveredAgent[]): string {
  return printTable(
    agents.map((agent) => ({
      id: agent.id,
      name: agent.stableName,
      path: agent.absoluteSkillsDirectoryPath,
      exists: String(agent.exists),
      supported: String(agent.supportedOnPlatform),
      discovery: agent.discovery
    })),
    [
      { key: "id", label: "Agent" },
      { key: "name", label: "Name" },
      { key: "path", label: "Path" },
      { key: "exists", label: "Exists" },
      { key: "supported", label: "Supported" },
      { key: "discovery", label: "Discovery" }
    ]
  );
}

export async function runAgents(
  options: RunAgentsOptions = {}
): Promise<RunAgentsResult> {
  const homeDir = options.homeDir ?? homedir();
  const resolvedPaths = resolveSkillmuxHome(homeDir);
  const skillmuxHome = options.skillmuxHome ?? resolvedPaths.skillmuxHome;
  const agents = await discoverAgents({
    homeDir,
    skillmuxHome,
    platform: options.platform
  });

  return {
    agents,
    output:
      options.json === true
        ? printJson(agents)
        : buildTableOutput(agents)
  };
}

import { homedir } from "node:os";
import { isAbsolute } from "node:path";
import { InvalidIdentifierError, UserConfigValidationError } from "../core/errors";
import { normalizeId } from "../core/ids";
import { supportedPlatforms, type SupportedPlatform } from "../config/default-agent-rules";
import { loadUserConfig, type AgentOverride, type UserConfig } from "../config/load-user-config";
import { buildConfigPath, resolveSkillmuxHome } from "../config/resolve-skillmux-home";
import { writeUserConfig } from "../config/write-user-config";
import { printJson } from "../output/print-json";
import { printTable } from "../output/print-table";

export type RunConfigAddAgentOptions = {
  homeDir?: string;
  skillmuxHome?: string;
  id: string;
  root: string;
  skills?: string;
  name?: string;
  platforms?: string[];
  disabledByDefault?: boolean;
  json?: boolean;
};

export type RunConfigAddAgentResult = {
  skillmuxHome: string;
  configPath: string;
  agentId: string;
  changed: boolean;
  agent: AgentOverride;
  config: UserConfig;
  output: string;
};

function normalizeRelativePath(value: string, field: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new UserConfigValidationError(`${field} must not be empty`);
  }

  if (isAbsolute(trimmed)) {
    throw new UserConfigValidationError(`${field} must be a relative path`);
  }

  const normalized = trimmed.replaceAll("\\", "/");

  if (normalized === "." || normalized === ".." || normalized.startsWith("../") || normalized.includes("/../")) {
    throw new UserConfigValidationError(`${field} must stay within the configured home-relative tree`);
  }

  return normalized.replace(/^\.\/+/, "");
}

function normalizeAgentId(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0 || /[a-z0-9]/i.test(trimmed) === false) {
    throw new InvalidIdentifierError("agent id", value);
  }

  return normalizeId(trimmed);
}

function normalizePlatforms(value: string[] | undefined): SupportedPlatform[] {
  if (value === undefined || value.length === 0) {
    return [process.platform as SupportedPlatform];
  }

  const normalized = [...new Set(value.map((entry) => entry.trim().toLowerCase()))];
  const invalid = normalized.filter(
    (entry): entry is string => supportedPlatforms.includes(entry as SupportedPlatform) === false
  );

  if (invalid.length > 0) {
    throw new UserConfigValidationError(
      `platform must be one of: ${supportedPlatforms.join(", ")}`
    );
  }

  return normalized as SupportedPlatform[];
}

function buildAgentOverride(options: RunConfigAddAgentOptions): {
  agentId: string;
  agent: AgentOverride;
} {
  const agentId = normalizeAgentId(options.id);
  const agent: AgentOverride = {
    supportedPlatforms: normalizePlatforms(options.platforms),
    homeRelativeRootPath: normalizeRelativePath(options.root, "root"),
    skillsDirectoryPath: normalizeRelativePath(options.skills ?? "skills", "skills")
  };

  if (options.name !== undefined && options.name.trim().length > 0) {
    agent.stableName = options.name.trim();
  }

  if (options.disabledByDefault === true) {
    agent.enabledByDefault = false;
  }

  return { agentId, agent };
}

function buildTableOutput(result: Omit<RunConfigAddAgentResult, "output">): string {
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

export async function runConfigAddAgent(
  options: RunConfigAddAgentOptions
): Promise<RunConfigAddAgentResult> {
  const homeDir = options.homeDir ?? homedir();
  const resolvedPaths = resolveSkillmuxHome(homeDir);
  const skillmuxHome = options.skillmuxHome ?? resolvedPaths.skillmuxHome;
  const configPath = buildConfigPath(skillmuxHome);
  const config = await loadUserConfig(skillmuxHome);
  const { agentId, agent } = buildAgentOverride(options);
  const previous = config.agents[agentId];
  const changed = JSON.stringify(previous ?? null) !== JSON.stringify(agent);

  const nextConfig: UserConfig = {
    ...config,
    agents: {
      ...config.agents,
      [agentId]: agent
    }
  };

  await writeUserConfig(skillmuxHome, nextConfig);

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

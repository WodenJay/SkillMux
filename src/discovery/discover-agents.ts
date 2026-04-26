import * as fs from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  builtInAgentIds,
  defaultAgentRuleMap,
  supportedPlatforms,
  type AgentRule,
  type BuiltInAgentId,
  type SupportedPlatform
} from "../config/default-agent-rules";
import { autoRegisterNewAgents } from "../config/auto-register-agents";
import { loadUserConfig, type AgentOverride } from "../config/load-user-config";
import { resolveSkillmuxHome } from "../config/resolve-skillmux-home";

export type DiscoveredAgent = AgentRule & {
  absoluteRootPath: string;
  absoluteSkillsDirectoryPath: string;
  exists: boolean;
  supportedOnPlatform: boolean;
  autoDiscovered?: boolean;
};

export type DiscoverAgentsOptions = {
  homeDir: string;
  platform?: NodeJS.Platform;
  skillmuxHome?: string;
};

function mergeRule(rule: AgentRule, override?: AgentOverride): AgentRule {
  if (override === undefined) {
    return rule;
  }

  return {
    ...rule,
    ...override
  };
}

function buildCustomRule(id: string, override: AgentOverride): AgentRule {
  if (
    override.homeRelativeRootPath === undefined ||
    override.skillsDirectoryPath === undefined
  ) {
    throw new Error(
      `Custom agent override "${id}" must define homeRelativeRootPath and skillsDirectoryPath`
    );
  }

  return {
    id,
    stableName: override.stableName ?? id,
    supportedPlatforms: override.supportedPlatforms ?? [...supportedPlatforms],
    homeRelativeRootPath: override.homeRelativeRootPath,
    skillsDirectoryPath: override.skillsDirectoryPath,
    enabledByDefault: override.enabledByDefault ?? true,
    discovery: "custom"
  };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

function resolveAgentRulePaths(homeDir: string, rule: AgentRule): {
  absoluteRootPath: string;
  absoluteSkillsDirectoryPath: string;
} {
  const absoluteRootPath = resolve(homeDir, rule.homeRelativeRootPath);

  return {
    absoluteRootPath,
    absoluteSkillsDirectoryPath: join(
      absoluteRootPath,
      rule.skillsDirectoryPath
    )
  };
}

export async function discoverAgents(
  options: DiscoverAgentsOptions
): Promise<DiscoveredAgent[]> {
  const platform = options.platform ?? process.platform;
  const homeDir = resolve(options.homeDir);
  const skillmuxHome =
    options.skillmuxHome ?? resolveSkillmuxHome(homeDir).skillmuxHome;
  await autoRegisterNewAgents(homeDir);
  const userConfig = await loadUserConfig(skillmuxHome);

  const discoveredAgents: DiscoveredAgent[] = [];

  for (const agentId of builtInAgentIds) {
    const mergedRule = mergeRule(
      defaultAgentRuleMap[agentId as BuiltInAgentId],
      userConfig.agents[agentId]
    );
    const resolvedPaths = resolveAgentRulePaths(homeDir, mergedRule);

    discoveredAgents.push({
      ...mergedRule,
      ...resolvedPaths,
      exists: await pathExists(resolvedPaths.absoluteSkillsDirectoryPath),
      supportedOnPlatform: mergedRule.supportedPlatforms.some(
        (supportedPlatform) => supportedPlatform === platform
      )
    });
  }

  for (const [agentId, override] of Object.entries(userConfig.agents)) {
    if (Object.hasOwn(defaultAgentRuleMap, agentId)) {
      continue;
    }

    const customRule = buildCustomRule(agentId, override);
    const resolvedPaths = resolveAgentRulePaths(homeDir, customRule);

    discoveredAgents.push({
      ...customRule,
      ...resolvedPaths,
      exists: await pathExists(resolvedPaths.absoluteSkillsDirectoryPath),
      supportedOnPlatform: customRule.supportedPlatforms.some(
        (supportedPlatform) => supportedPlatform === platform
      ),
      autoDiscovered: override.autoDiscovered === true || undefined
    });
  }

  return discoveredAgents;
}

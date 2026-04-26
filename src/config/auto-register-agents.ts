import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  builtInAgentIds,
  type BuiltInAgentId
} from "./default-agent-rules";
import {
  loadUserConfig,
  type AgentOverride,
  type UserConfig
} from "./load-user-config";
import { resolveSkillmuxHome } from "./resolve-skillmux-home";
import { writeUserConfig } from "./write-user-config";

function isDotDir(name: string): boolean {
  return name.startsWith(".");
}

function isValidAgentId(name: string): boolean {
  if (name.length < 2) return false;
  const stem = name.slice(1);
  return /^[a-z][a-z0-9-]*$/u.test(stem);
}

function dirExists(dirPath: string): boolean {
  try {
    return statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

function isBuiltInAgentId(id: string): id is BuiltInAgentId {
  return (builtInAgentIds as readonly string[]).includes(id);
}

function makeAutoDiscoveredOverride(dirName: string): AgentOverride {
  const stem = dirName.slice(1);
  return {
    stableName: stem.charAt(0).toUpperCase() + stem.slice(1),
    supportedPlatforms: ["win32", "linux", "darwin"],
    homeRelativeRootPath: dirName,
    skillsDirectoryPath: "skills",
    enabledByDefault: true,
    autoDiscovered: true
  };
}

export async function autoRegisterNewAgents(
  homeDir?: string
): Promise<void> {
  const resolvedHomeDir = homeDir ?? homedir();
  const { skillmuxHome } = resolveSkillmuxHome(resolvedHomeDir);
  const config = await loadUserConfig(skillmuxHome);

  const autoDiscover = config.autoDiscover ?? {
    lastRunAt: null,
    intervalMs: 3600000
  };

  if (autoDiscover.lastRunAt !== null && autoDiscover.intervalMs > 0) {
    const elapsed = Date.now() - new Date(autoDiscover.lastRunAt).getTime();
    if (elapsed < autoDiscover.intervalMs) {
      return;
    }
  }

  const wellKnownNonAgentDirs = new Set([".skillmux"]);

  const removedIds = new Set(config.removedAutoAgentIds ?? []);
  let changed = false;

  let entries: string[];
  try {
    entries = readdirSync(resolvedHomeDir);
  } catch {
    return;
  }

  const nextAgents: Record<string, AgentOverride> = { ...config.agents };

  for (const name of entries) {
    if (!isDotDir(name)) continue;
    if (wellKnownNonAgentDirs.has(name)) continue;
    if (!isValidAgentId(name)) continue;

    const agentId = name.slice(1).toLowerCase().replace(/[^a-z0-9]+/g, "-");

    if (agentId in nextAgents) continue;
    if (isBuiltInAgentId(agentId)) continue;
    if (removedIds.has(agentId)) continue;

    const skillsDir = join(resolvedHomeDir, name, "skills");
    if (!dirExists(skillsDir)) continue;

    nextAgents[agentId] = makeAutoDiscoveredOverride(name);
    changed = true;
  }

  if (!changed && autoDiscover.lastRunAt !== null) {
    return;
  }

  const nextConfig: UserConfig = {
    ...config,
    agents: nextAgents,
    autoDiscover: {
      ...autoDiscover,
      lastRunAt: new Date().toISOString()
    },
    removedAutoAgentIds: [...removedIds]
  };

  await writeUserConfig(skillmuxHome, nextConfig);
}

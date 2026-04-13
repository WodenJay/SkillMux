import * as fs from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type {
  ActivationRecord,
  AgentRecord,
  ManagedSkill,
  Manifest
} from "../core/types";
import { normalizeId } from "../core/ids";
import { resolveSkillmuxHome } from "../config/resolve-skillmux-home";
import {
  discoverAgents,
  type DiscoveredAgent
} from "../discovery/discover-agents";
import {
  assertSkillSourceLayout,
  copySkillContentsToManagedStore
} from "../fs/safe-copy";
import { isLinkPointingToTarget } from "../fs/link-ops";
import { safeRemoveLink } from "../fs/safe-remove-link";
import { readManifest } from "../manifest/read-manifest";
import { writeManifest } from "../manifest/write-manifest";

export type RunDisableOptions = {
  homeDir?: string;
  skillmuxHome?: string;
  skill: string;
  agent: string;
  now?: Date;
};

export type RunDisableResult = {
  changed: boolean;
  skill: ManagedSkill;
  agent: AgentRecord;
  activation: ActivationRecord | null;
  manifest: Manifest;
  output: string;
};

function buildAgentRecord(agent: DiscoveredAgent, timestamp: string): AgentRecord {
  return {
    id: agent.id,
    name: agent.stableName,
    path: agent.absoluteSkillsDirectoryPath,
    discovery: agent.discovery,
    available: agent.exists && agent.supportedOnPlatform,
    lastSeenAt: agent.exists ? timestamp : null
  };
}

function buildActivationRecord(
  skillId: string,
  agentId: string,
  linkPath: string,
  timestamp: string
): ActivationRecord {
  return {
    skillId,
    agentId,
    linkPath,
    state: "disabled",
    updatedAt: timestamp
  };
}

function upsertActivation(
  manifest: Manifest,
  activation: ActivationRecord
): void {
  const index = manifest.activations.findIndex(
    (entry) =>
      entry.skillId === activation.skillId && entry.agentId === activation.agentId
  );

  if (index === -1) {
    manifest.activations.push(activation);
    return;
  }

  manifest.activations[index] = activation;
}

function buildManagedSkillPath(skillmuxHome: string, skillId: string): string {
  return resolve(skillmuxHome, "skills", skillId);
}

async function tryAdoptManagedSkill(
  manifest: Manifest,
  skillmuxHome: string,
  skillId: string,
  skillName: string,
  linkPath: string,
  timestamp: string
): Promise<{ skill: ManagedSkill; sourcePath: string } | undefined> {
  try {
    const entry = await fs.lstat(linkPath);

    if (!entry.isSymbolicLink()) {
      return undefined;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw error;
  }

  const sourcePath = await fs.realpath(linkPath);
  await assertSkillSourceLayout(sourcePath);

  const managedSkillPath = buildManagedSkillPath(skillmuxHome, skillId);
  await copySkillContentsToManagedStore(sourcePath, managedSkillPath);

  const skill: ManagedSkill = {
    id: skillId,
    name: skillName,
    path: managedSkillPath,
    source: {
      kind: "imported",
      path: sourcePath
    },
    importedAt: timestamp
  };

  manifest.skills[skillId] = skill;
  return { skill, sourcePath };
}

async function resolveTargetAgent(
  homeDir: string,
  skillmuxHome: string,
  agentName: string
): Promise<DiscoveredAgent> {
  const agentId = normalizeId(agentName);
  const agents = await discoverAgents({ homeDir, skillmuxHome });
  const agent = agents.find((entry) => entry.id === agentId);

  if (agent === undefined) {
    throw new Error(`Unknown agent: ${agentName}`);
  }

  if (!agent.supportedOnPlatform) {
    throw new Error(`Agent ${agent.id} is not supported on ${process.platform}`);
  }

  return agent;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.lstat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

export async function runDisable(
  options: RunDisableOptions
): Promise<RunDisableResult> {
  const homeDir = options.homeDir ?? homedir();
  const { skillmuxHome: defaultSkillmuxHome } = resolveSkillmuxHome(homeDir);
  const skillmuxHome = options.skillmuxHome ?? defaultSkillmuxHome;
  const timestamp = (options.now ?? new Date()).toISOString();
  const manifest = await readManifest(skillmuxHome);
  const skillId = normalizeId(options.skill);
  const agent = await resolveTargetAgent(homeDir, skillmuxHome, options.agent);
  const linkPath = join(agent.absoluteSkillsDirectoryPath, skillId);
  const adoption = manifest.skills[skillId]
    ? undefined
    : await tryAdoptManagedSkill(
        manifest,
        skillmuxHome,
        skillId,
        options.skill,
        linkPath,
        timestamp
      );
  const skill = manifest.skills[skillId] ?? adoption?.skill;

  if (skill === undefined) {
    throw new Error(`Managed skill not found: ${skillId}`);
  }

  const currentActivation = manifest.activations.find(
    (entry) => entry.skillId === skill.id && entry.agentId === agent.id
  );
  const activationLinkPath = currentActivation?.linkPath ?? linkPath;
  const agentRecord = buildAgentRecord(agent, timestamp);
  manifest.agents[agent.id] = agentRecord;

  const adoptedLinkRemoved =
    adoption !== undefined ? await safeRemoveLink(linkPath) : false;

  const linkMatchesSkill = adoption === undefined
    ? await isLinkPointingToTarget(activationLinkPath, skill.path)
    : false;
  if (
    adoption === undefined &&
    !linkMatchesSkill &&
    (await pathExists(activationLinkPath))
  ) {
    throw new Error(`Refusing to disable non-managed entry at ${linkPath}`);
  }

  const removedLink = adoptedLinkRemoved
    ? true
    : linkMatchesSkill
      ? await safeRemoveLink(activationLinkPath)
      : false;

  if (removedLink === false && currentActivation?.state !== "enabled") {
    return {
      changed: false,
      skill,
      agent: agentRecord,
      activation: currentActivation ?? null,
      manifest,
      output: `${skill.id} is already disabled for ${agent.id}\n`
    };
  }

  const activation = buildActivationRecord(skill.id, agent.id, linkPath, timestamp);
  upsertActivation(manifest, activation);
  await writeManifest(skillmuxHome, manifest);

  return {
    changed: true,
    skill,
    agent: agentRecord,
    activation,
    manifest,
    output: `Disabled ${skill.id} for ${agent.id}\n`
  };
}

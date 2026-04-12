import * as fs from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
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
import { createManagedLink, isLinkPointingToTarget } from "../fs/link-ops";
import { readManifest } from "../manifest/read-manifest";
import { writeManifest } from "../manifest/write-manifest";

export type RunEnableOptions = {
  homeDir?: string;
  skillmuxHome?: string;
  skill: string;
  agent: string;
  now?: Date;
};

export type RunEnableResult = {
  changed: boolean;
  skill: ManagedSkill;
  agent: AgentRecord;
  activation: ActivationRecord;
  manifest: Manifest;
  output: string;
};

function buildAgentRecord(agent: DiscoveredAgent, timestamp: string): AgentRecord {
  return {
    id: agent.id,
    name: agent.stableName,
    path: agent.absoluteSkillsDirectoryPath,
    discovery: agent.discovery,
    available: agent.supportedOnPlatform,
    lastSeenAt: timestamp
  };
}

function buildActivationRecord(
  skillId: string,
  agentId: string,
  linkPath: string,
  timestamp: string,
  state: "enabled" | "disabled"
): ActivationRecord {
  return {
    skillId,
    agentId,
    linkPath,
    state,
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

export async function runEnable(
  options: RunEnableOptions
): Promise<RunEnableResult> {
  const homeDir = options.homeDir ?? homedir();
  const { skillmuxHome: defaultSkillmuxHome } = resolveSkillmuxHome(homeDir);
  const skillmuxHome = options.skillmuxHome ?? defaultSkillmuxHome;
  const timestamp = (options.now ?? new Date()).toISOString();
  const manifest = await readManifest(skillmuxHome);
  const skillId = normalizeId(options.skill);
  const skill = manifest.skills[skillId];

  if (skill === undefined) {
    throw new Error(`Managed skill not found: ${skillId}`);
  }

  const agent = await resolveTargetAgent(homeDir, skillmuxHome, options.agent);
  const linkPath = join(agent.absoluteSkillsDirectoryPath, skill.id);
  const currentActivation = manifest.activations.find(
    (entry) => entry.skillId === skill.id && entry.agentId === agent.id
  );
  const agentRecord = buildAgentRecord(agent, timestamp);

  manifest.agents[agent.id] = agentRecord;
  await fs.mkdir(agent.absoluteSkillsDirectoryPath, { recursive: true });

  const linkAlreadyEnabled = await isLinkPointingToTarget(linkPath, skill.path);
  const activationAlreadyEnabled =
    currentActivation?.state === "enabled" && currentActivation.linkPath === linkPath;

  if (linkAlreadyEnabled && activationAlreadyEnabled) {
    return {
      changed: false,
      skill,
      agent: agentRecord,
      activation: currentActivation,
      manifest,
      output: `${skill.id} is already enabled for ${agent.id}\n`
    };
  }

  await createManagedLink(linkPath, skill.path);

  const activation = buildActivationRecord(
    skill.id,
    agent.id,
    linkPath,
    timestamp,
    "enabled"
  );
  upsertActivation(manifest, activation);
  await writeManifest(skillmuxHome, manifest);

  return {
    changed: true,
    skill,
    agent: agentRecord,
    activation,
    manifest,
    output: `Enabled ${skill.id} for ${agent.id}\n`
  };
}

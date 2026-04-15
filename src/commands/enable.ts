import * as fs from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
  ActivationRecord,
  AgentRecord,
  ManagedSkill,
  Manifest
} from "../core/types";
import { BatchOperationError } from "../core/batch-operation-error";
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
  agent?: string;
  agents?: string[];
  now?: Date;
};

export type RunEnableSingleResult = {
  changed: boolean;
  skill: ManagedSkill;
  agent: AgentRecord;
  activation: ActivationRecord;
  manifest: Manifest;
  output: string;
};

export type RunEnableBatchResult = {
  changed: boolean;
  skill: ManagedSkill;
  results: RunEnableSingleResult[];
  changedAgents: string[];
  manifest: Manifest;
  output: string;
};

export type RunEnableResult = RunEnableSingleResult | RunEnableBatchResult;

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

async function runEnableSingle(
  options: RunEnableOptions
): Promise<RunEnableSingleResult> {
  if (options.agent === undefined) {
    throw new Error("Enable requires one target agent");
  }

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

export async function runEnable(
  options: RunEnableOptions & { agents: string[] }
): Promise<RunEnableBatchResult>;
export async function runEnable(
  options: RunEnableOptions & { agent: string }
): Promise<RunEnableSingleResult>;
export async function runEnable(
  options: RunEnableOptions
): Promise<RunEnableResult> {
  if (options.agents !== undefined) {
    const results: RunEnableSingleResult[] = [];

    for (const agent of options.agents) {
      try {
        results.push(await runEnableSingle({ ...options, agent, agents: undefined }));
      } catch (error) {
        throw new BatchOperationError({
          operation: "enable",
          failedItem: agent,
          failedAction: `enable ${options.skill} for ${agent}`,
          completedAction: "enabling",
          completedItems: results.map((result) => result.agent.id),
          cause: error
        });
      }
    }

    if (results.length === 0) {
      throw new Error("Enable requires at least one target agent");
    }

    const lastResult = results[results.length - 1] as RunEnableSingleResult;
    return {
      changed: results.some((result) => result.changed),
      skill: lastResult.skill,
      results,
      changedAgents: results
        .filter((result) => result.changed)
        .map((result) => result.agent.id),
      manifest: lastResult.manifest,
      output: results.map((result) => result.output).join("")
    };
  }

  return runEnableSingle(options);
}

import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type {
  ActivationRecord,
  AgentRecord,
  ManagedSkill,
  Manifest
} from "../core/types";
import { AdoptionError } from "../core/errors";
import { normalizeId } from "../core/ids";
import { resolveSkillmuxHome } from "../config/resolve-skillmux-home";
import {
  discoverAgents,
  type DiscoveredAgent
} from "../discovery/discover-agents";
import {
  scanAgentSkills,
  type ScanAgentSkillsResult
} from "../discovery/scan-agent-skills";
import type { ScannedSkillEntry } from "../discovery/infer-skill-entry";
import {
  assertSkillSourceLayout,
  copySkillContentsToManagedStore,
  hasRootSkillFile
} from "../fs/safe-copy";
import {
  isLinkPointingToTarget,
  replaceEntryWithManagedLink
} from "../fs/link-ops";
import { pathsAreEqual } from "../fs/path-utils";
import { readManifest } from "../manifest/read-manifest";
import { writeManifest } from "../manifest/write-manifest";
import { printJson } from "../output/print-json";

export type AdoptSkippedReason =
  | "already-managed"
  | "missing-skill-file"
  | "not-adoptable";

export type AdoptedSkill = {
  skillId: string;
  agentId: string;
  sourcePath: string;
  managedPath: string;
  linkPath: string;
};

export type SkippedAdoption = {
  skillId: string;
  agentId: string;
  path: string;
  reason: AdoptSkippedReason;
};

export type RunAdoptOptions = {
  homeDir?: string;
  skillmuxHome?: string;
  agent: string;
  skill?: string;
  now?: Date;
  json?: boolean;
};

export type RunAdoptResult = {
  agent: AgentRecord;
  adopted: AdoptedSkill[];
  skipped: SkippedAdoption[];
  manifest: Manifest;
  output: string;
};

function buildManagedSkillPath(skillmuxHome: string, skillId: string): string {
  return resolve(skillmuxHome, "skills", skillId);
}

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
    state: "enabled",
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
    throw new AdoptionError(`Unknown agent: ${agentName}`);
  }

  if (!agent.supportedOnPlatform) {
    throw new AdoptionError(
      `Agent ${agent.id} is not supported on ${process.platform}`
    );
  }

  return agent;
}

function filterEntries(
  scannedAgent: ScanAgentSkillsResult,
  skillFilter?: string
): ScannedSkillEntry[] {
  if (skillFilter === undefined) {
    return scannedAgent.entries;
  }

  const skillId = normalizeId(skillFilter);
  return scannedAgent.entries.filter(
    (entry) => normalizeId(entry.skillName) === skillId
  );
}

async function resolveAdoptionSource(
  entry: ScannedSkillEntry
): Promise<string | undefined> {
  if (entry.kind === "unmanaged-link") {
    return entry.targetPath;
  }

  if (entry.kind === "unmanaged-directory") {
    return entry.path;
  }

  return undefined;
}

function buildManagedSkill(
  skillId: string,
  skillName: string,
  managedPath: string,
  sourcePath: string,
  timestamp: string
): ManagedSkill {
  return {
    id: skillId,
    name: skillName,
    path: managedPath,
    source: {
      kind: "imported",
      path: sourcePath
    },
    importedAt: timestamp
  };
}

async function reconcileManagedLink(
  manifest: Manifest,
  skillId: string,
  entry: ScannedSkillEntry,
  agentId: string,
  timestamp: string
): Promise<void> {
  if (entry.targetPath === undefined) {
    throw new AdoptionError(`Managed link target is missing for ${entry.path}`);
  }

  await assertSkillSourceLayout(entry.targetPath);

  const skill = manifest.skills[skillId];
  if (skill === undefined || !pathsAreEqual(skill.path, entry.targetPath)) {
    throw new AdoptionError(
      `Managed link for ${agentId}/${skillId} has no matching manifest skill record`
    );
  }

  upsertActivation(
    manifest,
    buildActivationRecord(skillId, agentId, entry.path, timestamp)
  );
}

function buildOutput(result: Omit<RunAdoptResult, "output">, json: boolean): string {
  if (json) {
    return printJson({
      agent: result.agent,
      adopted: result.adopted,
      skipped: result.skipped
    });
  }

  if (result.adopted.length === 0) {
    return `No skills adopted for ${result.agent.id}.\n`;
  }

  const adoptedSkills = result.adopted
    .map((entry) => entry.skillId)
    .sort((left, right) => left.localeCompare(right))
    .join(", ");
  return `Adopted ${adoptedSkills} for ${result.agent.id}\n`;
}

export async function runAdopt(
  options: RunAdoptOptions
): Promise<RunAdoptResult> {
  const homeDir = options.homeDir ?? homedir();
  const { skillmuxHome: defaultSkillmuxHome } = resolveSkillmuxHome(homeDir);
  const skillmuxHome = options.skillmuxHome ?? defaultSkillmuxHome;
  const timestamp = (options.now ?? new Date()).toISOString();
  const manifest = await readManifest(skillmuxHome);
  const agent = await resolveTargetAgent(homeDir, skillmuxHome, options.agent);
  const agentRecord = buildAgentRecord(agent, timestamp);
  const scannedAgent = await scanAgentSkills(agent, skillmuxHome);
  const entries = filterEntries(scannedAgent, options.skill);
  const adopted: AdoptedSkill[] = [];
  const skipped: SkippedAdoption[] = [];

  manifest.agents[agent.id] = agentRecord;

  for (const entry of entries) {
    const skillId = normalizeId(entry.skillName);

    if (entry.kind === "managed-link") {
      await reconcileManagedLink(
        manifest,
        skillId,
        entry,
        agent.id,
        timestamp
      );
      skipped.push({
        skillId,
        agentId: agent.id,
        path: entry.path,
        reason: "already-managed"
      });
      await writeManifest(skillmuxHome, manifest);
      continue;
    }

    const sourcePath = await resolveAdoptionSource(entry);
    if (sourcePath === undefined) {
      skipped.push({
        skillId,
        agentId: agent.id,
        path: entry.path,
        reason: "not-adoptable"
      });
      continue;
    }

    if (!(await hasRootSkillFile(sourcePath))) {
      skipped.push({
        skillId,
        agentId: agent.id,
        path: entry.path,
        reason: "missing-skill-file"
      });
      continue;
    }

    const managedPath = buildManagedSkillPath(skillmuxHome, skillId);

    if (manifest.skills[skillId] === undefined) {
      await copySkillContentsToManagedStore(sourcePath, managedPath);
      manifest.skills[skillId] = buildManagedSkill(
        skillId,
        entry.skillName,
        managedPath,
        sourcePath,
        timestamp
      );
    } else if (await isLinkPointingToTarget(entry.path, manifest.skills[skillId].path)) {
      skipped.push({
        skillId,
        agentId: agent.id,
        path: entry.path,
        reason: "already-managed"
      });
      continue;
    } else {
      await assertSkillSourceLayout(manifest.skills[skillId].path);
    }

    await replaceEntryWithManagedLink(
      entry.path,
      manifest.skills[skillId].path,
      sourcePath
    );

    const activation = buildActivationRecord(
      skillId,
      agent.id,
      join(agent.absoluteSkillsDirectoryPath, entry.skillName),
      timestamp
    );
    upsertActivation(manifest, activation);
    adopted.push({
      skillId,
      agentId: agent.id,
      sourcePath,
      managedPath: manifest.skills[skillId].path,
      linkPath: activation.linkPath
    });
    await writeManifest(skillmuxHome, manifest);
  }

  await writeManifest(skillmuxHome, manifest);

  const resultWithoutOutput = {
    agent: agentRecord,
    adopted,
    skipped,
    manifest
  };

  return {
    ...resultWithoutOutput,
    output: buildOutput(resultWithoutOutput, options.json === true)
  };
}

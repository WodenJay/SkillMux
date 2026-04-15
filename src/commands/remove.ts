import * as fs from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import type { ManagedSkill, Manifest } from "../core/types";
import { BatchOperationError } from "../core/batch-operation-error";
import { normalizeId } from "../core/ids";
import { resolveSkillmuxHome } from "../config/resolve-skillmux-home";
import { assertNoSymlinkAncestors, pathsAreEqual } from "../fs/path-utils";
import { readManifest } from "../manifest/read-manifest";
import { writeManifest } from "../manifest/write-manifest";
import { printJson } from "../output/print-json";

export type RunRemoveOptions = {
  homeDir?: string;
  skillmuxHome?: string;
  skill?: string;
  skills?: string[];
  json?: boolean;
};

export type RunRemoveSingleResult = {
  changed: boolean;
  removedSkillId: string;
  skill: ManagedSkill;
  location: {
    skillmuxHome: string;
    configPath: string;
    manifestPath: string;
    managedSkillsDirectory: string;
    managedSkillPath: string;
  };
  manifest: Manifest;
  output: string;
};

export type RunRemoveBatchResult = {
  changed: boolean;
  removedSkillIds: string[];
  results: RunRemoveSingleResult[];
  manifest: Manifest;
  output: string;
};

export type RunRemoveResult = RunRemoveSingleResult | RunRemoveBatchResult;

function buildManagedSkillPath(skillmuxHome: string, skillId: string): string {
  return resolve(skillmuxHome, "skills", skillId);
}

function buildManifestPath(skillmuxHome: string): string {
  return resolve(skillmuxHome, "manifest.json");
}

function buildConfigPath(skillmuxHome: string): string {
  return resolve(skillmuxHome, "config.json");
}

function resolveManagedSkill(manifest: Manifest, skillNameOrId: string): ManagedSkill {
  const skillId = normalizeId(skillNameOrId);
  const directMatch = manifest.skills[skillId];

  if (directMatch !== undefined) {
    return directMatch;
  }

  const nameMatches = Object.values(manifest.skills).filter(
    (skill) => normalizeId(skill.name) === skillId
  );

  if (nameMatches.length === 1) {
    return nameMatches[0] as ManagedSkill;
  }

  if (nameMatches.length > 1) {
    const candidateIds = nameMatches.map((skill) => skill.id).sort((left, right) => left.localeCompare(right));
    throw new Error(
      `Ambiguous managed skill name ${skillNameOrId}: ${candidateIds.join(", ")}`
    );
  }

  throw new Error(`Managed skill not found: ${skillId}`);
}

function buildHumanOutput(skill: ManagedSkill, managedSkillPath: string): string {
  return `Removed ${skill.id} from ${managedSkillPath}\n`;
}

function buildJsonOutput(result: Omit<RunRemoveSingleResult, "output">): string {
  return printJson({
    changed: result.changed,
    removedSkillId: result.removedSkillId,
    skill: result.skill,
    location: result.location,
    manifest: result.manifest
  });
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

async function assertManagedSkillRemovalSafety(
  skillmuxHome: string,
  skillPath: string,
  skillId: string
): Promise<void> {
  const expectedSkillPath = buildManagedSkillPath(skillmuxHome, skillId);

  if (!pathsAreEqual(skillPath, expectedSkillPath)) {
    throw new Error(`Refusing to remove unmanaged skill path at ${skillPath}`);
  }

  await assertNoSymlinkAncestors(skillPath, { includeLeaf: true });

  if (!(await pathExists(skillPath))) {
    return;
  }

  const entry = await fs.lstat(skillPath);

  if (entry.isSymbolicLink()) {
    throw new Error(`Refusing to remove symlinked managed skill path at ${skillPath}`);
  }

  if (!entry.isDirectory()) {
    throw new Error(`Refusing to remove non-directory managed skill path at ${skillPath}`);
  }
}

async function runRemoveSingle(
  options: RunRemoveOptions
): Promise<RunRemoveSingleResult> {
  if (options.skill === undefined) {
    throw new Error("Remove requires one target skill");
  }

  const homeDir = options.homeDir ?? homedir();
  const { skillmuxHome: defaultSkillmuxHome } = resolveSkillmuxHome(homeDir);
  const skillmuxHome = options.skillmuxHome ?? defaultSkillmuxHome;
  const manifestPath = buildManifestPath(skillmuxHome);
  const configPath = buildConfigPath(skillmuxHome);
  const manifest = await readManifest(skillmuxHome);
  const skill = resolveManagedSkill(manifest, options.skill);
  const managedSkillsDirectory = resolve(skillmuxHome, "skills");
  const managedSkillPath = skill.path;
  const enabledActivations = manifest.activations.filter(
    (activation) => activation.skillId === skill.id && activation.state === "enabled"
  );

  if (enabledActivations.length > 0) {
    const enabledAgents = [...new Set(enabledActivations.map((activation) => activation.agentId))].sort(
      (left, right) => left.localeCompare(right)
    );
    throw new Error(
      `Cannot remove ${skill.id}; it is still enabled for: ${enabledAgents.join(", ")}`
    );
  }

  await assertManagedSkillRemovalSafety(skillmuxHome, managedSkillPath, skill.id);

  if (await pathExists(managedSkillPath)) {
    await fs.rm(managedSkillPath, { recursive: true, force: false });
  }

  delete manifest.skills[skill.id];
  manifest.activations = manifest.activations.filter(
    (activation) => activation.skillId !== skill.id
  );

  await writeManifest(skillmuxHome, manifest);

  const resultWithoutOutput = {
    changed: true,
    removedSkillId: skill.id,
    skill,
    location: {
      skillmuxHome,
      configPath,
      manifestPath,
      managedSkillsDirectory,
      managedSkillPath
    },
    manifest
  };

  return {
    ...resultWithoutOutput,
    output: options.json === true
      ? buildJsonOutput(resultWithoutOutput)
      : buildHumanOutput(skill, managedSkillPath)
  };
}

export async function runRemove(
  options: RunRemoveOptions & { skills: string[] }
): Promise<RunRemoveBatchResult>;
export async function runRemove(
  options: RunRemoveOptions & { skill: string }
): Promise<RunRemoveSingleResult>;
export async function runRemove(
  options: RunRemoveOptions
): Promise<RunRemoveResult> {
  if (options.skills !== undefined) {
    const results: RunRemoveSingleResult[] = [];

    for (const skill of options.skills) {
      try {
        results.push(await runRemoveSingle({ ...options, skill, skills: undefined }));
      } catch (error) {
        throw new BatchOperationError({
          operation: "remove",
          failedItem: skill,
          failedAction: `remove ${skill}`,
          completedAction: "removing",
          completedItems: results.map((result) => result.removedSkillId),
          cause: error
        });
      }
    }

    if (results.length === 0) {
      throw new Error("Remove requires at least one target skill");
    }

    const lastResult = results[results.length - 1] as RunRemoveSingleResult;
    const resultWithoutOutput = {
      changed: results.some((result) => result.changed),
      removedSkillIds: results.map((result) => result.removedSkillId),
      results,
      manifest: lastResult.manifest
    };

    return {
      ...resultWithoutOutput,
      output: options.json === true
        ? printJson(resultWithoutOutput)
        : results.map((result) => result.output).join("")
    };
  }

  return runRemoveSingle(options);
}

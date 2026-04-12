import { resolve } from "node:path";
import { homedir } from "node:os";
import type { ManagedSkill, Manifest } from "../core/types";
import { normalizeId } from "../core/ids";
import { resolveSkillmuxHome } from "../config/resolve-skillmux-home";
import {
  assertSkillSourceLayout,
  copySkillContentsToManagedStore
} from "../fs/safe-copy";
import { readManifest } from "../manifest/read-manifest";
import { writeManifest } from "../manifest/write-manifest";

export type RunImportOptions = {
  homeDir?: string;
  skillmuxHome?: string;
  sourcePath: string;
  skillName: string;
  now?: Date;
};

export type RunImportResult = {
  skill: ManagedSkill;
  manifest: Manifest;
  output: string;
};

function buildManagedSkillPath(skillmuxHome: string, skillId: string): string {
  return resolve(skillmuxHome, "skills", skillId);
}

export async function runImport(
  options: RunImportOptions
): Promise<RunImportResult> {
  const homeDir = options.homeDir ?? homedir();
  const resolvedPaths = resolveSkillmuxHome(homeDir);
  const skillmuxHome = options.skillmuxHome ?? resolvedPaths.skillmuxHome;
  const sourcePath = resolve(options.sourcePath);
  const skillId = normalizeId(options.skillName);
  const importedAt = (options.now ?? new Date()).toISOString();
  const manifest = await readManifest(skillmuxHome);
  const managedSkillPath = buildManagedSkillPath(skillmuxHome, skillId);

  await assertSkillSourceLayout(sourcePath);

  if (manifest.skills[skillId] !== undefined) {
    throw new Error(`Managed skill already exists for ${skillId}`);
  }

  await copySkillContentsToManagedStore(sourcePath, managedSkillPath);

  const skill: ManagedSkill = {
    id: skillId,
    name: options.skillName,
    path: managedSkillPath,
    source: {
      kind: "local",
      path: sourcePath
    },
    importedAt
  };

  manifest.skills[skillId] = skill;
  await writeManifest(skillmuxHome, manifest);

  return {
    skill,
    manifest,
    output: `Imported ${skillId} to ${managedSkillPath}\n`
  };
}

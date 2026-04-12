import * as fs from "node:fs/promises";
import { join } from "node:path";
import { resolveSkillmuxHome } from "../../src/config/resolve-skillmux-home";
import { createManagedLink } from "../../src/fs/link-ops";
import { cleanupTempHomeDir, createTempHomeDir } from "./temp-env";

const directoryLinkType = process.platform === "win32" ? "junction" : "dir";

export type AgentFixture = {
  homeDir: string;
  skillmuxHome: string;
  managedSkillPath: string;
  cleanup: () => void;
};

export async function createAgentFixture(): Promise<AgentFixture> {
  const homeDir = createTempHomeDir();
  const { skillmuxHome } = resolveSkillmuxHome(homeDir);
  const managedSkillPath = join(skillmuxHome, "skills", "find-skills");
  const externalSkillPath = join(homeDir, "external-skills", "shared-skill");
  const brokenTargetPath = join(homeDir, "missing-skills", "broken-skill");

  await fs.mkdir(managedSkillPath, { recursive: true });
  await fs.writeFile(join(managedSkillPath, "SKILL.md"), "# Find Skills\n", "utf8");

  await fs.mkdir(externalSkillPath, { recursive: true });
  await fs.writeFile(
    join(externalSkillPath, "SKILL.md"),
    "# Shared Skill\n",
    "utf8"
  );

  await createManagedLink(
    join(homeDir, ".codex", "skills", "find-skills"),
    managedSkillPath
  );
  await createManagedLink(
    join(homeDir, ".claude", "skills", "find-skills"),
    managedSkillPath
  );
  await createManagedLink(
    join(homeDir, ".claude", "skills", "shared-skill"),
    externalSkillPath
  );

  await fs.mkdir(join(homeDir, ".claude", "skills", "local-draft"), {
    recursive: true
  });
  await fs.writeFile(
    join(homeDir, ".claude", "skills", "local-draft", "SKILL.md"),
    "# Local Draft\n",
    "utf8"
  );

  await fs.symlink(
    brokenTargetPath,
    join(homeDir, ".claude", "skills", "broken-skill"),
    directoryLinkType
  );

  return {
    homeDir,
    skillmuxHome,
    managedSkillPath,
    cleanup: () => cleanupTempHomeDir(homeDir)
  };
}

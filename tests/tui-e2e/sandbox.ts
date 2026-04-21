import * as fs from "node:fs/promises";
import { join } from "node:path";
import { resolveSkillmuxHome } from "../../src/config/resolve-skillmux-home";
import { createManagedLink } from "../../src/fs/link-ops";
import {
  cleanupTempHomeDir,
  createTempHomeDir,
  ensureDirectory
} from "../helpers/temp-env";

export type Sandbox = {
  homeDir: string;
  skillmuxHome: string;
  ensureAgentSkillsDir(agentId: string): Promise<string>;
  writeManagedSkill(skillName: string, content?: string): Promise<string>;
  enableManagedSkill(agentId: string, skillName: string): Promise<string>;
  writeUnmanagedSkill(agentId: string, skillName: string, content?: string): Promise<string>;
  writeManifest(value: unknown): Promise<void>;
  cleanup(): void;
};

export async function createSandbox(): Promise<Sandbox> {
  const homeDir = createTempHomeDir();
  const { skillmuxHome } = resolveSkillmuxHome(homeDir);

  await fs.mkdir(skillmuxHome, { recursive: true });

  const ensureAgentSkillsDir = async (agentId: string): Promise<string> => {
    const agentSkillsDir = join(homeDir, `.${agentId}`, "skills");
    ensureDirectory(agentSkillsDir);
    return agentSkillsDir;
  };

  return {
    homeDir,
    skillmuxHome,
    ensureAgentSkillsDir,
    async writeManagedSkill(skillName, content = `# ${skillName}\n`) {
      const managedSkillPath = join(skillmuxHome, "skills", skillName);
      ensureDirectory(managedSkillPath);
      await fs.writeFile(join(managedSkillPath, "SKILL.md"), content, "utf8");
      return managedSkillPath;
    },
    async enableManagedSkill(agentId, skillName) {
      const agentSkillsDir = await ensureAgentSkillsDir(agentId);
      const managedSkillPath = join(skillmuxHome, "skills", skillName);
      const linkPath = join(agentSkillsDir, skillName);

      await createManagedLink(linkPath, managedSkillPath);
      return linkPath;
    },
    async writeUnmanagedSkill(agentId, skillName, content = `# ${skillName}\n`) {
      const agentSkillsDir = await ensureAgentSkillsDir(agentId);
      const unmanagedSkillPath = join(agentSkillsDir, skillName);
      ensureDirectory(unmanagedSkillPath);
      await fs.writeFile(join(unmanagedSkillPath, "SKILL.md"), content, "utf8");
      return unmanagedSkillPath;
    },
    async writeManifest(value) {
      await fs.writeFile(
        join(skillmuxHome, "manifest.json"),
        `${JSON.stringify(value, null, 2)}\n`,
        "utf8"
      );
    },
    cleanup() {
      cleanupTempHomeDir(homeDir);
    }
  };
}

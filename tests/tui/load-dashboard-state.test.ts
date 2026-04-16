import * as fs from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runEnable } from "../../src/commands/enable";
import { runImport } from "../../src/commands/import";
import { loadDashboardState } from "../../src/tui/load-dashboard-state";
import {
  cleanupTempHomeDir,
  createTempHomeDir
} from "../helpers/temp-env";

const tempHomes: string[] = [];

afterEach(() => {
  tempHomes.splice(0).forEach((homeDir) => cleanupTempHomeDir(homeDir));
});

async function createSourceSkill(
  homeDir: string,
  skillName: string
): Promise<string> {
  const sourcePath = join(homeDir, "sources", skillName);
  await fs.mkdir(sourcePath, { recursive: true });
  await fs.writeFile(join(sourcePath, "SKILL.md"), `# ${skillName}\n`, "utf8");
  return sourcePath;
}

describe("loadDashboardState", () => {
  it("does not create a manifest during initial read-only load", async () => {
    const homeDir = createTempHomeDir();
    tempHomes.push(homeDir);
    const manifestPath = join(homeDir, ".skillmux", "manifest.json");

    await fs.mkdir(join(homeDir, ".codex", "skills"), { recursive: true });

    const model = await loadDashboardState({
      homeDir,
      platform: "win32",
      selectedAgentId: "codex"
    });

    expect(model.selectedAgentId).toBe("codex");
    await expect(fs.access(manifestPath)).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("shows every managed skill as disabled for a selected agent with no enabled activation", async () => {
    const homeDir = createTempHomeDir();
    tempHomes.push(homeDir);

    const findSkillsSource = await createSourceSkill(homeDir, "find-skills");
    const tuiSource = await createSourceSkill(homeDir, "tui-design");

    await runImport({
      homeDir,
      sourcePath: findSkillsSource,
      skillName: "find-skills"
    });
    await runImport({
      homeDir,
      sourcePath: tuiSource,
      skillName: "tui-design"
    });
    await runEnable({
      homeDir,
      skill: "find-skills",
      agent: "codex"
    });

    const model = await loadDashboardState({
      homeDir,
      platform: "win32",
      selectedAgentId: "claude"
    });

    expect(model.selectedAgentId).toBe("claude");
    expect(model.skills).toEqual([
      expect.objectContaining({
        kind: "disabled",
        marker: "○",
        skillId: "find-skills"
      }),
      expect.objectContaining({
        kind: "disabled",
        marker: "○",
        skillId: "tui-design"
      })
    ]);
  });
});

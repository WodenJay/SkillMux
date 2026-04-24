import * as fs from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createScenarioFixture } from "../fixtures";
import { startExplorer } from "../explorer";

const cleanups: Array<() => void | Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

async function createImportSourceDir(
  homeDir: string,
  skillName: string,
  content = `# ${skillName}\n`
): Promise<string> {
  const sourceDir = join(homeDir, "import-sources", skillName);
  await fs.mkdir(sourceDir, { recursive: true });
  await fs.writeFile(join(sourceDir, "SKILL.md"), content, "utf8");
  return sourceDir;
}

describe("tui import flow", () => {
  it(
    "imports a local skill through the TUI and verifies the managed store",
    async () => {
      const fixture = await createScenarioFixture({
        agents: ["codex"]
      });
      cleanups.push(fixture.cleanup);

      const importSourceDir = await createImportSourceDir(
        fixture.homeDir,
        "my-local-skill",
        "# My Local Skill\nA test skill.\n"
      );

      const explorer = await startExplorer({
        homeDir: fixture.homeDir,
        skillmuxHome: fixture.skillmuxHome,
        agentId: "codex",
        scenarioName: "import-flow",
        cols: 100,
        rows: 30
      });
      cleanups.push(() => explorer.close());

      await explorer.waitForReady(10000);

      // --- Import skill ---
      await explorer.openImport();
      await explorer.waitForText("Import skill", 5000);

      // Field 0: Source path
      await explorer.typeText(importSourceDir);

      // Field 1: Skill name
      await explorer.nextRow();
      await explorer.typeText("my-local-skill");

      // Submit row
      await explorer.nextRow();
      await explorer.waitForText("Submit");
      await explorer.submitForm();

      // Wait for dashboard reload
      await explorer.waitForText("Skills for codex", 15000);

      // Verify managed store has the imported skill
      await expect(
        explorer.fs.exists(explorer.paths.managedSkill("my-local-skill"))
      ).resolves.toBe(true);

      await explorer.quit();
      await explorer.waitForExit();

      expect(explorer.exitCode()).toBe(0);
    },
    60000
  );
});

describe("tui doctor flow", () => {
  it(
    "runs doctor diagnostics through the TUI and shows results",
    async () => {
      const fixture = await createScenarioFixture({
        agents: ["codex"]
      });
      cleanups.push(fixture.cleanup);

      const explorer = await startExplorer({
        homeDir: fixture.homeDir,
        skillmuxHome: fixture.skillmuxHome,
        agentId: "codex",
        scenarioName: "doctor-flow",
        cols: 100,
        rows: 30
      });
      cleanups.push(() => explorer.close());

      await explorer.waitForReady(10000);

      // --- Doctor ---
      await explorer.openDoctor();
      await explorer.waitForText("Doctor", 5000);

      // Doctor may complete very fast; wait for final result directly
      await explorer.waitForText("No doctor issues found.", 15000);

      // Close doctor modal
      await explorer.closeOverlay();
      await explorer.waitForText("Skills for codex", 5000);

      await explorer.quit();
      await explorer.waitForExit();

      expect(explorer.exitCode()).toBe(0);
    },
    60000
  );
});

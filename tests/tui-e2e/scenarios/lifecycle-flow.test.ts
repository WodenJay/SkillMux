import { lstat, readlink } from "node:fs/promises";
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

describe("tui explorer lifecycle flow", () => {
  it(
    "re-enables a disabled managed skill, disables it again, adopts an unmanaged skill, and removes the disabled managed record",
    async () => {
      const fixture = await createScenarioFixture({
        agents: ["codex"],
        managedDisabled: [{ agentId: "codex", skillName: "using-superpowers" }],
      unmanaged: [{ agentId: "codex", skillName: "find-skills" }]
    });
    cleanups.push(fixture.cleanup);

    const explorer = await startExplorer({
      homeDir: fixture.homeDir,
      skillmuxHome: fixture.skillmuxHome,
      agentId: "codex",
      scenarioName: "lifecycle-flow"
    });
    cleanups.push(() => explorer.close());

    const disabledManagedPath = explorer.paths.agentSkill(
      "codex",
      "using-superpowers"
    );
    const managedSkillPath = explorer.paths.managedSkill("using-superpowers");
    const adoptedManagedPath = explorer.paths.managedSkill("find-skills");
    const unmanagedPath = explorer.paths.agentSkill("codex", "find-skills");

    await explorer.waitForReady();
    await explorer.focusSkills();
    await explorer.waitForText("using-superpowers");
    await expect(explorer.fs.exists(disabledManagedPath)).resolves.toBe(false);
    await expect(explorer.fs.exists(managedSkillPath)).resolves.toBe(true);

    await explorer.toggle();
    await explorer.waitForText("Enabled using-superpowers for codex");
    await expect(explorer.fs.exists(disabledManagedPath)).resolves.toBe(true);
    await expect(explorer.fs.isSymlink(disabledManagedPath)).resolves.toBe(true);
    await expect(explorer.fs.readLinkTarget(disabledManagedPath)).resolves.toBe(
      managedSkillPath
    );

    await explorer.toggle();
    await explorer.waitForText("Disabled using-superpowers for codex");
    await expect(explorer.fs.exists(disabledManagedPath)).resolves.toBe(false);
    await expect(explorer.fs.exists(managedSkillPath)).resolves.toBe(true);

    await explorer.nextRow();
    await explorer.waitForText("find-skills");
    await explorer.adopt();
    await explorer.confirm();
    await explorer.waitForText("Adopted find-skills for codex");
    await expect(explorer.fs.exists(adoptedManagedPath)).resolves.toBe(true);
    await expect(explorer.fs.isSymlink(unmanagedPath)).resolves.toBe(true);
    await expect(explorer.fs.readLinkTarget(unmanagedPath)).resolves.toBe(
      adoptedManagedPath
    );

    await explorer.lastRow();
    await explorer.remove();
    await explorer.confirm();
    await explorer.waitForText("Removed using-superpowers from");
    await expect(explorer.fs.exists(managedSkillPath)).resolves.toBe(false);
    await expect(explorer.fs.exists(disabledManagedPath)).resolves.toBe(false);

    const adoptedLinkStats = await lstat(unmanagedPath);
    expect(adoptedLinkStats.isSymbolicLink()).toBe(true);
    expect(await readlink(unmanagedPath)).toBe(
      join(fixture.skillmuxHome, "skills", "find-skills")
    );

    await explorer.quit();
    await explorer.waitForExit();

    expect(explorer.exitCode()).toBe(0);
    },
    30000
  );
});

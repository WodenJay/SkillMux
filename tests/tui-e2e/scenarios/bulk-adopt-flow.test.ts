import { afterEach, describe, expect, it } from "vitest";
import { createScenarioFixture } from "../fixtures";
import { startExplorer } from "../explorer";

const cleanups: Array<() => void | Promise<void>> = [];

async function waitForBulkAdoptCompletion(
  explorer: Awaited<ReturnType<typeof startExplorer>>,
  links: Array<{ path: string; target: string }>,
  timeoutMs = 10000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const states = await Promise.all(
      links.map(async ({ path, target }) => {
        if (!(await explorer.fs.isSymlink(path))) {
          return false;
        }

        return (await explorer.fs.readLinkTarget(path)) === target;
      })
    );

    if (states.every(Boolean)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(
    `Timed out waiting for bulk adopt completion: ${links
      .map((link) => `${link.path} -> ${link.target}`)
      .join(", ")}`
  );
}

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describe("tui explorer bulk adopt flow", () => {
  it(
    "adopts all unmanaged skills for the selected agent from the real PTY",
    async () => {
      const fixture = await createScenarioFixture({
        agents: ["codex"],
        unmanaged: [
          { agentId: "codex", skillName: "find-skills" },
          { agentId: "codex", skillName: "terminal-ui" }
        ]
      });
      cleanups.push(fixture.cleanup);

      const explorer = await startExplorer({
        homeDir: fixture.homeDir,
        skillmuxHome: fixture.skillmuxHome,
        agentId: "codex",
        scenarioName: "bulk-adopt-flow"
      });
      cleanups.push(() => explorer.close());

      const managedFindSkillsPath = explorer.paths.managedSkill("find-skills");
      const managedTerminalUiPath = explorer.paths.managedSkill("terminal-ui");
      const agentFindSkillsPath = explorer.paths.agentSkill(
        "codex",
        "find-skills"
      );
      const agentTerminalUiPath = explorer.paths.agentSkill(
        "codex",
        "terminal-ui"
      );

      await explorer.waitForReady(10000);
      await explorer.bulkAdopt();
      await explorer.waitForText("Confirm");
      await explorer.waitForText("Adopt all unmanaged skills for codex?");
      await explorer.confirm();

      await waitForBulkAdoptCompletion(explorer, [
        { path: agentFindSkillsPath, target: managedFindSkillsPath },
        { path: agentTerminalUiPath, target: managedTerminalUiPath }
      ]);

      await expect(explorer.fs.exists(managedFindSkillsPath)).resolves.toBe(
        true
      );
      await expect(explorer.fs.exists(managedTerminalUiPath)).resolves.toBe(
        true
      );
      await expect(explorer.fs.isSymlink(agentFindSkillsPath)).resolves.toBe(
        true
      );
      await expect(explorer.fs.isSymlink(agentTerminalUiPath)).resolves.toBe(
        true
      );
      await expect(explorer.fs.readLinkTarget(agentFindSkillsPath)).resolves.toBe(
        managedFindSkillsPath
      );
      await expect(
        explorer.fs.readLinkTarget(agentTerminalUiPath)
      ).resolves.toBe(managedTerminalUiPath);

      await explorer.quit();
      await explorer.waitForExit();

      expect(explorer.exitCode()).toBe(0);
    },
    30000
  );
});

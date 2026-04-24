import { afterEach, describe, expect, it } from "vitest";
import { createScenarioFixture } from "../fixtures";
import { startExplorer } from "../explorer";

const cleanups: Array<() => void | Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("tui agent config flow", () => {
  it(
    "adds an agent override through the TUI and verifies it appears in the dashboard",
    async () => {
      const fixture = await createScenarioFixture({
        agents: ["codex"]
      });
      cleanups.push(fixture.cleanup);

      const explorer = await startExplorer({
        homeDir: fixture.homeDir,
        skillmuxHome: fixture.skillmuxHome,
        agentId: "codex",
        scenarioName: "agent-config-add",
        cols: 100,
        rows: 30
      });
      cleanups.push(() => explorer.close());

      await explorer.waitForReady(10000);

      // Open add-agent form
      await explorer.openAddAgent();
      await explorer.waitForText("Add agent", 5000);

      // Field 0: Agent id
      await explorer.typeText("myagent");
      await sleep(200);

      // Field 1: Root path
      await explorer.nextRow();
      await sleep(200);
      for (let i = 0; i < 4; i++) {
        await explorer.backspace();
      }
      await explorer.typeText(".myagent");
      await sleep(200);

      // Field 2: Skills path (keep default "skills")
      await explorer.nextRow();
      await sleep(200);

      // Field 3: Display name
      await explorer.nextRow();
      await sleep(200);
      await explorer.typeText("MyAgent");
      await sleep(200);

      // Field 4: Platforms (toggle win32)
      await explorer.nextRow();
      await sleep(200);
      await explorer.toggle();
      await sleep(200);

      // Field 5: Disabled by default (keep unchecked)
      await explorer.nextRow();
      await sleep(200);

      // Submit row
      await explorer.nextRow();
      await sleep(200);
      await explorer.submitForm();

      // Wait for dashboard to reload with new agent
      // "No skills for this agent" only appears in the dashboard, not in the form
      await explorer.waitForText("No skills for this agent", 15000);

      await explorer.quit();
      await explorer.waitForExit();

      expect(explorer.exitCode()).toBe(0);
    },
    60000
  );

  it(
    "adds then removes an agent override through the TUI",
    async () => {
      const fixture = await createScenarioFixture({
        agents: ["codex"]
      });
      cleanups.push(fixture.cleanup);

      const explorer = await startExplorer({
        homeDir: fixture.homeDir,
        skillmuxHome: fixture.skillmuxHome,
        agentId: "codex",
        scenarioName: "agent-config-remove",
        cols: 100,
        rows: 30
      });
      cleanups.push(() => explorer.close());

      await explorer.waitForReady(10000);

      // Add agent first
      await explorer.openAddAgent();
      await explorer.waitForText("Add agent", 5000);

      await explorer.typeText("myagent");
      await sleep(200);

      await explorer.nextRow();
      await sleep(200);
      for (let i = 0; i < 4; i++) {
        await explorer.backspace();
      }
      await explorer.typeText(".myagent");
      await sleep(200);

      await explorer.nextRow();
      await sleep(200);

      await explorer.nextRow();
      await sleep(200);
      await explorer.typeText("MyAgent");
      await sleep(200);

      await explorer.nextRow();
      await sleep(200);
      await explorer.toggle();
      await sleep(200);

      await explorer.nextRow();
      await sleep(200);

      await explorer.nextRow();
      await sleep(200);
      await explorer.submitForm();

      await explorer.waitForText("No skills for this agent", 15000);

      // Now remove the agent
      await sleep(500);
      await explorer.openRemoveAgent();
      await explorer.waitForText("Remove agent override", 5000);
      await explorer.confirm(); // y

      // Dashboard should reload with codex
      await explorer.waitForText("OpenAI Codex", 15000);

      await explorer.quit();
      await explorer.waitForExit();

      expect(explorer.exitCode()).toBe(0);
    },
    60000
  );
});

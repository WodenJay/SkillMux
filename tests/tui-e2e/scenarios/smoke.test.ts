import { afterEach, describe, expect, it } from "vitest";
import { createScenarioFixture } from "../fixtures";
import { startExplorer } from "../explorer";

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
});

describe("tui pty smoke", () => {
  it("launches the dashboard and exits on q", async () => {
    const fixture = await createScenarioFixture({
      agents: ["codex"],
      managedEnabled: [{ agentId: "codex", skillName: "using-superpowers" }]
    });
    cleanups.push(fixture.cleanup);

    const explorer = await startExplorer({
      homeDir: fixture.homeDir,
      skillmuxHome: fixture.skillmuxHome,
      cols: 100,
      rows: 30,
      scenarioName: "smoke-launch-quit"
    });

    await explorer.waitForText("Skills for codex");
    await explorer.snapshot("initial-dashboard");
    await explorer.press("q");
    await explorer.waitForExit();

    expect(explorer.currentScreen()).toContain("Skills for codex");
    expect(explorer.exitCode()).toBe(0);
  });
});

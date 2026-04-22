import { afterEach, describe, expect, it } from "vitest";
import { createScenarioFixture } from "../fixtures";
import { startExplorer } from "../explorer";

const cleanups: Array<() => void | Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describe("tui explorer usability probes", () => {
  it(
    "exercises help, search, resize, and alternate movement keys",
    async () => {
      const fixture = await createScenarioFixture({
        agents: ["claude", "codex"],
        managedEnabled: [{ agentId: "codex", skillName: "using-superpowers" }],
      managedDisabled: [{ agentId: "codex", skillName: "find-skills" }]
    });
    cleanups.push(fixture.cleanup);

    const explorer = await startExplorer({
      homeDir: fixture.homeDir,
      skillmuxHome: fixture.skillmuxHome,
      agentId: "claude",
      scenarioName: "usability-probes"
    });
    cleanups.push(() => explorer.close());

    await explorer.waitForReady(10000);
    await explorer.openHelp();
    await explorer.waitForText("Navigation");
    await explorer.waitForText("Search");
    await explorer.closeOverlay();

    await explorer.search("zzz");
    await explorer.waitForText("No matching agents");
    await explorer.closeSearch();
    await explorer.waitForText("Skills for claude");

    await explorer.search("cod");
    await explorer.waitForText("OpenAI Codex");
    await explorer.submitSearch();
    await explorer.waitForText("Skills for codex");

    await explorer.focusSkills();
    await explorer.search("zzz");
    await explorer.waitForText("No matching skills");
    await explorer.closeSearch();
    await explorer.waitForText("using-superpowers");

    await explorer.search("find");
    await explorer.waitForText("find-skills");
    await explorer.submitSearch();
    await explorer.waitForText("Skill markers:");

    await explorer.previousRowBy("k");
    await explorer.waitForText("using-superpowers");
    await explorer.nextRowBy("j");
    await explorer.waitForText("find-skills");

    await explorer.resize(120, 40);
    await explorer.waitForText("Skills for codex");
    expect(explorer.snapshot()).not.toContain("Terminal too small");

    await explorer.forceQuit();
    await explorer.waitForExit();

    expect(explorer.exitCode()).toBe(0);
    },
    30000
  );
});

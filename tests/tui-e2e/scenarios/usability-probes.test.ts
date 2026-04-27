import { afterEach, describe, expect, it } from "vitest";
import { createScenarioFixture } from "../fixtures";
import { startExplorer } from "../explorer";

const cleanups: Array<() => void | Promise<void>> = [];
const cursorHide = "\u001B[?25l";
const cursorShow = "\u001B[?25h";
const enabledMarker = "ENABLED using-superpowers";

async function waitForDashboardRestored(
  explorer: Awaited<ReturnType<typeof startExplorer>>,
  timeoutMs = 10000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const snapshot = explorer.snapshot();
    if (
      snapshot.includes("Skills for codex") &&
      snapshot.includes("Store:") &&
      !snapshot.includes("Terminal too small")
    ) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error("Timed out waiting for dashboard to fully restore");
}

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
      scenarioName: "usability-probes",
      traceLifecycle: true
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
    await explorer.waitForText("enabled");

    await explorer.previousRowBy("k");
    await explorer.waitForText("using-superpowers");
    await explorer.nextRowBy("j");
    await explorer.waitForText("find-skills");

    await explorer.resize(132, 40);
    await explorer.waitForText("Skills for codex");
    expect(explorer.snapshot()).toContain("Skills for codex");
    expect(explorer.snapshot()).toContain("Store:");
    expect(explorer.snapshot()).not.toContain("Terminal too small");

    await explorer.resize(80, 24);
    await explorer.waitForText("Skills for codex");
    expect(explorer.snapshot()).toContain("Skills for codex");
    expect(explorer.snapshot()).not.toContain("Terminal too small");

    await explorer.resize(79, 24);
    await explorer.saveSnapshot("below-floor");
    await explorer.waitForText(
      "Terminal too small. Resize to at least 80x24.",
      10000
    );
    expect(explorer.snapshot()).toContain(
      "Terminal too small. Resize to at least 80x24."
    );

    await explorer.resize(80, 24);
    await waitForDashboardRestored(explorer);
    expect(explorer.snapshot()).toContain("Skills for codex");
    expect(explorer.snapshot()).toContain("Store:");
    expect(explorer.snapshot()).not.toContain("Terminal too small");

    await explorer.forceQuit();
    await explorer.waitForExit();
    const rawOutput = explorer.rawOutput();
    const exitMarker = "[skillmux:alt-screen-exit]";
    const afterExitBoundary = rawOutput.slice(rawOutput.lastIndexOf(exitMarker));
    expect(explorer.eventLog()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "trace", marker: "alt-screen-enter" }),
        expect.objectContaining({ type: "trace", marker: "alt-screen-exit" })
      ])
    );
    expect(rawOutput).toContain(cursorHide);
    expect(rawOutput).toContain(cursorShow);
    expect(afterExitBoundary).toContain(exitMarker);
    expect(afterExitBoundary).not.toContain("Skills for codex");
    expect(afterExitBoundary).not.toContain(enabledMarker);
    expect(afterExitBoundary).not.toContain(
      "Terminal too small. Resize to at least 80x24."
    );

    expect(explorer.exitCode()).toBe(0);
    },
    30000
  );
});

import { afterEach, describe, expect, it } from "vitest";
import { createScenarioFixture } from "../fixtures";
import { createPtySession } from "../pty-session";

const cleanups: Array<() => void | Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describe("tui pty smoke", () => {
  it("launches the dashboard and exits on q", async () => {
    const fixture = await createScenarioFixture({
      agents: ["codex"],
      managedEnabled: [{ agentId: "codex", skillName: "using-superpowers" }]
    });
    cleanups.push(fixture.cleanup);

    const session = await createPtySession({
      homeDir: fixture.homeDir,
      skillmuxHome: fixture.skillmuxHome,
      cols: 100,
      rows: 30,
      scenarioName: "smoke-launch-quit"
    });
    cleanups.push(() => session.close());

    await session.waitForText("Skills for codex", 10000);
    await session.waitForText("using-superpowers");
    const runningSnapshot = session.snapshot();
    await session.saveSnapshot("initial-dashboard");
    await session.press("q");
    await session.waitForExit();
    await session.flushArtifacts();

    const finalSnapshot = session.snapshot();

    expect(runningSnapshot).toContain("Skills for codex");
    expect(runningSnapshot).toContain("using-superpowers");
    expect(finalSnapshot).not.toContain("Skills for codex");
    expect(finalSnapshot).not.toContain("using-superpowers");
    expect(finalSnapshot).not.toContain("Store: ...\\.skillmux\\skills\\using-superpowers");
    expect(finalSnapshot).not.toContain("Link: ...\\.codex\\skills\\using-superpowers");
    expect(finalSnapshot).not.toContain("Skill markers:");
    expect(runningSnapshot).not.toContain("Claude Code");
    expect(runningSnapshot).not.toContain("Gemini CLI");
    expect(runningSnapshot).not.toContain("OpenClaw");
    expect(runningSnapshot).not.toContain("\n?  Agents");
    expect(runningSnapshot).toContain(
      "Store: ...\\.skillmux\\skills\\using-superpowers"
    );
    expect(runningSnapshot).toContain(
      "Link: ...\\.codex\\skills\\using-superpowers"
    );
    expect(runningSnapshot).toContain("Skill markers:");
    expect(session.exitCode()).toBe(0);
    expect(session.eventLog()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "spawn" }),
        expect.objectContaining({ type: "keypress", key: "q" }),
        expect.objectContaining({ type: "exit", code: 0 })
      ])
    );
  }, 30000);
});

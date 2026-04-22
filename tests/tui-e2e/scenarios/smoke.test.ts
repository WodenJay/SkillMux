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
    await session.waitForText("● using-superpowers");
    await session.saveSnapshot("initial-dashboard");
    await session.press("q");
    await session.waitForExit();
    await session.flushArtifacts();

    expect(session.snapshot()).toContain("Skills for codex");
    expect(session.snapshot()).toContain("● using-superpowers");
    expect(session.snapshot()).toContain(
      "Store: ...\\.skillmux\\skills\\using-superpowers"
    );
    expect(session.snapshot()).toContain(
      "Link: ...\\.codex\\skills\\using-superpowers"
    );
    expect(session.snapshot()).toContain(
      "Skill markers: ● enabled  ○ disabled  ? unmanaged  ! issue"
    );
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

import { afterEach, describe, expect, it } from "vitest";
import { createScenarioFixture } from "../fixtures";
import { createPtySession } from "../pty-session";

const cleanups: Array<() => void | Promise<void>> = [];
const cursorHide = "\u001B[?25l";
const cursorShow = "\u001B[?25h";
const enabledMarker = "\u25CF using-superpowers";
const skillMarkers = "Skill markers: \u25CF enabled  \u25CB disabled  ? unmanaged  ! issue";

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
      scenarioName: "smoke-launch-quit",
      traceLifecycle: true
    });
    cleanups.push(() => session.close());

    await session.waitForText("Skills for codex", 10000);
    await session.waitForText(enabledMarker);
    const runningSnapshot = session.snapshot();
    await session.saveSnapshot("initial-dashboard");
    await session.press("q");
    await session.waitForExit();
    await session.flushArtifacts();

    const exitMarker = "[skillmux:alt-screen-exit]";
    const rawOutput = session.rawOutput();
    const afterExitBoundary = rawOutput.slice(rawOutput.lastIndexOf(exitMarker));

    expect(rawOutput).toContain(cursorHide);
    expect(rawOutput).toContain(cursorShow);
    expect(session.eventLog()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "trace", marker: "alt-screen-enter" }),
        expect.objectContaining({ type: "trace", marker: "session-exit-clean" }),
        expect.objectContaining({ type: "trace", marker: "alt-screen-exit" })
      ])
    );
    expect(runningSnapshot).toContain("Skills for codex");
    expect(runningSnapshot).toContain(enabledMarker);
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
    expect(runningSnapshot).toContain(skillMarkers);
    expect(afterExitBoundary).toContain(exitMarker);
    expect(afterExitBoundary).not.toContain("Skills for codex");
    expect(afterExitBoundary).not.toContain(enabledMarker);
    expect(afterExitBoundary).not.toContain(
      "Store: ...\\.skillmux\\skills\\using-superpowers"
    );
    expect(afterExitBoundary).not.toContain(
      "Link: ...\\.codex\\skills\\using-superpowers"
    );
    expect(afterExitBoundary).not.toContain(skillMarkers);
    expect(session.eventLog()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "spawn" }),
        expect.objectContaining({ type: "trace", marker: "alt-screen-enter" }),
        expect.objectContaining({ type: "trace", marker: "session-exit-clean" }),
        expect.objectContaining({ type: "trace", marker: "alt-screen-exit" }),
        expect.objectContaining({ type: "keypress", key: "q" }),
        expect.objectContaining({ type: "exit" })
      ])
    );
    expect(session.exitCode()).toBe(0);
  }, 30000);
});

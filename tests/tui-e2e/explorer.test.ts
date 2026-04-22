import * as fs from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createPtySessionMock = vi.fn();
const { rmMock } = vi.hoisted(() => ({
  rmMock: vi.fn()
}));

vi.mock("./pty-session", () => ({
  createPtySession: createPtySessionMock
}));

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>(
    "node:fs/promises"
  );

  rmMock.mockImplementation((...args: Parameters<typeof actual.rm>) => actual.rm(...args));

  return {
    ...actual,
    rm: rmMock
  };
});

describe("startExplorer", () => {
  let rootDir: string;
  let homeDir: string;
  let skillmuxHome: string;
  let pressMock: ReturnType<typeof vi.fn>;
  let resizeMock: ReturnType<typeof vi.fn>;
  let waitForTextMock: ReturnType<typeof vi.fn>;
  let waitForExitMock: ReturnType<typeof vi.fn>;
  let saveSnapshotMock: ReturnType<typeof vi.fn>;
  let flushArtifactsMock: ReturnType<typeof vi.fn>;
  let closeMock: ReturnType<typeof vi.fn>;
  let snapshotMock: ReturnType<typeof vi.fn>;
  let rawOutputMock: ReturnType<typeof vi.fn>;
  let exitCodeMock: ReturnType<typeof vi.fn>;
  let eventLogMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), "skillmux-explorer-unit-"));
    homeDir = join(rootDir, "home");
    skillmuxHome = join(homeDir, ".skillmux");
    await fs.mkdir(join(homeDir, ".codex", "skills"), { recursive: true });
    await fs.mkdir(join(skillmuxHome, "skills", "alpha"), { recursive: true });

    pressMock = vi.fn().mockResolvedValue(undefined);
    resizeMock = vi.fn().mockResolvedValue(undefined);
    waitForTextMock = vi.fn().mockResolvedValue(undefined);
    waitForExitMock = vi.fn().mockResolvedValue(undefined);
    saveSnapshotMock = vi.fn().mockResolvedValue(undefined);
    flushArtifactsMock = vi.fn().mockResolvedValue(undefined);
    closeMock = vi.fn().mockResolvedValue(undefined);
    snapshotMock = vi.fn(() => "snapshot");
    rawOutputMock = vi.fn(() => "");
    exitCodeMock = vi.fn(() => 0);
    eventLogMock = vi.fn(() => []);

    createPtySessionMock.mockReset();
    rmMock.mockClear();
    createPtySessionMock.mockResolvedValue({
      press: pressMock,
      resize: resizeMock,
      waitForText: waitForTextMock,
      waitForExit: waitForExitMock,
      saveSnapshot: saveSnapshotMock,
      flushArtifacts: flushArtifactsMock,
      close: closeMock,
      snapshot: snapshotMock,
      rawOutput: rawOutputMock,
      exitCode: exitCodeMock,
      eventLog: eventLogMock
    });
  });

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  it("maps scenario-friendly actions to PTY keypresses and search input", async () => {
    const { startExplorer } = await import("./explorer");
    const explorer = await startExplorer({
      homeDir,
      skillmuxHome,
      agentId: "codex",
      scenarioName: "explorer-unit"
    });

    await explorer.waitForReady();
    await explorer.focusSkills();
    await explorer.nextRow();
    await explorer.previousRow();
    await explorer.firstRow();
    await explorer.lastRow();
    await explorer.search("alpha");
    await explorer.submitSearch();
    await explorer.closeSearch();
    await explorer.openHelp();
    await explorer.closeOverlay();
    await explorer.toggle();
    await explorer.confirm();
    await explorer.scan();
    await explorer.resize(120, 40);
    await explorer.quit();
    await explorer.waitForExit();
    await explorer.flushArtifacts();
    await explorer.close();

    expect(createPtySessionMock).toHaveBeenCalledWith({
      homeDir,
      skillmuxHome,
      cols: 100,
      rows: 30,
      scenarioName: "explorer-unit"
    });
    expect(waitForTextMock).toHaveBeenCalledWith("Skills for codex", 4000);
    expect(pressMock.mock.calls.map(([value]) => value)).toEqual([
      "\u001b[C",
      "\u001b[B",
      "\u001b[A",
      "g",
      "G",
      "/",
      "alpha",
      "\r",
      "\u001b",
      "?",
      "\u001b",
      " ",
      "y",
      "s",
      "q"
    ]);
    expect(resizeMock).toHaveBeenCalledWith(120, 40);
    expect(waitForExitMock).toHaveBeenCalledTimes(1);
    expect(flushArtifactsMock).toHaveBeenCalledTimes(1);
    expect(closeMock).toHaveBeenCalledTimes(1);
    expect(explorer.snapshot()).toBe("snapshot");
    expect(explorer.exitCode()).toBe(0);
    expect(explorer.eventLog()).toEqual([]);
  });

  it("exposes real filesystem helpers for managed and agent skill paths", async () => {
    const linkPath = join(homeDir, ".codex", "skills", "alpha");
    await fs.symlink(join(skillmuxHome, "skills", "alpha"), linkPath, "junction");

    const { startExplorer } = await import("./explorer");
    const explorer = await startExplorer({
      homeDir,
      skillmuxHome,
      agentId: "codex",
      scenarioName: "explorer-fs-unit"
    });

    expect(explorer.paths.agentSkill("codex", "alpha")).toBe(linkPath);
    expect(explorer.paths.managedSkill("alpha")).toBe(
      join(skillmuxHome, "skills", "alpha")
    );
    await expect(explorer.fs.exists(linkPath)).resolves.toBe(true);
    await expect(explorer.fs.isSymlink(linkPath)).resolves.toBe(true);

    await fs.rm(linkPath, { recursive: true, force: true });

    await expect(explorer.fs.exists(linkPath)).resolves.toBe(false);
    await expect(explorer.fs.readLinkTarget(linkPath)).resolves.toBeNull();
    await explorer.close();
  });

  it("does not depend on the repo PTY lock when the PTY session is mocked", async () => {
    const lockDir = join(process.cwd(), ".artifacts", "tui-e2e", ".pty-lock");
    const { startExplorer } = await import("./explorer");
    const explorer = await startExplorer({
      homeDir,
      skillmuxHome,
      agentId: "codex",
      scenarioName: "explorer-corrupt-lock-unit"
    });

    expect(createPtySessionMock).toHaveBeenCalledTimes(1);
    await explorer.close();
    expect(rmMock).not.toHaveBeenCalledWith(lockDir, expect.anything());
  });
});

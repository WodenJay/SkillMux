import * as fs from "node:fs/promises";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.fn();
const writeSnapshotMock = vi.fn();
const recordEventMock = vi.fn();
const flushMock = vi.fn();
const writeMock = vi.fn();
const resizeMock = vi.fn();
const snapshotMock = vi.fn(() => "");
const screenResizeMock = vi.fn();
const killMock = vi.fn();

let onDataHandler: ((chunk: string) => void) | undefined;
let onExitHandler:
  | ((event: { exitCode: number; signal?: number }) => void)
  | undefined;

vi.mock("node-pty", () => ({
  spawn: spawnMock
}));

vi.mock("./artifacts", () => ({
  createArtifactRecorder: vi.fn(async () => ({
    rootDir: "C:\\artifacts\\pty-session-unit",
    recordEvent: recordEventMock,
    writeSnapshot: writeSnapshotMock,
    flush: flushMock
  }))
}));

vi.mock("./screen", () => ({
  createScreenBuffer: vi.fn(() => ({
    write: writeMock,
    resize: screenResizeMock,
    snapshot: snapshotMock
  }))
}));

describe("createPtySession", () => {
  const lockDir = join(process.cwd(), ".artifacts", "tui-e2e", ".pty-lock");

  beforeEach(() => {
    spawnMock.mockReset();
    writeSnapshotMock.mockReset();
    recordEventMock.mockReset();
    flushMock.mockReset();
    writeMock.mockReset();
    resizeMock.mockReset();
    snapshotMock.mockReset();
    snapshotMock.mockReturnValue("");
    screenResizeMock.mockReset();
    killMock.mockReset();
    onDataHandler = undefined;
    onExitHandler = undefined;

    writeMock.mockResolvedValue(undefined);
    flushMock.mockResolvedValue(undefined);
    writeSnapshotMock.mockResolvedValue(undefined);
    killMock.mockImplementation(() => {
      onExitHandler?.({ exitCode: 0 });
    });

    spawnMock.mockImplementation((_command, _args, _options) => ({
      pid: 4321,
      write: vi.fn(),
      resize: resizeMock,
      kill: killMock,
      onData(handler: (chunk: string) => void) {
        onDataHandler = handler;
      },
      onExit(handler: (event: { exitCode: number; signal?: number }) => void) {
        onExitHandler = handler;
      }
    }));
  });

  it("falls back to xterm TERM, records spawn and exit, and closes the child", async () => {
    const originalTerm = process.env.TERM;
    process.env.TERM = "   ";

    try {
      const { createPtySession } = await import("./pty-session");
      const session = await createPtySession({
        homeDir: "C:\\Users\\wudon\\AppData\\Local\\Temp\\skillmux-home-test",
        skillmuxHome: "C:\\Users\\wudon\\AppData\\Local\\Temp\\skillmux-home-test\\.skillmux",
        cols: 100,
        rows: 30,
        scenarioName: "pty-session-unit"
      });

      expect(spawnMock).toHaveBeenCalledTimes(1);
      expect(spawnMock.mock.calls[0]?.[2]).toMatchObject({
        env: expect.objectContaining({
          TERM: "xterm-256color",
          FORCE_COLOR: "0"
        })
      });

      onDataHandler?.("loading dashboard...");
      await session.close();

      expect(killMock).toHaveBeenCalledTimes(1);
      expect(session.exitCode()).toBe(0);
      expect(session.eventLog()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "spawn", pid: 4321 }),
          expect.objectContaining({ type: "data", size: 20 }),
          expect.objectContaining({ type: "exit", code: 0 })
        ])
      );
    } finally {
      if (originalTerm === undefined) {
        delete process.env.TERM;
      } else {
        process.env.TERM = originalTerm;
      }
    }
  }, 30000);

  it("acquires the PTY lock at session creation, recovers corrupt metadata, and releases it on close", async () => {
    await fs.mkdir(lockDir, { recursive: true });
    await fs.writeFile(join(lockDir, "owner.json"), "{not-json", "utf8");

    const { createPtySession } = await import("./pty-session");
    const session = await createPtySession({
      homeDir: "C:\\Users\\wudon\\AppData\\Local\\Temp\\skillmux-home-test",
      skillmuxHome: "C:\\Users\\wudon\\AppData\\Local\\Temp\\skillmux-home-test\\.skillmux",
      cols: 100,
      rows: 30,
      scenarioName: "pty-session-lock-unit"
    });

    expect(spawnMock).toHaveBeenCalledTimes(1);
    await expect(fs.readFile(join(lockDir, "owner.json"), "utf8")).resolves.toContain(
      `"pid":${process.pid}`
    );

    await session.close();

    await expect(fs.stat(lockDir)).rejects.toMatchObject({ code: "ENOENT" });
  }, 30000);

  it("keeps the PTY lock held when close times out and retries termination on a later close", async () => {
    let killAttempts = 0;
    killMock.mockReset();
    killMock.mockImplementation(() => {
      killAttempts += 1;
      if (killAttempts >= 2) {
        onExitHandler?.({ exitCode: 0 });
      }
    });

    const { createPtySession } = await import("./pty-session");
    const session = await createPtySession({
      homeDir: "C:\\Users\\wudon\\AppData\\Local\\Temp\\skillmux-home-test",
      skillmuxHome: "C:\\Users\\wudon\\AppData\\Local\\Temp\\skillmux-home-test\\.skillmux",
      cols: 100,
      rows: 30,
      scenarioName: "pty-session-close-timeout-unit"
    });

    await expect(session.close(10)).rejects.toThrow("Timed out waiting for process exit");
    expect(killAttempts).toBe(1);
    await expect(fs.readFile(join(lockDir, "owner.json"), "utf8")).resolves.toContain(
      `"pid":${process.pid}`
    );

    await expect(session.close(10)).resolves.toBeUndefined();
    expect(killAttempts).toBe(2);
    await expect(fs.stat(lockDir)).rejects.toMatchObject({ code: "ENOENT" });
  }, 30000);
});

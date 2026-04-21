import * as fs from "node:fs/promises";
import { dirname, join } from "node:path";
import * as pty from "node-pty";
import { createArtifactRecorder, type ArtifactRecorder } from "./artifacts";
import { createScreenBuffer } from "./screen";

type PtySessionEvent =
  | {
      type: "spawn";
      command: string;
      args: string[];
      pid: number;
    }
  | {
      type: "data";
      size: number;
    }
  | {
      type: "keypress";
      key: string;
    }
  | {
      type: "resize";
      cols: number;
      rows: number;
    }
  | {
      type: "exit";
      code: number;
      signal?: number;
    };

export type PtySession = {
  press(data: string): Promise<void>;
  resize(cols: number, rows: number): Promise<void>;
  snapshot(): string;
  saveSnapshot(name: string): Promise<void>;
  waitForText(pattern: string, timeoutMs?: number): Promise<void>;
  waitForExit(timeoutMs?: number): Promise<void>;
  exitCode(): number | null;
  eventLog(): PtySessionEvent[];
  flushArtifacts(): Promise<void>;
  close(timeoutMs?: number): Promise<void>;
};

export async function createPtySession(options: {
  homeDir: string;
  skillmuxHome: string;
  cols: number;
  rows: number;
  scenarioName: string;
}): Promise<PtySession> {
  const releaseLock = await acquirePtyLock();
  const command = process.execPath;
  const args = [join(process.cwd(), "dist", "cli.js"), "tui"];
  const screen = createScreenBuffer({ cols: options.cols, rows: options.rows });
  let artifacts: ArtifactRecorder;
  try {
    artifacts = await createArtifactRecorder({
      scenarioName: options.scenarioName
    });
  } catch (error) {
    await releaseLock();
    throw error;
  }
  const events: PtySessionEvent[] = [];
  let writeQueue = Promise.resolve();
  let exited = false;
  let recordedExitCode: number | null = null;
  let closed = false;
  let closeInFlight: Promise<void> | null = null;

  function record(event: PtySessionEvent): void {
    events.push(event);
    artifacts.recordEvent(event);
  }

  let child: pty.IPty;
  try {
    child = pty.spawn(command, args, {
      cols: options.cols,
      rows: options.rows,
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOME: options.homeDir,
        USERPROFILE: options.homeDir,
        SKILLMUX_HOME: options.skillmuxHome,
        FORCE_COLOR: "0",
        TERM: normalizeTerm(process.env.TERM)
      }
    });
  } catch (error) {
    await releaseLock();
    throw error;
  }

  record({
    type: "spawn",
    command,
    args,
    pid: child.pid
  });

  const exitPromise = new Promise<void>((resolve) => {
    child.onData((chunk) => {
      writeQueue = writeQueue.then(() => screen.write(chunk));
      record({ type: "data", size: chunk.length });
    });

    child.onExit(({ exitCode, signal }) => {
      exited = true;
      recordedExitCode = exitCode;
      record({
        type: "exit",
        code: exitCode,
        signal
      });
      resolve();
    });
  });

  return {
    async press(data) {
      record({ type: "keypress", key: data });
      child.write(data);
      await settle(writeQueue);
    },
    async resize(cols, rows) {
      record({ type: "resize", cols, rows });
      child.resize(cols, rows);
      screen.resize(cols, rows);
      await settle(writeQueue);
    },
    snapshot() {
      return screen.snapshot();
    },
    async saveSnapshot(name) {
      await settle(writeQueue);
      await artifacts.writeSnapshot(name, screen.snapshot());
    },
    async waitForText(pattern, timeoutMs = 4000) {
      const deadline = Date.now() + timeoutMs;

      while (Date.now() < deadline) {
        await settle(writeQueue, 25);
        if (screen.snapshot().includes(pattern)) {
          return;
        }
      }

      throw new Error(`Timed out waiting for text: ${pattern}`);
    },
    async waitForExit(timeoutMs = 4000) {
      if (!exited) {
        await waitForPromise(exitPromise, timeoutMs, "process exit");
      }

      await settle(writeQueue);
    },
    exitCode() {
      return recordedExitCode;
    },
    eventLog() {
      return [...events];
    },
    async flushArtifacts() {
      await settle(writeQueue);
      await artifacts.flush();
    },
    async close(timeoutMs = 4000) {
      if (closed) {
        await settle(writeQueue);
        return;
      }

      if (closeInFlight !== null) {
        return closeInFlight;
      }

      closeInFlight = (async () => {
        if (!exited) {
          child.kill();
          await waitForPromise(exitPromise, timeoutMs, "process exit");
        }

        await settle(writeQueue);
        await releaseLock();
        closed = true;
      })();

      try {
        await closeInFlight;
      } finally {
        if (!closed) {
          closeInFlight = null;
        }
      }
    }
  };
}

const ptyLockDir = join(process.cwd(), ".artifacts", "tui-e2e", ".pty-lock");
const ptyLockOwnerFile = join(ptyLockDir, "owner.json");

async function acquirePtyLock(timeoutMs = 30000): Promise<() => Promise<void>> {
  const deadline = Date.now() + timeoutMs;
  await fs.mkdir(dirname(ptyLockDir), { recursive: true });

  while (true) {
    try {
      await fs.mkdir(ptyLockDir);
      await fs.writeFile(
        ptyLockOwnerFile,
        JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }),
        "utf8"
      );
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }

      if (await clearStalePtyLock()) {
        continue;
      }

      if (Date.now() >= deadline) {
        throw new Error("Timed out waiting for PTY session lock");
      }

      await sleep(100);
    }
  }

  let released = false;

  return async () => {
    if (released) {
      return;
    }

    released = true;
    await fs.rm(ptyLockDir, { recursive: true, force: true });
  };
}

async function clearStalePtyLock(): Promise<boolean> {
  const owner = await readPtyLockOwner();
  if (owner !== "unknown" && owner !== null && isProcessAlive(owner.pid)) {
    return false;
  }

  if (owner === "unknown" || owner !== null || (await lockLooksAbandoned())) {
    await fs.rm(ptyLockDir, { recursive: true, force: true });
    return true;
  }

  return false;
}

async function readPtyLockOwner(): Promise<{ pid: number } | "unknown" | null> {
  try {
    const value = await fs.readFile(ptyLockOwnerFile, "utf8");
    let parsed: { pid?: unknown };

    try {
      parsed = JSON.parse(value) as { pid?: unknown };
    } catch {
      return "unknown";
    }

    return typeof parsed.pid === "number" ? { pid: parsed.pid } : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function lockLooksAbandoned(): Promise<boolean> {
  try {
    const stats = await fs.stat(ptyLockDir);
    return Date.now() - stats.mtimeMs > 500;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

function normalizeTerm(term: string | undefined): string {
  return term?.trim() ? term : "xterm-256color";
}

async function settle(pendingWrites: Promise<void>, delayMs = 50): Promise<void> {
  await sleep(delayMs);
  await pendingWrites;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPromise<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Timed out waiting for ${label}`));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

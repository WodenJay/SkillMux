import * as fs from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  createPtySession,
  type PtySession
} from "./pty-session";

const keymap = {
  left: "\u001b[D",
  right: "\u001b[C",
  up: "\u001b[A",
  down: "\u001b[B",
  enter: "\r",
  escape: "\u001b",
  ctrlC: "\u0003"
} as const;

export type StartExplorerOptions = {
  homeDir: string;
  skillmuxHome: string;
  agentId: string;
  scenarioName: string;
  cols?: number;
  rows?: number;
};

export type TuiExplorer = {
  waitForReady(timeoutMs?: number): Promise<void>;
  waitForText(pattern: string, timeoutMs?: number): Promise<void>;
  focusSkills(): Promise<void>;
  focusAgents(): Promise<void>;
  nextRow(): Promise<void>;
  nextRowBy(mode?: "arrow" | "j"): Promise<void>;
  previousRow(): Promise<void>;
  previousRowBy(mode?: "arrow" | "k"): Promise<void>;
  firstRow(): Promise<void>;
  lastRow(): Promise<void>;
  search(query: string): Promise<void>;
  submitSearch(): Promise<void>;
  closeSearch(): Promise<void>;
  openHelp(): Promise<void>;
  closeOverlay(): Promise<void>;
  toggle(): Promise<void>;
  adopt(): Promise<void>;
  remove(): Promise<void>;
  scan(): Promise<void>;
  confirm(): Promise<void>;
  resize(cols: number, rows: number): Promise<void>;
  snapshot(): string;
  saveSnapshot(name: string): Promise<void>;
  waitForExit(timeoutMs?: number): Promise<void>;
  quit(): Promise<void>;
  forceQuit(): Promise<void>;
  exitCode(): number | null;
  eventLog(): ReturnType<PtySession["eventLog"]>;
  flushArtifacts(): Promise<void>;
  close(timeoutMs?: number): Promise<void>;
  paths: {
    managedSkill(skillName: string): string;
    agentSkill(agentId: string, skillName: string): string;
  };
  fs: {
    exists(path: string): Promise<boolean>;
    isSymlink(path: string): Promise<boolean>;
    readLinkTarget(path: string): Promise<string | null>;
  };
};

export async function startExplorer(
  options: StartExplorerOptions
): Promise<TuiExplorer> {
  const releaseLock = await acquireExplorerLock();
  let session: PtySession | null = null;

  try {
    session = await createPtySession({
      homeDir: options.homeDir,
      skillmuxHome: options.skillmuxHome,
      cols: options.cols ?? 100,
      rows: options.rows ?? 30,
      scenarioName: options.scenarioName
    });
  } catch (error) {
    await releaseLock();
    throw error;
  }

  const paths = {
    managedSkill(skillName: string) {
      return join(options.skillmuxHome, "skills", skillName);
    },
    agentSkill(agentId: string, skillName: string) {
      return join(options.homeDir, `.${agentId}`, "skills", skillName);
    }
  };

  const explorer: TuiExplorer = {
    async waitForReady(timeoutMs = 4000) {
      await session.waitForText(`Skills for ${options.agentId}`, timeoutMs);
    },
    waitForText(pattern, timeoutMs) {
      return session.waitForText(pattern, timeoutMs);
    },
    focusSkills() {
      return session.press(keymap.right);
    },
    focusAgents() {
      return session.press(keymap.left);
    },
    nextRow() {
      return explorer.nextRowBy("arrow");
    },
    nextRowBy(mode = "arrow") {
      return session.press(mode === "j" ? "j" : keymap.down);
    },
    previousRow() {
      return explorer.previousRowBy("arrow");
    },
    previousRowBy(mode = "arrow") {
      return session.press(mode === "k" ? "k" : keymap.up);
    },
    firstRow() {
      return session.press("g");
    },
    lastRow() {
      return session.press("G");
    },
    async search(query) {
      await session.press("/");

      if (query.length > 0) {
        await session.press(query);
      }
    },
    submitSearch() {
      return session.press(keymap.enter);
    },
    closeSearch() {
      return session.press(keymap.escape);
    },
    openHelp() {
      return session.press("?");
    },
    closeOverlay() {
      return session.press(keymap.escape);
    },
    toggle() {
      return session.press(" ");
    },
    adopt() {
      return session.press("a");
    },
    remove() {
      return session.press("r");
    },
    scan() {
      return session.press("s");
    },
    confirm() {
      return session.press("y");
    },
    resize(cols, rows) {
      return session.resize(cols, rows);
    },
    snapshot() {
      return session.snapshot();
    },
    saveSnapshot(name) {
      return session.saveSnapshot(name);
    },
    waitForExit(timeoutMs) {
      return session.waitForExit(timeoutMs);
    },
    quit() {
      return session.press("q");
    },
    forceQuit() {
      return session.press(keymap.ctrlC);
    },
    exitCode() {
      return session.exitCode();
    },
    eventLog() {
      return session.eventLog();
    },
    flushArtifacts() {
      return session.flushArtifacts();
    },
    close(timeoutMs) {
      return closeExplorer(session, releaseLock, timeoutMs);
    },
    paths,
    fs: {
      async exists(path) {
        try {
          await fs.lstat(path);
          return true;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return false;
          }

          throw error;
        }
      },
      async isSymlink(path) {
        try {
          return (await fs.lstat(path)).isSymbolicLink();
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return false;
          }

          throw error;
        }
      },
      async readLinkTarget(path) {
        try {
          const entry = await fs.lstat(path);
          if (!entry.isSymbolicLink()) {
            return null;
          }

          return await fs.realpath(path);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return null;
          }

          throw error;
        }
      }
    }
  };

  return explorer;
}

const explorerLockDir = join(process.cwd(), ".artifacts", "tui-e2e", ".pty-lock");
const explorerLockOwnerFile = join(explorerLockDir, "owner.json");

async function acquireExplorerLock(timeoutMs = 15000): Promise<() => Promise<void>> {
  const deadline = Date.now() + timeoutMs;
  await fs.mkdir(dirname(explorerLockDir), { recursive: true });

  while (true) {
    try {
      await fs.mkdir(explorerLockDir);
      await fs.writeFile(
        explorerLockOwnerFile,
        JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }),
        "utf8"
      );
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }

      if (await clearStaleExplorerLock()) {
        continue;
      }

      if (Date.now() >= deadline) {
        throw new Error("Timed out waiting for PTY explorer lock");
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
    await fs.rm(explorerLockDir, { recursive: true, force: true });
  };
}

async function closeExplorer(
  session: PtySession,
  releaseLock: () => Promise<void>,
  timeoutMs?: number
): Promise<void> {
  try {
    await session.close(timeoutMs);
  } finally {
    await releaseLock();
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function clearStaleExplorerLock(): Promise<boolean> {
  const owner = await readExplorerLockOwner();
  if (owner !== "unknown" && owner !== null && isProcessAlive(owner.pid)) {
    return false;
  }

  if (owner === "unknown" || owner !== null || (await lockLooksAbandoned())) {
    await fs.rm(explorerLockDir, { recursive: true, force: true });
    return true;
  }

  return false;
}

async function readExplorerLockOwner(): Promise<{ pid: number } | "unknown" | null> {
  try {
    const value = await fs.readFile(explorerLockOwnerFile, "utf8");
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
    const stats = await fs.stat(explorerLockDir);
    return Date.now() - stats.mtimeMs > 500;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

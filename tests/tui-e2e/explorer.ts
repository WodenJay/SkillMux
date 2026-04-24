import * as fs from "node:fs/promises";
import { join } from "node:path";
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
  traceLifecycle?: boolean;
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
  bulkAdopt(): Promise<void>;
  remove(): Promise<void>;
  scan(): Promise<void>;
  confirm(): Promise<void>;
  resize(cols: number, rows: number): Promise<void>;
  snapshot(): string;
  rawOutput(): string;
  saveSnapshot(name: string): Promise<void>;
  waitForExit(timeoutMs?: number): Promise<void>;
  quit(): Promise<void>;
  forceQuit(): Promise<void>;
  openAddAgent(): Promise<void>;
  openEditAgent(): Promise<void>;
  openRemoveAgent(): Promise<void>;
  openImport(): Promise<void>;
  openDoctor(): Promise<void>;
  typeText(value: string): Promise<void>;
  backspace(): Promise<void>;
  submitForm(): Promise<void>;
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
  const session = await createPtySession({
    homeDir: options.homeDir,
    skillmuxHome: options.skillmuxHome,
    cols: options.cols ?? 100,
    rows: options.rows ?? 30,
    scenarioName: options.scenarioName,
    ...(options.traceLifecycle === true ? { traceLifecycle: true } : {})
  });

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
    bulkAdopt() {
      return session.press("A");
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
    rawOutput() {
      return session.rawOutput();
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
    openAddAgent() {
      return session.press("n");
    },
    openEditAgent() {
      return session.press("e");
    },
    openRemoveAgent() {
      return session.press("X");
    },
    openImport() {
      return session.press("i");
    },
    openDoctor() {
      return session.press("d");
    },
    backspace() {
      return session.press("\x7f");
    },
    submitForm() {
      return session.press(keymap.enter);
    },
    async typeText(value) {
      for (const char of value) {
        await session.press(char);
      }
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
      return session.close(timeoutMs);
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

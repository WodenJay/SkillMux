import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { resolveSkillmuxHome } from "../../src/config/resolve-skillmux-home";

export function createTempHomeDir(): string {
  return mkdtempSync(join(tmpdir(), "skillmux-home-"));
}

export function cleanupTempHomeDir(homeDir: string): void {
  rmSync(homeDir, { recursive: true, force: true });
}

export function writeJsonFile(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function writeSkillmuxConfig(homeDir: string, value: unknown): void {
  const { configPath } = resolveSkillmuxHome(homeDir);
  writeJsonFile(configPath, value);
}

export function ensureDirectory(path: string): void {
  mkdirSync(path, { recursive: true });
}

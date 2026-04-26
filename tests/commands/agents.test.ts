import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runAgents } from "../../src/commands/agents";
import { cleanupTempHomeDir, createTempHomeDir, writeSkillmuxConfig } from "../helpers/temp-env";

const tempHomeDirs: string[] = [];

afterEach(() => {
  while (tempHomeDirs.length > 0) {
    cleanupTempHomeDir(tempHomeDirs.pop() as string);
  }
});

describe("runAgents", () => {
  it("shows auto-discovered agents with discovery=auto in table output", async () => {
    const homeDir = createTempHomeDir();
    tempHomeDirs.push(homeDir);

    mkdirSync(join(homeDir, ".autofound", "skills"), { recursive: true });
    mkdirSync(join(homeDir, ".claude", "skills"), { recursive: true });
    mkdirSync(join(homeDir, ".gemini", "skills"), { recursive: true });
    mkdirSync(join(homeDir, ".agents", "skills"), { recursive: true });
    mkdirSync(join(homeDir, ".openclaw", "skills"), { recursive: true });

    writeSkillmuxConfig(homeDir, {
      version: 1,
      agents: {},
      autoDiscover: { lastRunAt: null, intervalMs: 0 },
      removedAutoAgentIds: []
    });

    const result = await runAgents({
      homeDir,
      platform: "win32"
    });

    const tableLines = result.output.split("\n").filter((line) => line.includes("autofound"));
    expect(tableLines.length).toBeGreaterThan(0);
    expect(tableLines[0]).toMatch(/auto/);
  });

  it("shows built-in agents with discovery=builtin in table output", async () => {
    const homeDir = createTempHomeDir();
    tempHomeDirs.push(homeDir);

    mkdirSync(join(homeDir, ".codex", "skills"), { recursive: true });

    writeSkillmuxConfig(homeDir, {
      version: 1,
      agents: {},
      autoDiscover: { lastRunAt: new Date().toISOString(), intervalMs: 3600000 },
      removedAutoAgentIds: []
    });

    const result = await runAgents({
      homeDir,
      platform: "win32"
    });

    const tableLines = result.output.split("\n").filter((line) => line.includes("codex"));
    expect(tableLines.length).toBeGreaterThan(0);
    expect(tableLines[0]).toMatch(/builtin/);
  });

  it("outputs agents as JSON when json flag is set", async () => {
    const homeDir = createTempHomeDir();
    tempHomeDirs.push(homeDir);

    mkdirSync(join(homeDir, ".codex", "skills"), { recursive: true });

    writeSkillmuxConfig(homeDir, {
      version: 1,
      agents: {},
      autoDiscover: { lastRunAt: new Date().toISOString(), intervalMs: 3600000 },
      removedAutoAgentIds: []
    });

    const result = await runAgents({
      homeDir,
      platform: "win32",
      json: true
    });

    const parsed = JSON.parse(result.output) as Array<{ id: string; discovery: string }>;
    const codex = parsed.find((a) => a.id === "codex");
    expect(codex).toBeDefined();
    expect(codex?.discovery).toBe("builtin");
  });
});

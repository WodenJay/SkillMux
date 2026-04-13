import * as fs from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCli } from "../../src/index";
import { runConfig } from "../../src/commands/config";
import { runConfigAddAgent } from "../../src/commands/config-add-agent";
import { cleanupTempHomeDir, createTempHomeDir, writeSkillmuxConfig } from "../helpers/temp-env";

const tempHomeDirs: string[] = [];

afterEach(() => {
  while (tempHomeDirs.length > 0) {
    cleanupTempHomeDir(tempHomeDirs.pop() as string);
  }
});

describe("runConfigAddAgent", () => {
  it("creates a new agent override in an empty config", async () => {
    const homeDir = createTempHomeDir();
    tempHomeDirs.push(homeDir);

    const result = await runConfigAddAgent({
      homeDir,
      id: "antigravity",
      root: ".gemini/antigravity",
      name: "Gemini Antigravity"
    });

    expect(result.changed).toBe(true);
    expect(result.config.agents.antigravity).toEqual({
      stableName: "Gemini Antigravity",
      supportedPlatforms: [process.platform],
      homeRelativeRootPath: ".gemini/antigravity",
      skillsDirectoryPath: "skills"
    });

    const written = JSON.parse(
      await fs.readFile(join(homeDir, ".skillmux", "config.json"), "utf8")
    ) as {
      agents: Record<string, unknown>;
    };

    expect(written.agents.antigravity).toEqual(result.config.agents.antigravity);
  });

  it("overwrites an existing agent override and preserves other entries", async () => {
    const homeDir = createTempHomeDir();
    tempHomeDirs.push(homeDir);

    writeSkillmuxConfig(homeDir, {
      version: 1,
      agents: {
        codex: {
          stableName: "Codex",
          supportedPlatforms: ["win32", "linux"],
          homeRelativeRootPath: ".codex",
          skillsDirectoryPath: "skills"
        },
        antigravity: {
          stableName: "Old Name",
          supportedPlatforms: ["win32"],
          homeRelativeRootPath: ".gemini/old-antigravity",
          skillsDirectoryPath: "old-skills"
        }
      }
    });

    const result = await runConfigAddAgent({
      homeDir,
      id: "antigravity",
      root: ".gemini/antigravity",
      skills: "custom-skills",
      platforms: ["darwin"],
      disabledByDefault: true
    });

    expect(result.config.agents.codex).toEqual({
      stableName: "Codex",
      supportedPlatforms: ["win32", "linux"],
      homeRelativeRootPath: ".codex",
      skillsDirectoryPath: "skills"
    });
    expect(result.config.agents.antigravity).toEqual({
      supportedPlatforms: ["darwin"],
      homeRelativeRootPath: ".gemini/antigravity",
      skillsDirectoryPath: "custom-skills",
      enabledByDefault: false
    });
  });

  it("rejects absolute root and skills paths", async () => {
    const homeDir = createTempHomeDir();
    tempHomeDirs.push(homeDir);

    await expect(
      runConfigAddAgent({
        homeDir,
        id: "antigravity",
        root: "C:/Users/wudon/.gemini/antigravity"
      })
    ).rejects.toThrow(/must be a relative path/i);

    await expect(
      runConfigAddAgent({
        homeDir,
        id: "antigravity",
        root: ".gemini/antigravity",
        skills: "C:/Users/wudon/skills"
      })
    ).rejects.toThrow(/must be a relative path/i);
  });

  it("shows the persisted override through the read-only config command", async () => {
    const homeDir = createTempHomeDir();
    tempHomeDirs.push(homeDir);

    await runConfigAddAgent({
      homeDir,
      id: "antigravity",
      root: ".gemini/antigravity"
    });

    const result = await runConfig({
      homeDir,
      json: true
    });

    const parsed = JSON.parse(result.output) as {
      config: {
        agents: Record<string, { homeRelativeRootPath: string; skillsDirectoryPath: string }>;
      };
    };

    expect(parsed.config.agents.antigravity).toEqual({
      supportedPlatforms: [process.platform],
      homeRelativeRootPath: ".gemini/antigravity",
      skillsDirectoryPath: "skills"
    });
  });
});

describe("CLI config add-agent", () => {
  it("writes the agent override through the public CLI surface", async () => {
    const homeDir = createTempHomeDir();
    tempHomeDirs.push(homeDir);
    const previousHome = process.env.HOME;
    const previousUserProfile = process.env.USERPROFILE;
    const previousHomeDrive = process.env.HOMEDRIVE;
    const previousHomePath = process.env.HOMEPATH;

    process.env.HOME = homeDir;
    process.env.USERPROFILE = homeDir;
    process.env.HOMEDRIVE = undefined;
    process.env.HOMEPATH = undefined;

    const cli = buildCli();
    cli.exitOverride();
    const stdoutWrite = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    try {
      await cli.parseAsync(
        [
          "node",
          "skillmux",
          "config",
          "add-agent",
          "--id",
          "antigravity",
          "--root",
          ".gemini/antigravity",
          "--name",
          "Gemini Antigravity"
        ],
        { from: "node" }
      );
    } finally {
      stdoutWrite.mockRestore();
      process.env.HOME = previousHome;
      process.env.USERPROFILE = previousUserProfile;
      process.env.HOMEDRIVE = previousHomeDrive;
      process.env.HOMEPATH = previousHomePath;
    }

    const written = JSON.parse(
      await fs.readFile(join(homeDir, ".skillmux", "config.json"), "utf8")
    ) as {
      agents: Record<string, { stableName: string }>;
    };

    expect(written.agents.antigravity.stableName).toBe("Gemini Antigravity");
  });
});

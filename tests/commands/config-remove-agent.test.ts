import * as fs from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runConfig } from "../../src/commands/config";
import { runConfigRemoveAgent } from "../../src/commands/config-remove-agent";
import { buildCli } from "../../src/index";
import { cleanupTempHomeDir, createTempHomeDir, writeSkillmuxConfig } from "../helpers/temp-env";

const tempHomeDirs: string[] = [];

afterEach(() => {
  while (tempHomeDirs.length > 0) {
    cleanupTempHomeDir(tempHomeDirs.pop() as string);
  }
});

describe("runConfigRemoveAgent", () => {
  it("removes an existing agent override and preserves the other entries", async () => {
    const homeDir = createTempHomeDir();
    tempHomeDirs.push(homeDir);

    writeSkillmuxConfig(homeDir, {
      version: 1,
      agents: {
        codex: {
          stableName: "Codex",
          supportedPlatforms: ["win32"],
          homeRelativeRootPath: ".codex",
          skillsDirectoryPath: "skills"
        },
        antigravity: {
          stableName: "Gemini Antigravity",
          supportedPlatforms: ["win32"],
          homeRelativeRootPath: ".gemini/antigravity",
          skillsDirectoryPath: "skills"
        }
      }
    });

    const result = await runConfigRemoveAgent({
      homeDir,
      id: "antigravity"
    });

    expect(result.changed).toBe(true);
    expect(result.removed).toBe(true);
    expect(result.config.agents.antigravity).toBeUndefined();
    expect(result.config.agents.codex).toEqual({
      stableName: "Codex",
      supportedPlatforms: ["win32"],
      homeRelativeRootPath: ".codex",
      skillsDirectoryPath: "skills"
    });
  });

  it("is idempotent when the agent override does not exist", async () => {
    const homeDir = createTempHomeDir();
    tempHomeDirs.push(homeDir);

    writeSkillmuxConfig(homeDir, {
      version: 1,
      agents: {
        codex: {
          stableName: "Codex",
          supportedPlatforms: ["win32"],
          homeRelativeRootPath: ".codex",
          skillsDirectoryPath: "skills"
        }
      }
    });

    const result = await runConfigRemoveAgent({
      homeDir,
      id: "antigravity"
    });

    expect(result.changed).toBe(false);
    expect(result.removed).toBe(false);
    expect(result.config.agents.codex).toEqual({
      stableName: "Codex",
      supportedPlatforms: ["win32"],
      homeRelativeRootPath: ".codex",
      skillsDirectoryPath: "skills"
    });
  });

  it("shows the removed override through the read-only config command", async () => {
    const homeDir = createTempHomeDir();
    tempHomeDirs.push(homeDir);

    writeSkillmuxConfig(homeDir, {
      version: 1,
      agents: {
        antigravity: {
          supportedPlatforms: ["win32"],
          homeRelativeRootPath: ".gemini/antigravity",
          skillsDirectoryPath: "skills"
        }
      }
    });

    await runConfigRemoveAgent({
      homeDir,
      id: "antigravity"
    });

    const result = await runConfig({
      homeDir,
      json: true
    });

    const parsed = JSON.parse(result.output) as {
      config: {
        agents: Record<string, unknown>;
      };
    };

    expect(parsed.config.agents).toEqual({});
  });
});

describe("CLI config remove-agent", () => {
  it("removes the agent override through the public CLI surface", async () => {
    const homeDir = createTempHomeDir();
    tempHomeDirs.push(homeDir);
    writeSkillmuxConfig(homeDir, {
      version: 1,
      agents: {
        antigravity: {
          stableName: "Gemini Antigravity",
          supportedPlatforms: ["win32"],
          homeRelativeRootPath: ".gemini/antigravity",
          skillsDirectoryPath: "skills"
        }
      }
    });

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
          "remove-agent",
          "--id",
          "antigravity"
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
      agents: Record<string, unknown>;
    };

    expect(written.agents.antigravity).toBeUndefined();
  });
});

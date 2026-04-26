import * as fs from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runConfig } from "../../src/commands/config";
import { runConfigUpdateAgent } from "../../src/commands/config-update-agent";
import { buildCli } from "../../src/index";
import { cleanupTempHomeDir, createTempHomeDir, writeSkillmuxConfig } from "../helpers/temp-env";

const tempHomeDirs: string[] = [];

afterEach(() => {
  while (tempHomeDirs.length > 0) {
    cleanupTempHomeDir(tempHomeDirs.pop() as string);
  }
});

describe("runConfigUpdateAgent", () => {
  it("updates one existing agent override without deleting unspecified fields", async () => {
    const homeDir = createTempHomeDir();
    tempHomeDirs.push(homeDir);

    writeSkillmuxConfig(homeDir, {
      version: 1,
      agents: {
        codex: {
          stableName: "Codex",
          supportedPlatforms: ["linux"],
          homeRelativeRootPath: ".codex",
          skillsDirectoryPath: "skills"
        },
        antigravity: {
          stableName: "Old Name",
          supportedPlatforms: ["win32"],
          homeRelativeRootPath: ".gemini/antigravity",
          skillsDirectoryPath: "custom-skills",
          enabledByDefault: false
        }
      }
    });

    const result = await runConfigUpdateAgent({
      homeDir,
      id: "antigravity",
      name: "Updated Name"
    });

    expect(result.changed).toBe(true);
    expect(result.agent).toEqual({
      stableName: "Updated Name",
      supportedPlatforms: ["win32"],
      homeRelativeRootPath: ".gemini/antigravity",
      skillsDirectoryPath: "custom-skills",
      enabledByDefault: false
    });
    expect(result.config.agents.codex).toEqual({
      stableName: "Codex",
      supportedPlatforms: ["linux"],
      homeRelativeRootPath: ".codex",
      skillsDirectoryPath: "skills"
    });
  });

  it("rejects updates for a missing agent override", async () => {
    const homeDir = createTempHomeDir();
    tempHomeDirs.push(homeDir);

    writeSkillmuxConfig(homeDir, {
      version: 1,
      agents: {}
    });

    await expect(
      runConfigUpdateAgent({
        homeDir,
        id: "antigravity",
        name: "Updated Name"
      })
    ).rejects.toThrow(/does not exist/i);
  });

  it("clears autoDiscovered flag when an auto-discovered agent is updated", async () => {
    const homeDir = createTempHomeDir();
    tempHomeDirs.push(homeDir);

    writeSkillmuxConfig(homeDir, {
      version: 1,
      agents: {
        autofound: {
          stableName: "Autofound",
          homeRelativeRootPath: ".autofound",
          skillsDirectoryPath: "skills",
          enabledByDefault: true,
          autoDiscovered: true
        }
      },
      autoDiscover: { lastRunAt: null, intervalMs: 3600000 },
      removedAutoAgentIds: []
    });

    const result = await runConfigUpdateAgent({
      homeDir,
      id: "autofound",
      name: "Manual Name"
    });

    expect(result.changed).toBe(true);
    expect(result.agent).toMatchObject({
      stableName: "Manual Name",
      homeRelativeRootPath: ".autofound",
      skillsDirectoryPath: "skills",
      enabledByDefault: true
    });
    expect(result.agent).not.toHaveProperty("autoDiscovered");
    expect(result.config.agents.autofound).not.toHaveProperty("autoDiscovered");
  });

  it("reuses add-agent path and platform validation", async () => {
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

    await expect(
      runConfigUpdateAgent({
        homeDir,
        id: "antigravity",
        root: "C:/Users/wudon/.gemini/antigravity"
      })
    ).rejects.toThrow(/must be a relative path/i);

    await expect(
      runConfigUpdateAgent({
        homeDir,
        id: "antigravity",
        platforms: ["plan9"]
      })
    ).rejects.toThrow(/platform must be one of/i);
  });

  it("shows the updated override through the read-only config command", async () => {
    const homeDir = createTempHomeDir();
    tempHomeDirs.push(homeDir);

    writeSkillmuxConfig(homeDir, {
      version: 1,
      agents: {
        antigravity: {
          stableName: "Old Name",
          supportedPlatforms: ["win32"],
          homeRelativeRootPath: ".gemini/antigravity",
          skillsDirectoryPath: "skills"
        }
      }
    });

    await runConfigUpdateAgent({
      homeDir,
      id: "antigravity",
      name: "Updated Name"
    });

    const result = await runConfig({
      homeDir,
      json: true
    });

    const parsed = JSON.parse(result.output) as {
      config: {
        agents: Record<string, { stableName: string }>;
      };
    };

    expect(parsed.config.agents.antigravity.stableName).toBe("Updated Name");
  });
});

describe("CLI config update-agent", () => {
  it("updates the agent override through the public CLI surface", async () => {
    const homeDir = createTempHomeDir();
    tempHomeDirs.push(homeDir);
    writeSkillmuxConfig(homeDir, {
      version: 1,
      agents: {
        antigravity: {
          stableName: "Old Name",
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
          "update-agent",
          "--id",
          "antigravity",
          "--name",
          "Updated Name",
          "--skills",
          "custom-skills"
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
      agents: Record<string, { stableName: string; skillsDirectoryPath: string }>;
    };

    expect(written.agents.antigravity.stableName).toBe("Updated Name");
    expect(written.agents.antigravity.skillsDirectoryPath).toBe("custom-skills");
  });

  it("sets enabledByDefault to true through --enabled-by-default", async () => {
    const homeDir = createTempHomeDir();
    tempHomeDirs.push(homeDir);
    writeSkillmuxConfig(homeDir, {
      version: 1,
      agents: {
        antigravity: {
          stableName: "Gemini Antigravity",
          supportedPlatforms: ["win32"],
          homeRelativeRootPath: ".gemini/antigravity",
          skillsDirectoryPath: "skills",
          enabledByDefault: false
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
          "update-agent",
          "--id",
          "antigravity",
          "--enabled-by-default"
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
      agents: Record<string, { enabledByDefault: boolean }>;
    };

    expect(written.agents.antigravity.enabledByDefault).toBe(true);
  });

  it("sets enabledByDefault to false through --disabled-by-default", async () => {
    const homeDir = createTempHomeDir();
    tempHomeDirs.push(homeDir);
    writeSkillmuxConfig(homeDir, {
      version: 1,
      agents: {
        antigravity: {
          stableName: "Gemini Antigravity",
          supportedPlatforms: ["win32"],
          homeRelativeRootPath: ".gemini/antigravity",
          skillsDirectoryPath: "skills",
          enabledByDefault: true
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
          "update-agent",
          "--id",
          "antigravity",
          "--disabled-by-default"
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
      agents: Record<string, { enabledByDefault: boolean }>;
    };

    expect(written.agents.antigravity.enabledByDefault).toBe(false);
  });

  it("rejects conflicting default-state flags without writing partial config", async () => {
    const homeDir = createTempHomeDir();
    tempHomeDirs.push(homeDir);
    const originalConfig = {
      version: 1 as const,
      agents: {
        antigravity: {
          stableName: "Gemini Antigravity",
          supportedPlatforms: ["win32" as const],
          homeRelativeRootPath: ".gemini/antigravity",
          skillsDirectoryPath: "skills",
          enabledByDefault: false
        }
      }
    };
    writeSkillmuxConfig(homeDir, originalConfig);

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
      await expect(
        cli.parseAsync(
          [
            "node",
            "skillmux",
            "config",
            "update-agent",
            "--id",
            "antigravity",
            "--enabled-by-default",
            "--disabled-by-default"
          ],
          { from: "node" }
        )
      ).rejects.toThrow(/cannot both be set/i);
    } finally {
      stdoutWrite.mockRestore();
      process.env.HOME = previousHome;
      process.env.USERPROFILE = previousUserProfile;
      process.env.HOMEDRIVE = previousHomeDrive;
      process.env.HOMEPATH = previousHomePath;
    }

    const written = JSON.parse(
      await fs.readFile(join(homeDir, ".skillmux", "config.json"), "utf8")
    );

    expect(written).toEqual(originalConfig);
  });
});

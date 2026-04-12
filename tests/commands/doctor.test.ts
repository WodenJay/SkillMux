import * as fs from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runConfig } from "../../src/commands/config";
import { runDoctor } from "../../src/commands/doctor";
import { runImport } from "../../src/commands/import";
import {
  cleanupTempHomeDir,
  createTempHomeDir,
  writeJsonFile,
  writeSkillmuxConfig
} from "../helpers/temp-env";
import { createAgentFixture, type AgentFixture } from "../helpers/create-agent-fixture";

const fixtures: AgentFixture[] = [];
const tempHomeDirs: string[] = [];

afterEach(() => {
  fixtures.splice(0).forEach((fixture) => fixture.cleanup());
  tempHomeDirs.splice(0).forEach((homeDir) => cleanupTempHomeDir(homeDir));
});

describe("runDoctor", () => {
  it("reports broken links, missing managed skills, unmanaged skill directories, and conflicting agent paths", async () => {
    const fixture = await createAgentFixture();
    fixtures.push(fixture);

    const skillSourcePath = join(fixture.homeDir, "skill-sources", "doctor-skill");
    await fs.mkdir(skillSourcePath, { recursive: true });
    await fs.writeFile(join(skillSourcePath, "SKILL.md"), "# Doctor Skill\n", "utf8");

    const imported = await runImport({
      homeDir: fixture.homeDir,
      sourcePath: skillSourcePath,
      skillName: "doctor-skill",
      now: new Date("2026-04-12T11:00:00.000Z")
    });

    await fs.rm(imported.skill.path, { recursive: true, force: true });

    writeSkillmuxConfig(fixture.homeDir, {
      version: 1,
      agents: {
        "mirror-codex": {
          homeRelativeRootPath: ".codex",
          skillsDirectoryPath: "skills"
        }
      }
    });

    const result = await runDoctor({
      homeDir: fixture.homeDir,
      platform: "win32",
      json: true
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "broken-link",
          path: join(fixture.homeDir, ".claude", "skills", "broken-skill")
        }),
        expect.objectContaining({
          code: "unmanaged-skill-directory",
          path: join(fixture.homeDir, ".claude", "skills", "local-draft")
        }),
        expect.objectContaining({
          code: "missing-managed-skill-path",
          path: imported.skill.path
        }),
        expect.objectContaining({
          code: "conflicting-agent-path",
          path: join(fixture.homeDir, ".codex", "skills")
        })
      ])
    );

    const parsed = JSON.parse(result.output) as {
      issues: Array<{ code: string }>;
    };
    expect(parsed.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "broken-link" }),
        expect.objectContaining({ code: "missing-managed-skill-path" })
      ])
    );
  });
});

describe("runConfig", () => {
  it("shows the resolved config and path as json", async () => {
    const homeDir = createTempHomeDir();
    tempHomeDirs.push(homeDir);

    writeSkillmuxConfig(homeDir, {
      version: 1,
      agents: {
        custom: {
          stableName: "Custom Agent",
          supportedPlatforms: ["win32"],
          homeRelativeRootPath: ".custom-agent",
          skillsDirectoryPath: "skills"
        }
      }
    });

    const result = await runConfig({
      homeDir,
      json: true
    });

    const parsed = JSON.parse(result.output) as {
      configPath: string;
      config: {
        version: number;
        agents: Record<string, { stableName: string }>;
      };
    };

    expect(parsed.config.version).toBe(1);
    expect(parsed.config.agents.custom.stableName).toBe("Custom Agent");
    expect(parsed.configPath).toBe(join(homeDir, ".skillmux", "config.json"));
  });

  it("fails validation when the override file is malformed", async () => {
    const homeDir = createTempHomeDir();
    tempHomeDirs.push(homeDir);

    writeJsonFile(join(homeDir, ".skillmux", "config.json"), {
      version: 2,
      agents: {}
    });

    await expect(
      runConfig({
        homeDir,
        json: true
      })
    ).rejects.toThrow(/Invalid config/);
  });
});

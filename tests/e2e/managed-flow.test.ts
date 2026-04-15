import * as fs from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runAdopt } from "../../src/commands/adopt";
import { runDisable } from "../../src/commands/disable";
import { runDoctor } from "../../src/commands/doctor";
import { runEnable } from "../../src/commands/enable";
import { runImport } from "../../src/commands/import";
import { runList } from "../../src/commands/list";
import { runScan } from "../../src/commands/scan";
import { buildCli } from "../../src/index";
import { readManifest } from "../../src/manifest/read-manifest";
import { cleanupTempHomeDir, createTempHomeDir, ensureDirectory } from "../helpers/temp-env";

const directoryLinkType = process.platform === "win32" ? "junction" : "dir";
const homesToCleanup: string[] = [];

afterEach(() => {
  while (homesToCleanup.length > 0) {
    cleanupTempHomeDir(homesToCleanup.pop() as string);
  }
});

async function createSourceSkill(homeDir: string, skillName: string): Promise<string> {
  const sourcePath = join(homeDir, "sources", skillName);
  await fs.mkdir(sourcePath, { recursive: true });
  await fs.writeFile(join(sourcePath, "SKILL.md"), `# ${skillName}\n`, "utf8");
  await fs.writeFile(join(sourcePath, "notes.txt"), "managed flow fixture\n", "utf8");
  return sourcePath;
}

type SkillsViewJson = {
  view: "skills";
  skills: Array<{
    skillName: string;
    entries: Array<{
      agentId: string;
      skillName: string;
      kind: string;
      path: string;
    }>;
  }>;
};

type RecordsViewJson = {
  view: "records";
  records: Array<{
    agentId: string;
    skillName: string;
    kind: string;
    path: string;
  }>;
};

type DoctorJson = {
  issues: Array<{
    code: string;
    path?: string;
  }>;
};

describe("managed flow", () => {
  it("scans, imports, enables, lists, disables, and diagnoses one managed skill", async () => {
    const cli = buildCli();
    expect(cli.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining([
        "scan",
        "list",
        "adopt",
        "import",
        "enable",
        "disable",
        "agents",
        "doctor",
        "config"
      ])
    );

    const homeDir = createTempHomeDir();
    homesToCleanup.push(homeDir);
    ensureDirectory(join(homeDir, ".codex", "skills"));
    ensureDirectory(join(homeDir, ".claude", "skills"));
    const sourcePath = await createSourceSkill(homeDir, "find-skills");

    const initialScan = await runScan({
      homeDir,
      now: new Date("2026-04-12T12:00:00.000Z")
    });

    expect(initialScan.manifest.lastScan.at).toBe("2026-04-12T12:00:00.000Z");
    expect(Object.keys(initialScan.manifest.agents)).toEqual(
      expect.arrayContaining(["codex", "claude"])
    );

    const imported = await runImport({
      homeDir,
      sourcePath,
      skillName: "find-skills",
      now: new Date("2026-04-12T12:01:00.000Z")
    });

    expect(imported.skill.path).toBe(join(homeDir, ".skillmux", "skills", "find-skills"));

    await runEnable({
      homeDir,
      skill: "find-skills",
      agent: "codex",
      now: new Date("2026-04-12T12:02:00.000Z")
    });
    await runEnable({
      homeDir,
      skill: "find-skills",
      agent: "claude",
      now: new Date("2026-04-12T12:03:00.000Z")
    });

    const skillsView = JSON.parse(
      (
        await runList({
          homeDir,
          view: "skills",
          format: "json",
          now: new Date("2026-04-12T12:04:00.000Z")
        })
      ).output
    ) as SkillsViewJson;

    expect(skillsView.skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          skillName: "find-skills",
          entries: expect.arrayContaining([
            expect.objectContaining({
              agentId: "codex",
              kind: "managed-link"
            }),
            expect.objectContaining({
              agentId: "claude",
              kind: "managed-link"
            })
          ])
        })
      ])
    );

    const manifestAfterEnable = await readManifest(join(homeDir, ".skillmux"));
    expect(manifestAfterEnable.activations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          skillId: "find-skills",
          agentId: "codex",
          state: "enabled"
        }),
        expect.objectContaining({
          skillId: "find-skills",
          agentId: "claude",
          state: "enabled"
        })
      ])
    );

    await runDisable({
      homeDir,
      skill: "find-skills",
      agent: "claude",
      now: new Date("2026-04-12T12:05:00.000Z")
    });

    const recordsView = JSON.parse(
      (
        await runList({
          homeDir,
          view: "records",
          format: "json",
          now: new Date("2026-04-12T12:06:00.000Z")
        })
      ).output
    ) as RecordsViewJson;

    expect(
      recordsView.records.some(
        (entry) =>
          entry.agentId === "codex" &&
          entry.skillName === "find-skills" &&
          entry.kind === "managed-link"
      )
    ).toBe(true);
    expect(
      recordsView.records.some(
        (entry) => entry.agentId === "claude" && entry.skillName === "find-skills"
      )
    ).toBe(false);

    const brokenLinkPath = join(homeDir, ".claude", "skills", "broken-example");
    await fs.symlink(
      join(homeDir, "missing-skills", "broken-example"),
      brokenLinkPath,
      directoryLinkType
    );

    const doctor = JSON.parse(
      (
        await runDoctor({
          homeDir,
          json: true
        })
      ).output
    ) as DoctorJson;

    expect(doctor.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "broken-link",
          path: brokenLinkPath
        })
      ])
    );

    const finalManifest = await readManifest(join(homeDir, ".skillmux"));
    expect(finalManifest.activations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          skillId: "find-skills",
          agentId: "claude",
          state: "disabled"
        })
      ])
    );
  });

  it("adopts a preinstalled npx skills-style link into the managed flow", async () => {
    const homeDir = createTempHomeDir();
    homesToCleanup.push(homeDir);
    const sourcePath = await createSourceSkill(homeDir, "find-skills");
    const agentLinkPath = join(homeDir, ".codex", "skills", "find-skills");

    ensureDirectory(join(homeDir, ".codex", "skills"));
    await fs.symlink(sourcePath, agentLinkPath, directoryLinkType);

    const adopted = await runAdopt({
      homeDir,
      agent: "codex",
      skill: "find-skills",
      now: new Date("2026-04-12T13:00:00.000Z")
    });

    expect(adopted.adopted).toEqual([
      expect.objectContaining({
        skillId: "find-skills",
        agentId: "codex",
        sourcePath,
        managedPath: join(homeDir, ".skillmux", "skills", "find-skills")
      })
    ]);
    await expect(fs.realpath(agentLinkPath)).resolves.toBe(
      join(homeDir, ".skillmux", "skills", "find-skills")
    );

    await runDisable({
      homeDir,
      skill: "find-skills",
      agent: "codex",
      now: new Date("2026-04-12T13:01:00.000Z")
    });
    await expect(fs.lstat(agentLinkPath)).rejects.toMatchObject({ code: "ENOENT" });

    await runEnable({
      homeDir,
      skill: "find-skills",
      agent: "codex",
      now: new Date("2026-04-12T13:02:00.000Z")
    });
    await expect(fs.realpath(agentLinkPath)).resolves.toBe(
      join(homeDir, ".skillmux", "skills", "find-skills")
    );
  });
});

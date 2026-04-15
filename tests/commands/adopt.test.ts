import * as fs from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runAdopt } from "../../src/commands/adopt";
import { readManifest } from "../../src/manifest/read-manifest";
import { writeManifest } from "../../src/manifest/write-manifest";
import {
  cleanupTempHomeDir,
  createTempHomeDir
} from "../helpers/temp-env";

const directoryLinkType = process.platform === "win32" ? "junction" : "dir";
const homesToCleanup: string[] = [];

afterEach(() => {
  while (homesToCleanup.length > 0) {
    cleanupTempHomeDir(homesToCleanup.pop() as string);
  }
});

async function createExternalSkill(
  homeDir: string,
  skillName: string
): Promise<string> {
  const sourcePath = join(homeDir, "external-skills", skillName);
  await fs.mkdir(sourcePath, { recursive: true });
  await fs.writeFile(join(sourcePath, "SKILL.md"), `# ${skillName}\n`, "utf8");
  await fs.writeFile(join(sourcePath, "notes.txt"), "external source\n", "utf8");
  return sourcePath;
}

describe("runAdopt", () => {
  it("adopts one externally installed linked skill for one agent", async () => {
    const homeDir = createTempHomeDir();
    homesToCleanup.push(homeDir);
    const sourcePath = await createExternalSkill(homeDir, "find-skills");
    const linkPath = join(homeDir, ".codex", "skills", "find-skills");

    await fs.mkdir(join(homeDir, ".codex", "skills"), { recursive: true });
    await fs.symlink(sourcePath, linkPath, directoryLinkType);

    const result = await runAdopt({
      homeDir,
      agent: "codex",
      skill: "find-skills",
      now: new Date("2026-04-15T10:00:00.000Z")
    });

    expect(result.adopted).toHaveLength(1);
    expect(result.adopted[0]?.skillId).toBe("find-skills");
    expect(result.adopted[0]?.sourcePath).toBe(sourcePath);
    expect(await fs.realpath(linkPath)).toBe(
      join(homeDir, ".skillmux", "skills", "find-skills")
    );
    await expect(
      fs.readFile(join(homeDir, ".skillmux", "skills", "find-skills", "notes.txt"), "utf8")
    ).resolves.toBe("external source\n");

    const manifest = await readManifest(join(homeDir, ".skillmux"));
    expect(manifest.skills["find-skills"]).toMatchObject({
      id: "find-skills",
      name: "find-skills",
      path: join(homeDir, ".skillmux", "skills", "find-skills"),
      source: {
        kind: "imported",
        path: sourcePath
      },
      importedAt: "2026-04-15T10:00:00.000Z"
    });
    expect(manifest.activations).toEqual([
      {
        skillId: "find-skills",
        agentId: "codex",
        linkPath,
        state: "enabled",
        updatedAt: "2026-04-15T10:00:00.000Z"
      }
    ]);
  });

  it("adopts every eligible skill under one agent when no skill filter is provided", async () => {
    const homeDir = createTempHomeDir();
    homesToCleanup.push(homeDir);
    const linkedSourcePath = await createExternalSkill(homeDir, "find-skills");
    const directoryPath = join(homeDir, ".codex", "skills", "local-draft");
    const ignoredPath = join(homeDir, ".codex", "skills", "not-a-skill");

    await fs.mkdir(join(homeDir, ".codex", "skills"), { recursive: true });
    await fs.symlink(
      linkedSourcePath,
      join(homeDir, ".codex", "skills", "find-skills"),
      directoryLinkType
    );
    await fs.mkdir(directoryPath, { recursive: true });
    await fs.writeFile(join(directoryPath, "SKILL.md"), "# local-draft\n", "utf8");
    await fs.mkdir(ignoredPath, { recursive: true });
    await fs.writeFile(join(ignoredPath, "README.md"), "# ignored\n", "utf8");

    const result = await runAdopt({
      homeDir,
      agent: "codex",
      now: new Date("2026-04-15T10:05:00.000Z")
    });

    expect(result.adopted.map((entry) => entry.skillId)).toEqual([
      "find-skills",
      "local-draft"
    ]);
    expect(result.skipped).toEqual([
      expect.objectContaining({
        skillId: "not-a-skill",
        reason: "missing-skill-file"
      })
    ]);
    await expect(fs.realpath(directoryPath)).resolves.toBe(
      join(homeDir, ".skillmux", "skills", "local-draft")
    );
  });

  it("skips already-managed entries without copying them again", async () => {
    const homeDir = createTempHomeDir();
    homesToCleanup.push(homeDir);
    const sourcePath = await createExternalSkill(homeDir, "find-skills");
    const linkPath = join(homeDir, ".codex", "skills", "find-skills");

    await fs.mkdir(join(homeDir, ".codex", "skills"), { recursive: true });
    await fs.symlink(sourcePath, linkPath, directoryLinkType);

    const firstResult = await runAdopt({
      homeDir,
      agent: "codex",
      skill: "find-skills",
      now: new Date("2026-04-15T10:10:00.000Z")
    });
    const secondResult = await runAdopt({
      homeDir,
      agent: "codex",
      skill: "find-skills",
      now: new Date("2026-04-15T10:11:00.000Z")
    });

    expect(firstResult.adopted).toHaveLength(1);
    expect(secondResult.adopted).toEqual([]);
    expect(secondResult.skipped).toEqual([
      expect.objectContaining({
        skillId: "find-skills",
        reason: "already-managed"
      })
    ]);
  });

  it("reconciles a managed link into an enabled activation", async () => {
    const homeDir = createTempHomeDir();
    homesToCleanup.push(homeDir);
    const skillmuxHome = join(homeDir, ".skillmux");
    const managedPath = join(skillmuxHome, "skills", "find-skills");
    const linkPath = join(homeDir, ".codex", "skills", "find-skills");
    const manifest = await readManifest(skillmuxHome);

    await fs.mkdir(managedPath, { recursive: true });
    await fs.writeFile(join(managedPath, "SKILL.md"), "# find-skills\n", "utf8");
    await fs.mkdir(join(homeDir, ".codex", "skills"), { recursive: true });
    await fs.symlink(managedPath, linkPath, directoryLinkType);

    manifest.skills["find-skills"] = {
      id: "find-skills",
      name: "find-skills",
      path: managedPath,
      source: {
        kind: "imported",
        path: join(homeDir, "external-skills", "find-skills")
      },
      importedAt: "2026-04-15T09:00:00.000Z"
    };
    manifest.agents.codex = {
      id: "codex",
      name: "OpenAI Codex",
      path: join(homeDir, ".codex", "skills"),
      discovery: "builtin",
      available: true,
      lastSeenAt: "2026-04-15T09:05:00.000Z"
    };
    manifest.activations = [
      {
        skillId: "find-skills",
        agentId: "codex",
        linkPath,
        state: "disabled",
        updatedAt: "2026-04-15T09:05:00.000Z"
      }
    ];
    await writeManifest(skillmuxHome, manifest);

    const result = await runAdopt({
      homeDir,
      agent: "codex",
      skill: "find-skills",
      now: new Date("2026-04-15T10:20:00.000Z")
    });

    expect(result.adopted).toEqual([]);
    expect(result.skipped).toEqual([
      expect.objectContaining({
        skillId: "find-skills",
        reason: "already-managed"
      })
    ]);

    const persisted = await readManifest(skillmuxHome);
    expect(persisted.activations).toEqual([
      {
        skillId: "find-skills",
        agentId: "codex",
        linkPath,
        state: "enabled",
        updatedAt: "2026-04-15T10:20:00.000Z"
      }
    ]);
  });

  it("fails clearly when a managed link has no matching manifest skill record", async () => {
    const homeDir = createTempHomeDir();
    homesToCleanup.push(homeDir);
    const managedPath = join(homeDir, ".skillmux", "skills", "find-skills");
    const linkPath = join(homeDir, ".codex", "skills", "find-skills");

    await fs.mkdir(managedPath, { recursive: true });
    await fs.writeFile(join(managedPath, "SKILL.md"), "# find-skills\n", "utf8");
    await fs.mkdir(join(homeDir, ".codex", "skills"), { recursive: true });
    await fs.symlink(managedPath, linkPath, directoryLinkType);

    await expect(
      runAdopt({
        homeDir,
        agent: "codex",
        skill: "find-skills"
      })
    ).rejects.toThrow(/manifest skill record/i);

    const persisted = await readManifest(join(homeDir, ".skillmux"));
    expect(persisted.skills["find-skills"]).toBeUndefined();
    expect(persisted.activations).toEqual([]);
  });

  it("fails clearly when a managed link target does not match its manifest skill record", async () => {
    const homeDir = createTempHomeDir();
    homesToCleanup.push(homeDir);
    const skillmuxHome = join(homeDir, ".skillmux");
    const linkedManagedPath = join(skillmuxHome, "skills", "find-skills");
    const manifestManagedPath = join(skillmuxHome, "skills", "other-find-skills");
    const linkPath = join(homeDir, ".codex", "skills", "find-skills");
    const manifest = await readManifest(skillmuxHome);

    await fs.mkdir(linkedManagedPath, { recursive: true });
    await fs.writeFile(join(linkedManagedPath, "SKILL.md"), "# linked\n", "utf8");
    await fs.mkdir(manifestManagedPath, { recursive: true });
    await fs.writeFile(join(manifestManagedPath, "SKILL.md"), "# manifest\n", "utf8");
    await fs.mkdir(join(homeDir, ".codex", "skills"), { recursive: true });
    await fs.symlink(linkedManagedPath, linkPath, directoryLinkType);

    manifest.skills["find-skills"] = {
      id: "find-skills",
      name: "find-skills",
      path: manifestManagedPath,
      source: {
        kind: "imported",
        path: join(homeDir, "external-skills", "find-skills")
      },
      importedAt: "2026-04-15T09:00:00.000Z"
    };
    await writeManifest(skillmuxHome, manifest);

    await expect(
      runAdopt({
        homeDir,
        agent: "codex",
        skill: "find-skills"
      })
    ).rejects.toThrow(/manifest skill record/i);

    await expect(fs.realpath(linkPath)).resolves.toBe(linkedManagedPath);
  });

  it("does not replace a working external link when the existing manifest target is stale", async () => {
    const homeDir = createTempHomeDir();
    homesToCleanup.push(homeDir);
    const skillmuxHome = join(homeDir, ".skillmux");
    const sourcePath = await createExternalSkill(homeDir, "find-skills");
    const staleManagedPath = join(skillmuxHome, "skills", "find-skills");
    const linkPath = join(homeDir, ".codex", "skills", "find-skills");
    const manifest = await readManifest(skillmuxHome);

    await fs.mkdir(join(homeDir, ".codex", "skills"), { recursive: true });
    await fs.symlink(sourcePath, linkPath, directoryLinkType);
    manifest.skills["find-skills"] = {
      id: "find-skills",
      name: "find-skills",
      path: staleManagedPath,
      source: {
        kind: "imported",
        path: sourcePath
      },
      importedAt: "2026-04-15T09:00:00.000Z"
    };
    await writeManifest(skillmuxHome, manifest);

    await expect(
      runAdopt({
        homeDir,
        agent: "codex",
        skill: "find-skills"
      })
    ).rejects.toThrow(/SKILL\.md|directory/i);

    await expect(fs.realpath(linkPath)).resolves.toBe(sourcePath);
  });

  it("persists completed adoptions before a later entry fails", async () => {
    const homeDir = createTempHomeDir();
    homesToCleanup.push(homeDir);
    const skillmuxHome = join(homeDir, ".skillmux");
    const alphaSourcePath = await createExternalSkill(homeDir, "alpha");
    const betaSourcePath = await createExternalSkill(homeDir, "beta");
    const betaStaleManagedPath = join(skillmuxHome, "skills", "beta");
    const manifest = await readManifest(skillmuxHome);

    await fs.mkdir(join(homeDir, ".codex", "skills"), { recursive: true });
    await fs.symlink(
      alphaSourcePath,
      join(homeDir, ".codex", "skills", "alpha"),
      directoryLinkType
    );
    await fs.symlink(
      betaSourcePath,
      join(homeDir, ".codex", "skills", "beta"),
      directoryLinkType
    );
    manifest.skills.beta = {
      id: "beta",
      name: "beta",
      path: betaStaleManagedPath,
      source: {
        kind: "imported",
        path: betaSourcePath
      },
      importedAt: "2026-04-15T09:00:00.000Z"
    };
    await writeManifest(skillmuxHome, manifest);

    await expect(
      runAdopt({
        homeDir,
        agent: "codex",
        now: new Date("2026-04-15T10:30:00.000Z")
      })
    ).rejects.toThrow(/SKILL\.md|directory/i);

    const persisted = await readManifest(skillmuxHome);
    expect(persisted.skills.alpha).toMatchObject({
      id: "alpha",
      path: join(skillmuxHome, "skills", "alpha")
    });
    expect(persisted.activations).toEqual(
      expect.arrayContaining([
        {
          skillId: "alpha",
          agentId: "codex",
          linkPath: join(homeDir, ".codex", "skills", "alpha"),
          state: "enabled",
          updatedAt: "2026-04-15T10:30:00.000Z"
        }
      ])
    );
    await expect(fs.realpath(join(homeDir, ".codex", "skills", "alpha"))).resolves.toBe(
      join(skillmuxHome, "skills", "alpha")
    );
    await expect(fs.realpath(join(homeDir, ".codex", "skills", "beta"))).resolves.toBe(
      betaSourcePath
    );
  });
});

import * as fs from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildCli } from "../../src/index";
import { runDisable } from "../../src/commands/disable";
import { runEnable } from "../../src/commands/enable";
import { runImport } from "../../src/commands/import";
import { runRemove } from "../../src/commands/remove";
import { readManifest } from "../../src/manifest/read-manifest";
import { writeManifest } from "../../src/manifest/write-manifest";
import {
  cleanupTempHomeDir,
  createTempHomeDir
} from "../helpers/temp-env";

const tempHomes: string[] = [];

afterEach(() => {
  while (tempHomes.length > 0) {
    cleanupTempHomeDir(tempHomes.pop() as string);
  }
});

async function createSourceSkill(
  homeDir: string,
  relativePath: string
): Promise<string> {
  const sourcePath = join(homeDir, relativePath);
  await fs.mkdir(sourcePath, { recursive: true });
  await fs.writeFile(join(sourcePath, "SKILL.md"), "# Find Skills\n", "utf8");
  await fs.writeFile(join(sourcePath, "notes.txt"), "local source\n", "utf8");
  return sourcePath;
}

function setEnvVar(name: string, value: string): void {
  process.env[name] = value;
}

function restoreEnvVar(name: string, previousValue: string | undefined): void {
  if (previousValue === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = previousValue;
}

async function createManagedSkill(
  homeDir: string,
  skillName: string,
  relativeSourcePath: string
): Promise<{ skillmuxHome: string; sourcePath: string }> {
  const sourcePath = await createSourceSkill(homeDir, relativeSourcePath);
  const skillmuxHome = join(homeDir, ".skillmux");

  await runImport({
    homeDir,
    sourcePath,
    skillName,
    skillmuxHome
  });

  return { skillmuxHome, sourcePath };
}

describe("runRemove", () => {
  it("removes a managed skill that is disabled everywhere", async () => {
    const homeDir = createTempHomeDir();
    tempHomes.push(homeDir);
    const { skillmuxHome } = await createManagedSkill(
      homeDir,
      "find-skills",
      "downloads/find-skills"
    );

    await runEnable({
      homeDir,
      skillmuxHome,
      skill: "find-skills",
      agent: "codex"
    });

    await runDisable({
      homeDir,
      skillmuxHome,
      skill: "find-skills",
      agent: "codex"
    });

    const result = await runRemove({
      homeDir,
      skillmuxHome,
      skill: "find-skills"
    });

    expect(result.changed).toBe(true);
    expect(result.removedSkillId).toBe("find-skills");
    expect(result.skill).toMatchObject({
      id: "find-skills",
      path: join(skillmuxHome, "skills", "find-skills")
    });
    expect(result.location).toMatchObject({
      skillmuxHome,
      configPath: join(skillmuxHome, "config.json"),
      manifestPath: join(skillmuxHome, "manifest.json"),
      managedSkillsDirectory: join(skillmuxHome, "skills")
    });
    expect(result.manifest.skills["find-skills"]).toBeUndefined();
    expect(
      result.manifest.activations.filter((entry) => entry.skillId === "find-skills")
    ).toEqual([]);
    await expect(fs.lstat(join(skillmuxHome, "skills", "find-skills"))).rejects.toThrow();

    const manifest = await readManifest(skillmuxHome);
    expect(manifest.skills["find-skills"]).toBeUndefined();
    expect(
      manifest.activations.filter((entry) => entry.skillId === "find-skills")
    ).toEqual([]);
  });

  it("removes a managed skill by display name when the id differs", async () => {
    const homeDir = createTempHomeDir();
    tempHomes.push(homeDir);
    const { skillmuxHome } = await createManagedSkill(
      homeDir,
      "find-skills-classic",
      "downloads/find-skills-classic"
    );
    const manifest = await readManifest(skillmuxHome);
    manifest.skills["find-skills-classic"].name = "Find Skills";
    await writeManifest(skillmuxHome, manifest);

    const result = await runRemove({
      homeDir,
      skillmuxHome,
      skill: "Find Skills"
    });

    expect(result.removedSkillId).toBe("find-skills-classic");
    expect(result.location.manifestPath).toBe(join(skillmuxHome, "manifest.json"));
    expect(result.location.configPath).toBe(join(skillmuxHome, "config.json"));
    expect(result.manifest.skills["find-skills-classic"]).toBeUndefined();
  });

  it("rejects ambiguous normalized display names when no id match exists", async () => {
    const homeDir = createTempHomeDir();
    tempHomes.push(homeDir);
    const { skillmuxHome } = await createManagedSkill(
      homeDir,
      "find-skills-alpha",
      "downloads/find-skills-alpha"
    );
    const secondSourcePath = await createSourceSkill(homeDir, "downloads/find-skills-beta");
    await runImport({
      homeDir,
      sourcePath: secondSourcePath,
      skillName: "find-skills-beta",
      skillmuxHome
    });

    const manifest = await readManifest(skillmuxHome);
    manifest.skills["find-skills-alpha"].name = "Find Skills";
    manifest.skills["find-skills-beta"].name = "Find Skills!";
    await writeManifest(skillmuxHome, manifest);

    await expect(
      runRemove({
        homeDir,
        skillmuxHome,
        skill: "Find Skills"
      })
    ).rejects.toThrow(/ambiguous/i);
  });

  it("prefers a direct id match even when another skill name normalizes to the same value", async () => {
    const homeDir = createTempHomeDir();
    tempHomes.push(homeDir);
    const { skillmuxHome } = await createManagedSkill(
      homeDir,
      "find-skills",
      "downloads/find-skills"
    );
    const secondSourcePath = await createSourceSkill(homeDir, "downloads/find-skills-beta");
    await runImport({
      homeDir,
      sourcePath: secondSourcePath,
      skillName: "find-skills-beta",
      skillmuxHome
    });

    const manifest = await readManifest(skillmuxHome);
    manifest.skills["find-skills"].name = "Find Skills";
    manifest.skills["find-skills-beta"].name = "Find Skills!";
    await writeManifest(skillmuxHome, manifest);

    const result = await runRemove({
      homeDir,
      skillmuxHome,
      skill: "find-skills"
    });

    expect(result.removedSkillId).toBe("find-skills");
    expect(result.manifest.skills["find-skills"]).toBeUndefined();
    expect(result.manifest.skills["find-skills-beta"]).toBeDefined();
  });

  it("refuses to remove a skill that is still enabled for an agent", async () => {
    const homeDir = createTempHomeDir();
    tempHomes.push(homeDir);
    const { skillmuxHome } = await createManagedSkill(
      homeDir,
      "find-skills",
      "downloads/find-skills"
    );

    await runEnable({
      homeDir,
      skillmuxHome,
      skill: "find-skills",
      agent: "codex"
    });

    await expect(
      runRemove({
        homeDir,
        skillmuxHome,
        skill: "find-skills"
      })
    ).rejects.toThrow(/still enabled/i);

    const manifest = await readManifest(skillmuxHome);
    expect(manifest.skills["find-skills"]).toBeDefined();
    const entry = await fs.lstat(join(skillmuxHome, "skills", "find-skills"));
    expect(entry.isDirectory()).toBe(true);
  });

  it("refuses removal when the managed skills ancestor is a symlink and preserves the external target", async () => {
    const homeDir = createTempHomeDir();
    tempHomes.push(homeDir);
    const { skillmuxHome } = await createManagedSkill(
      homeDir,
      "find-skills",
      "downloads/find-skills"
    );
    const managedSkillsDirectory = join(skillmuxHome, "skills");
    const externalSkillsDirectory = join(homeDir, "external-skills");
    const externalSkillPath = join(externalSkillsDirectory, "find-skills");
    const linkType = process.platform === "win32" ? "junction" : "dir";

    await fs.mkdir(externalSkillPath, { recursive: true });
    await fs.writeFile(join(externalSkillPath, "SKILL.md"), "# External\n", "utf8");
    await fs.rm(managedSkillsDirectory, { recursive: true, force: true });
    await fs.symlink(externalSkillsDirectory, managedSkillsDirectory, linkType);

    await expect(
      runRemove({
        homeDir,
        skillmuxHome,
        skill: "find-skills"
      })
    ).rejects.toThrow(/symlink/i);

    await expect(fs.readFile(join(externalSkillPath, "SKILL.md"), "utf8")).resolves.toContain(
      "External"
    );
    const manifest = await readManifest(skillmuxHome);
    expect(manifest.skills["find-skills"]).toBeDefined();
  });

  it("refuses removal when the manifest points the managed skill outside the managed store", async () => {
    const homeDir = createTempHomeDir();
    tempHomes.push(homeDir);
    const { skillmuxHome } = await createManagedSkill(
      homeDir,
      "find-skills",
      "downloads/find-skills"
    );
    const externalSkillPath = join(homeDir, "external-skill", "find-skills");

    await fs.mkdir(externalSkillPath, { recursive: true });
    await fs.writeFile(join(externalSkillPath, "SKILL.md"), "# External\n", "utf8");

    const manifest = await readManifest(skillmuxHome);
    manifest.skills["find-skills"].path = externalSkillPath;
    await writeManifest(skillmuxHome, manifest);

    await expect(
      runRemove({
        homeDir,
        skillmuxHome,
        skill: "find-skills"
      })
    ).rejects.toThrow(/unmanaged skill path/i);

    await expect(fs.readFile(join(externalSkillPath, "SKILL.md"), "utf8")).resolves.toContain(
      "External"
    );
    const rereadManifest = await readManifest(skillmuxHome);
    expect(rereadManifest.skills["find-skills"].path).toBe(externalSkillPath);
  });

  it("refuses to remove a symlinked managed skill path and preserves the external target", async () => {
    const homeDir = createTempHomeDir();
    tempHomes.push(homeDir);
    const { skillmuxHome } = await createManagedSkill(
      homeDir,
      "find-skills",
      "downloads/find-skills"
    );
    const managedSkillPath = join(skillmuxHome, "skills", "find-skills");
    const externalTargetPath = join(homeDir, "external", "shared-skill");
    const directoryLinkType = process.platform === "win32" ? "junction" : "dir";

    await fs.mkdir(externalTargetPath, { recursive: true });
    await fs.writeFile(join(externalTargetPath, "SKILL.md"), "# External\n", "utf8");
    await fs.rm(managedSkillPath, { recursive: true, force: true });
    await fs.symlink(externalTargetPath, managedSkillPath, directoryLinkType);

    await expect(
      runRemove({
        homeDir,
        skillmuxHome,
        skill: "find-skills"
      })
    ).rejects.toThrow(/symlink/i);

    await expect(fs.readFile(join(externalTargetPath, "SKILL.md"), "utf8")).resolves.toContain(
      "External"
    );
    const manifest = await readManifest(skillmuxHome);
    expect(manifest.skills["find-skills"]).toBeDefined();
  });
});

describe("CLI remove", () => {
  it("emits structured json through the public CLI surface", async () => {
    const homeDir = createTempHomeDir();
    tempHomes.push(homeDir);
    const sourcePath = await createSourceSkill(homeDir, "downloads/find-skills");
    const skillmuxHome = join(homeDir, ".skillmux");
    const previousHome = process.env.HOME;
    const previousUserProfile = process.env.USERPROFILE;
    const previousHomeDrive = process.env.HOMEDRIVE;
    const previousHomePath = process.env.HOMEPATH;

    setEnvVar("HOME", homeDir);
    setEnvVar("USERPROFILE", homeDir);
    delete process.env.HOMEDRIVE;
    delete process.env.HOMEPATH;

    await runImport({
      homeDir,
      sourcePath,
      skillName: "find-skills",
      skillmuxHome
    });

    const cli = buildCli();
    cli.exitOverride();
    const stdoutChunks: string[] = [];
    const originalWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      stdoutChunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
      return true;
    }) as typeof process.stdout.write;

    try {
      await cli.parseAsync(
        ["node", "skillmux", "remove", "--skill", "find-skills", "--json"],
        { from: "node" }
      );
    } finally {
      process.stdout.write = originalWrite;
      restoreEnvVar("HOME", previousHome);
      restoreEnvVar("USERPROFILE", previousUserProfile);
      restoreEnvVar("HOMEDRIVE", previousHomeDrive);
      restoreEnvVar("HOMEPATH", previousHomePath);
    }

    const parsed = JSON.parse(stdoutChunks.join("")) as {
      changed: boolean;
      removedSkillId: string;
      location: {
        skillmuxHome: string;
        configPath: string;
        manifestPath: string;
      };
    };

    expect(parsed.changed).toBe(true);
    expect(parsed.removedSkillId).toBe("find-skills");
    expect(parsed.location.skillmuxHome).toBe(skillmuxHome);
    expect(parsed.location.configPath).toBe(join(skillmuxHome, "config.json"));
    expect(parsed.location.manifestPath).toBe(join(skillmuxHome, "manifest.json"));
  });
});

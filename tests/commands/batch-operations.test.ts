import * as fs from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runAdopt } from "../../src/commands/adopt";
import { runDisable } from "../../src/commands/disable";
import { runEnable } from "../../src/commands/enable";
import { runImport } from "../../src/commands/import";
import { runRemove } from "../../src/commands/remove";
import { buildCli } from "../../src/index";
import { readManifest } from "../../src/manifest/read-manifest";
import { cleanupTempHomeDir, createTempHomeDir } from "../helpers/temp-env";

const directoryLinkType = process.platform === "win32" ? "junction" : "dir";
const tempHomes: string[] = [];

afterEach(() => {
  while (tempHomes.length > 0) {
    cleanupTempHomeDir(tempHomes.pop() as string);
  }
});

async function createSourceSkill(
  homeDir: string,
  skillName: string
): Promise<string> {
  const sourcePath = join(homeDir, "sources", skillName);
  await fs.mkdir(sourcePath, { recursive: true });
  await fs.writeFile(join(sourcePath, "SKILL.md"), `# ${skillName}\n`, "utf8");
  await fs.writeFile(join(sourcePath, "notes.txt"), `${skillName}\n`, "utf8");
  return sourcePath;
}

async function importManagedSkill(
  homeDir: string,
  skillName: string
): Promise<string> {
  const sourcePath = await createSourceSkill(homeDir, skillName);
  await runImport({
    homeDir,
    sourcePath,
    skillName
  });
  return sourcePath;
}

async function createExternalInstalledSkill(
  homeDir: string,
  agent: string,
  skillName: string
): Promise<string> {
  const sourcePath = join(homeDir, "external-skills", skillName);
  const linkPath = join(homeDir, `.${agent}`, "skills", skillName);

  await fs.mkdir(sourcePath, { recursive: true });
  await fs.writeFile(join(sourcePath, "SKILL.md"), `# ${skillName}\n`, "utf8");
  await fs.writeFile(join(sourcePath, "notes.txt"), `${skillName}\n`, "utf8");
  await fs.mkdir(join(homeDir, `.${agent}`, "skills"), { recursive: true });
  await fs.symlink(sourcePath, linkPath, directoryLinkType);

  return sourcePath;
}

function setHomeEnvironment(homeDir: string): () => void {
  const previousHome = process.env.HOME;
  const previousUserProfile = process.env.USERPROFILE;
  const previousHomeDrive = process.env.HOMEDRIVE;
  const previousHomePath = process.env.HOMEPATH;

  process.env.HOME = homeDir;
  process.env.USERPROFILE = homeDir;
  delete process.env.HOMEDRIVE;
  delete process.env.HOMEPATH;

  return () => {
    restoreEnvVar("HOME", previousHome);
    restoreEnvVar("USERPROFILE", previousUserProfile);
    restoreEnvVar("HOMEDRIVE", previousHomeDrive);
    restoreEnvVar("HOMEPATH", previousHomePath);
  };
}

function restoreEnvVar(name: string, previousValue: string | undefined): void {
  if (previousValue === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = previousValue;
}

async function runCli(argv: string[]): Promise<string> {
  const cli = buildCli();
  cli.exitOverride();
  const stdoutChunks: string[] = [];
  const originalWrite = process.stdout.write;

  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdoutChunks.push(
      typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8")
    );
    return true;
  }) as typeof process.stdout.write;

  try {
    await cli.parseAsync(["node", "skillmux", ...argv], { from: "node" });
  } finally {
    process.stdout.write = originalWrite;
  }

  return stdoutChunks.join("");
}

describe("batch operations", () => {
  it("enables one skill for multiple agents", async () => {
    const homeDir = createTempHomeDir();
    tempHomes.push(homeDir);
    await importManagedSkill(homeDir, "find-skills");

    const result = await runEnable({
      homeDir,
      skill: "find-skills",
      agents: ["codex", "claude"],
      now: new Date("2026-04-15T10:00:00.000Z")
    });

    expect(result.changedAgents).toEqual(["codex", "claude"]);
    expect(result.results.map((entry) => entry.agent.id)).toEqual([
      "codex",
      "claude"
    ]);
    await expect(
      fs.realpath(join(homeDir, ".codex", "skills", "find-skills"))
    ).resolves.toBe(join(homeDir, ".skillmux", "skills", "find-skills"));
    await expect(
      fs.realpath(join(homeDir, ".claude", "skills", "find-skills"))
    ).resolves.toBe(join(homeDir, ".skillmux", "skills", "find-skills"));
  });

  it("disables one skill for multiple agents", async () => {
    const homeDir = createTempHomeDir();
    tempHomes.push(homeDir);
    await importManagedSkill(homeDir, "find-skills");
    await runEnable({ homeDir, skill: "find-skills", agent: "codex" });
    await runEnable({ homeDir, skill: "find-skills", agent: "claude" });

    const result = await runDisable({
      homeDir,
      skill: "find-skills",
      agents: ["codex", "claude"],
      now: new Date("2026-04-15T10:05:00.000Z")
    });

    expect(result.changedAgents).toEqual(["codex", "claude"]);
    expect(result.results.map((entry) => entry.agent.id)).toEqual([
      "codex",
      "claude"
    ]);
    await expect(
      fs.lstat(join(homeDir, ".codex", "skills", "find-skills"))
    ).rejects.toMatchObject({ code: "ENOENT" });
    await expect(
      fs.lstat(join(homeDir, ".claude", "skills", "find-skills"))
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("adopts multiple skills under one agent", async () => {
    const homeDir = createTempHomeDir();
    tempHomes.push(homeDir);
    await createExternalInstalledSkill(homeDir, "codex", "alpha");
    await createExternalInstalledSkill(homeDir, "codex", "beta");

    const result = await runAdopt({
      homeDir,
      agent: "codex",
      skills: ["alpha", "beta"],
      now: new Date("2026-04-15T10:10:00.000Z")
    });

    expect(result.results).toHaveLength(2);
    expect(result.adopted.map((entry) => entry.skillId)).toEqual([
      "alpha",
      "beta"
    ]);
    await expect(
      fs.realpath(join(homeDir, ".codex", "skills", "alpha"))
    ).resolves.toBe(join(homeDir, ".skillmux", "skills", "alpha"));
    await expect(
      fs.realpath(join(homeDir, ".codex", "skills", "beta"))
    ).resolves.toBe(join(homeDir, ".skillmux", "skills", "beta"));
  });

  it("removes multiple disabled skills", async () => {
    const homeDir = createTempHomeDir();
    tempHomes.push(homeDir);
    await importManagedSkill(homeDir, "alpha");
    await importManagedSkill(homeDir, "beta");

    const result = await runRemove({
      homeDir,
      skills: ["alpha", "beta"]
    });

    expect(result.removedSkillIds).toEqual(["alpha", "beta"]);
    expect(result.results.map((entry) => entry.removedSkillId)).toEqual([
      "alpha",
      "beta"
    ]);

    const manifest = await readManifest(join(homeDir, ".skillmux"));
    expect(manifest.skills.alpha).toBeUndefined();
    expect(manifest.skills.beta).toBeUndefined();
    await expect(
      fs.lstat(join(homeDir, ".skillmux", "skills", "alpha"))
    ).rejects.toMatchObject({ code: "ENOENT" });
    await expect(
      fs.lstat(join(homeDir, ".skillmux", "skills", "beta"))
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("keeps earlier batch changes when a later item fails and identifies the failed item", async () => {
    const homeDir = createTempHomeDir();
    tempHomes.push(homeDir);
    await importManagedSkill(homeDir, "find-skills");

    let caughtError: unknown;
    try {
      await runEnable({
        homeDir,
        skill: "find-skills",
        agents: ["codex", "missing-agent"]
      });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toContain(
      "Failed to enable find-skills for missing-agent after enabling: codex"
    );
    expect(caughtError).toMatchObject({
      operation: "enable",
      failedItem: "missing-agent",
      completedItems: ["codex"]
    });
    expect((caughtError as Error).cause).toBeInstanceOf(Error);

    await expect(
      fs.realpath(join(homeDir, ".codex", "skills", "find-skills"))
    ).resolves.toBe(join(homeDir, ".skillmux", "skills", "find-skills"));
  });

  it("reports completed removals when a later batch remove fails", async () => {
    const homeDir = createTempHomeDir();
    tempHomes.push(homeDir);
    await importManagedSkill(homeDir, "alpha");

    let caughtError: unknown;
    try {
      await runRemove({
        homeDir,
        skills: ["alpha", "missing-skill"]
      });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toContain(
      "Failed to remove missing-skill after removing: alpha"
    );
    expect(caughtError).toMatchObject({
      operation: "remove",
      failedItem: "missing-skill",
      completedItems: ["alpha"]
    });

    const manifest = await readManifest(join(homeDir, ".skillmux"));
    expect(manifest.skills.alpha).toBeUndefined();
  });

  it("maps repeated CLI flags onto batch enable semantics", async () => {
    const homeDir = createTempHomeDir();
    tempHomes.push(homeDir);
    await importManagedSkill(homeDir, "find-skills");
    const restoreHome = setHomeEnvironment(homeDir);

    try {
      await runCli([
        "enable",
        "--skill",
        "find-skills",
        "--agent",
        "codex",
        "--agent",
        "claude"
      ]);
    } finally {
      restoreHome();
    }

    await expect(
      fs.realpath(join(homeDir, ".codex", "skills", "find-skills"))
    ).resolves.toBe(join(homeDir, ".skillmux", "skills", "find-skills"));
    await expect(
      fs.realpath(join(homeDir, ".claude", "skills", "find-skills"))
    ).resolves.toBe(join(homeDir, ".skillmux", "skills", "find-skills"));
  });
});

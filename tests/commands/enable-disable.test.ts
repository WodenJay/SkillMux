import * as fs from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runDisable } from "../../src/commands/disable";
import { runEnable } from "../../src/commands/enable";
import { readManifest } from "../../src/manifest/read-manifest";
import { cleanupTempHomeDir, createTempHomeDir } from "../helpers/temp-env";
import { runImport } from "../../src/commands/import";

const homesToCleanup: string[] = [];

async function createLocalSkillSource(homeDir: string, skillName: string): Promise<string> {
  const sourcePath = join(homeDir, "sources", skillName);
  await fs.mkdir(sourcePath, { recursive: true });
  await fs.writeFile(join(sourcePath, "SKILL.md"), `# ${skillName}\n`, "utf8");
  await fs.writeFile(join(sourcePath, "notes.txt"), "local skill\n", "utf8");
  return sourcePath;
}

afterEach(() => {
  while (homesToCleanup.length > 0) {
    cleanupTempHomeDir(homesToCleanup.pop() as string);
  }
});

describe("activation commands", () => {
  it("enables and disables a managed skill for one agent idempotently", async () => {
    const homeDir = createTempHomeDir();
    homesToCleanup.push(homeDir);
    const sourcePath = await createLocalSkillSource(homeDir, "find-skills");

    await runImport({
      homeDir,
      sourcePath,
      skillName: "find-skills",
      now: new Date("2026-04-12T10:00:00.000Z")
    });

    const firstEnable = await runEnable({
      homeDir,
      skill: "find-skills",
      agent: "codex",
      now: new Date("2026-04-12T10:05:00.000Z")
    });

    expect(firstEnable.changed).toBe(true);
    expect(await fs.realpath(join(homeDir, ".codex", "skills", "find-skills"))).toBe(
      firstEnable.skill.path
    );

    const manifestAfterEnable = await readManifest(firstEnable.manifest.skillmuxHome);
    expect(manifestAfterEnable.activations).toEqual([
      {
        skillId: "find-skills",
        agentId: "codex",
        linkPath: join(homeDir, ".codex", "skills", "find-skills"),
        state: "enabled",
        updatedAt: "2026-04-12T10:05:00.000Z"
      }
    ]);

    const secondEnable = await runEnable({
      homeDir,
      skill: "find-skills",
      agent: "codex",
      now: new Date("2026-04-12T10:06:00.000Z")
    });

    expect(secondEnable.changed).toBe(false);
    expect(secondEnable.manifest.activations).toEqual(manifestAfterEnable.activations);

    const firstDisable = await runDisable({
      homeDir,
      skill: "find-skills",
      agent: "codex",
      now: new Date("2026-04-12T10:10:00.000Z")
    });

    expect(firstDisable.changed).toBe(true);
    await expect(
      fs.lstat(join(homeDir, ".codex", "skills", "find-skills"))
    ).rejects.toMatchObject({ code: "ENOENT" });
    expect(firstDisable.manifest.activations).toEqual([
      {
        skillId: "find-skills",
        agentId: "codex",
        linkPath: join(homeDir, ".codex", "skills", "find-skills"),
        state: "disabled",
        updatedAt: "2026-04-12T10:10:00.000Z"
      }
    ]);

    const secondDisable = await runDisable({
      homeDir,
      skill: "find-skills",
      agent: "codex",
      now: new Date("2026-04-12T10:11:00.000Z")
    });

    expect(secondDisable.changed).toBe(false);
    expect(secondDisable.manifest.activations).toEqual(firstDisable.manifest.activations);
  });

  it("adopts an existing external skill link on first disable and can re-enable it later", async () => {
    const homeDir = createTempHomeDir();
    homesToCleanup.push(homeDir);
    const sourcePath = await createLocalSkillSource(homeDir, "ui-ux-pro-max");
    const agentLinkPath = join(homeDir, ".codex", "skills", "ui-ux-pro-max");

    await fs.mkdir(join(homeDir, ".codex", "skills"), { recursive: true });
    await fs.symlink(sourcePath, agentLinkPath, process.platform === "win32" ? "junction" : "dir");

    const disabled = await runDisable({
      homeDir,
      skill: "ui-ux-pro-max",
      agent: "codex",
      now: new Date("2026-04-12T10:20:00.000Z")
    });

    expect(disabled.changed).toBe(true);
    expect(disabled.skill.id).toBe("ui-ux-pro-max");
    expect(disabled.skill.source).toEqual({
      kind: "imported",
      path: sourcePath
    });
    expect(await fs.readFile(join(disabled.skill.path, "SKILL.md"), "utf8")).toContain(
      "ui-ux-pro-max"
    );
    await expect(fs.lstat(agentLinkPath)).rejects.toMatchObject({ code: "ENOENT" });

    const manifestAfterDisable = await readManifest(disabled.manifest.skillmuxHome);
    expect(manifestAfterDisable.skills["ui-ux-pro-max"]).toEqual(disabled.skill);
    expect(manifestAfterDisable.activations).toEqual([
      {
        skillId: "ui-ux-pro-max",
        agentId: "codex",
        linkPath: agentLinkPath,
        state: "disabled",
        updatedAt: "2026-04-12T10:20:00.000Z"
      }
    ]);

    const enabled = await runEnable({
      homeDir,
      skill: "ui-ux-pro-max",
      agent: "codex",
      now: new Date("2026-04-12T10:21:00.000Z")
    });

    expect(enabled.changed).toBe(true);
    expect(await fs.realpath(agentLinkPath)).toBe(disabled.skill.path);
  });
});

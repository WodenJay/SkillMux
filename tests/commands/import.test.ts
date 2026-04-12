import * as fs from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runImport } from "../../src/commands/import";
import { readManifest } from "../../src/manifest/read-manifest";
import {
  cleanupTempHomeDir,
  createTempHomeDir
} from "../helpers/temp-env";

const tempHomes: string[] = [];

afterEach(() => {
  tempHomes.splice(0).forEach((homeDir) => cleanupTempHomeDir(homeDir));
});

async function createSourceSkill(homeDir: string, relativePath: string): Promise<string> {
  const sourcePath = join(homeDir, relativePath);
  await fs.mkdir(sourcePath, { recursive: true });
  await fs.writeFile(join(sourcePath, "SKILL.md"), "# Find Skills\n", "utf8");
  await fs.writeFile(join(sourcePath, "notes.txt"), "local source\n", "utf8");
  return sourcePath;
}

describe("runImport", () => {
  it("copies a local skill into the managed store and records it", async () => {
    const homeDir = createTempHomeDir();
    tempHomes.push(homeDir);
    const sourcePath = await createSourceSkill(homeDir, "downloads/find-skills");
    const now = new Date("2026-04-12T10:00:00.000Z");

    const result = await runImport({
      homeDir,
      sourcePath,
      skillName: "find-skills",
      now
    });

    expect(result.skill).toMatchObject({
      id: "find-skills",
      name: "find-skills",
      path: join(homeDir, ".skillmux", "skills", "find-skills"),
      source: {
        kind: "local",
        path: sourcePath
      },
      importedAt: now.toISOString()
    });
    await expect(
      fs.readFile(join(result.skill.path, "SKILL.md"), "utf8")
    ).resolves.toContain("Find Skills");
    await expect(
      fs.readFile(join(result.skill.path, "notes.txt"), "utf8")
    ).resolves.toContain("local source");
    await expect(fs.readFile(join(sourcePath, "SKILL.md"), "utf8")).resolves.toContain(
      "Find Skills"
    );

    const manifest = await readManifest(join(homeDir, ".skillmux"));
    expect(manifest.skills["find-skills"]).toMatchObject({
      id: "find-skills",
      path: join(homeDir, ".skillmux", "skills", "find-skills"),
      source: {
        kind: "local",
        path: sourcePath
      }
    });
  });

  it("rejects source directories without a root SKILL.md", async () => {
    const homeDir = createTempHomeDir();
    tempHomes.push(homeDir);
    const sourcePath = join(homeDir, "downloads", "missing-skill-file");
    await fs.mkdir(sourcePath, { recursive: true });
    await fs.writeFile(join(sourcePath, "README.md"), "# Placeholder\n", "utf8");

    await expect(
      runImport({
        homeDir,
        sourcePath,
        skillName: "missing-skill-file"
      })
    ).rejects.toThrow("SKILL.md");
  });

  it("refuses to overwrite an existing managed skill with the same id", async () => {
    const homeDir = createTempHomeDir();
    tempHomes.push(homeDir);
    const firstSourcePath = await createSourceSkill(
      homeDir,
      "downloads/find-skills-v1"
    );
    const secondSourcePath = await createSourceSkill(
      homeDir,
      "downloads/find-skills-v2"
    );

    await runImport({
      homeDir,
      sourcePath: firstSourcePath,
      skillName: "find-skills"
    });

    await expect(
      runImport({
        homeDir,
        sourcePath: secondSourcePath,
        skillName: "find-skills"
      })
    ).rejects.toThrow("find-skills");
  });
});

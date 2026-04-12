import * as fs from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createManagedLink, isManagedLinkTarget } from "../../src/fs/link-ops";
import {
  isPathInside,
  normalizeAbsolutePath,
  pathsAreEqual
} from "../../src/fs/path-utils";
import { copySkillContentsToManagedStore } from "../../src/fs/safe-copy";
import { safeRemoveLink } from "../../src/fs/safe-remove-link";

const tempDirs: string[] = [];
const directoryLinkType = process.platform === "win32" ? "junction" : "dir";

function createTempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "skillmux-fs-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))
  );
});

describe("filesystem link operations", () => {
  it("creates a managed directory link and recognizes it as managed", async () => {
    const root = createTempRoot();
    const skillmuxHome = join(root, ".skillmux");
    const managedSkillPath = join(skillmuxHome, "skills", "demo");
    const agentLinkPath = join(root, ".codex", "skills", "demo");

    await fs.mkdir(managedSkillPath, { recursive: true });

    await createManagedLink(agentLinkPath, managedSkillPath);

    await expect(isManagedLinkTarget(agentLinkPath, skillmuxHome)).resolves.toBe(
      true
    );
  });

  it("does not classify non-managed links or plain directories as managed", async () => {
    const root = createTempRoot();
    const skillmuxHome = join(root, ".skillmux");
    const externalTarget = join(root, "external-skill");
    const externalLinkPath = join(root, ".claude", "skills", "external-skill");
    const plainDirectoryPath = join(root, ".claude", "skills", "plain");

    await fs.mkdir(externalTarget, { recursive: true });
    await fs.mkdir(plainDirectoryPath, { recursive: true });
    await createManagedLink(externalLinkPath, externalTarget);

    await expect(
      isManagedLinkTarget(externalLinkPath, skillmuxHome)
    ).resolves.toBe(false);
    await expect(isManagedLinkTarget(plainDirectoryPath, skillmuxHome)).resolves.toBe(
      false
    );
  });

  it("removes links but refuses to remove normal directories", async () => {
    const root = createTempRoot();
    const targetDir = join(root, "target");
    const linkPath = join(root, ".claude", "skills", "demo");
    const normalDirectory = join(root, ".claude", "skills", "normal");

    await fs.mkdir(targetDir, { recursive: true });
    await fs.mkdir(normalDirectory, { recursive: true });
    await createManagedLink(linkPath, targetDir);

    await expect(safeRemoveLink(linkPath)).resolves.toBe(true);
    await expect(fs.lstat(linkPath)).rejects.toThrow();

    await expect(safeRemoveLink(normalDirectory)).resolves.toBe(false);
    await expect(fs.lstat(normalDirectory)).resolves.toBeDefined();
  });

  it("copies skill contents recursively and rejects symlink entries in the source", async () => {
    const root = createTempRoot();
    const source = join(root, "source-skill");
    const target = join(root, ".skillmux", "skills", "copied");

    await fs.mkdir(join(source, "docs"), { recursive: true });
    await fs.writeFile(join(source, "SKILL.md"), "# Demo\n", "utf8");
    await fs.writeFile(join(source, "docs", "readme.md"), "hello\n", "utf8");

    await copySkillContentsToManagedStore(source, target);

    await expect(fs.readFile(join(target, "SKILL.md"), "utf8")).resolves.toContain(
      "Demo"
    );
    await expect(
      fs.readFile(join(target, "docs", "readme.md"), "utf8")
    ).resolves.toBe("hello\n");

    await fs.symlink(
      join(source, "docs"),
      join(source, "linked-docs"),
      directoryLinkType
    );

    await expect(
      copySkillContentsToManagedStore(source, join(root, ".skillmux", "skills", "bad"))
    ).rejects.toThrow(/symlink/i);
  });

  it("rejects symlink ancestors when creating links or copying into the managed store", async () => {
    const root = createTempRoot();
    const managedSkillPath = join(root, ".skillmux-real", "skills", "demo");
    const redirectedAgentRoot = join(root, "redirected-agent");
    const source = join(root, "source-skill");
    const redirectedStoreRoot = join(root, "redirected-store");

    await fs.mkdir(managedSkillPath, { recursive: true });
    await fs.mkdir(redirectedAgentRoot, { recursive: true });
    await fs.mkdir(redirectedStoreRoot, { recursive: true });
    await fs.mkdir(source, { recursive: true });
    await fs.writeFile(join(source, "SKILL.md"), "# Demo\n", "utf8");

    await fs.symlink(join(root, "redirected-agent"), join(root, ".codex"), directoryLinkType);
    await fs.symlink(
      join(root, "redirected-store"),
      join(root, ".skillmux"),
      directoryLinkType
    );

    await expect(
      createManagedLink(join(root, ".codex", "skills", "demo"), managedSkillPath)
    ).rejects.toThrow(/symlink/i);
    await expect(
      copySkillContentsToManagedStore(source, join(root, ".skillmux", "skills", "copied"))
    ).rejects.toThrow(/symlink/i);
  });

  it("normalizes and compares absolute paths safely", () => {
    const root = createTempRoot();
    const canonical = join(root, "skills", "demo");
    const variant = join(root, "skills", "..", "skills", "demo");
    const hiddenChild = join(root, "skills", "..hidden");
    const outside = join(root, "elsewhere");

    expect(pathsAreEqual(canonical, variant)).toBe(true);
    expect(normalizeAbsolutePath(variant)).toBe(normalizeAbsolutePath(canonical));
    expect(isPathInside(root, canonical)).toBe(true);
    expect(isPathInside(join(root, "skills"), hiddenChild)).toBe(true);
    expect(isPathInside(canonical, outside)).toBe(false);

    if (process.platform === "win32") {
      expect(isPathInside("C:\\skillmux", "D:\\elsewhere")).toBe(false);
    }
  });
});

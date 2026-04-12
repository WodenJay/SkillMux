import * as fs from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  assertNoSymlinkAncestors,
  isPathInside,
  pathsAreEqual
} from "./path-utils";

const directoryLinkType = process.platform === "win32" ? "junction" : "dir";

export async function createManagedLink(
  linkPath: string,
  targetPath: string
): Promise<void> {
  const resolvedLinkPath = resolve(linkPath);
  const resolvedTargetPath = resolve(targetPath);

  await assertNoSymlinkAncestors(resolvedLinkPath);
  await assertNoSymlinkAncestors(resolvedTargetPath, { includeLeaf: true });
  await fs.mkdir(dirname(resolvedLinkPath), { recursive: true });

  try {
    const existingEntry = await fs.lstat(resolvedLinkPath);

    if (!existingEntry.isSymbolicLink()) {
      throw new Error(`Refusing to replace non-link entry at ${resolvedLinkPath}`);
    }

    const currentTargetPath = await fs.realpath(resolvedLinkPath);
    if (pathsAreEqual(currentTargetPath, resolvedTargetPath)) {
      return;
    }

    throw new Error(`Refusing to replace link at ${resolvedLinkPath}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  await fs.symlink(resolvedTargetPath, resolvedLinkPath, directoryLinkType);
}

export async function isManagedLinkTarget(
  linkPath: string,
  skillmuxHome: string
): Promise<boolean> {
  try {
    const entry = await fs.lstat(linkPath);
    if (!entry.isSymbolicLink()) {
      return false;
    }

    const resolvedTargetPath = await fs.realpath(linkPath);
    return isPathInside(skillmuxHome, resolvedTargetPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

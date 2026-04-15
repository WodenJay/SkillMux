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
    if (
      (error as NodeJS.ErrnoException).code === "ENOENT" &&
      (await fs
        .lstat(resolvedLinkPath)
        .then((entry) => entry.isSymbolicLink())
        .catch(() => false))
    ) {
      await fs.rm(resolvedLinkPath, { recursive: true, force: false });
    } else if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  await fs.symlink(resolvedTargetPath, resolvedLinkPath, directoryLinkType);
}

export async function replaceEntryWithManagedLink(
  linkPath: string,
  targetPath: string,
  expectedCurrentPath: string
): Promise<boolean> {
  const resolvedLinkPath = resolve(linkPath);
  const resolvedTargetPath = resolve(targetPath);
  const resolvedExpectedCurrentPath = resolve(expectedCurrentPath);

  await assertNoSymlinkAncestors(resolvedLinkPath);
  await assertNoSymlinkAncestors(resolvedTargetPath, { includeLeaf: true });
  await fs.mkdir(dirname(resolvedLinkPath), { recursive: true });

  const existingEntry = await fs.lstat(resolvedLinkPath);

  if (existingEntry.isSymbolicLink()) {
    const currentTargetPath = await fs.realpath(resolvedLinkPath);

    if (pathsAreEqual(currentTargetPath, resolvedTargetPath)) {
      return false;
    }

    if (!pathsAreEqual(currentTargetPath, resolvedExpectedCurrentPath)) {
      throw new Error(`Refusing to replace unexpected link at ${resolvedLinkPath}`);
    }

    await fs.rm(resolvedLinkPath, { recursive: true, force: false });
    await fs.symlink(resolvedTargetPath, resolvedLinkPath, directoryLinkType);
    return true;
  }

  if (!existingEntry.isDirectory()) {
    throw new Error(`Refusing to replace non-directory entry at ${resolvedLinkPath}`);
  }

  const currentPath = await fs.realpath(resolvedLinkPath);
  if (!pathsAreEqual(currentPath, resolvedExpectedCurrentPath)) {
    throw new Error(`Refusing to replace unexpected directory at ${resolvedLinkPath}`);
  }

  await fs.rm(resolvedLinkPath, { recursive: true, force: false });
  await fs.symlink(resolvedTargetPath, resolvedLinkPath, directoryLinkType);
  return true;
}

export async function isLinkPointingToTarget(
  linkPath: string,
  targetPath: string
): Promise<boolean> {
  try {
    const entry = await fs.lstat(linkPath);
    if (!entry.isSymbolicLink()) {
      return false;
    }

    const resolvedTargetPath = await fs.realpath(linkPath);
    return pathsAreEqual(resolvedTargetPath, targetPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw error;
  }
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

import * as fs from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  assertNoSymlinkAncestors,
  isPathInside,
  pathsAreEqual
} from "./path-utils";

async function assertDirectory(path: string): Promise<void> {
  const entry = await fs.lstat(path);
  if (!entry.isDirectory()) {
    throw new Error(`Expected a directory at ${path}`);
  }
}

async function assertTargetDoesNotExist(path: string): Promise<void> {
  try {
    await fs.lstat(path);
    throw new Error(`Refusing to overwrite existing path at ${path}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

async function copyDirectoryContents(sourcePath: string, targetPath: string): Promise<void> {
  await fs.mkdir(targetPath, { recursive: true });
  const entries = await fs.readdir(sourcePath, { withFileTypes: true });

  for (const entry of entries) {
    const sourceEntryPath = join(sourcePath, entry.name);
    const targetEntryPath = join(targetPath, entry.name);
    const entryStats = await fs.lstat(sourceEntryPath);

    if (entryStats.isSymbolicLink()) {
      throw new Error(`Refusing to copy source symlink at ${sourceEntryPath}`);
    }

    if (entryStats.isDirectory()) {
      await copyDirectoryContents(sourceEntryPath, targetEntryPath);
      continue;
    }

    if (entryStats.isFile()) {
      await fs.mkdir(dirname(targetEntryPath), { recursive: true });
      await fs.copyFile(sourceEntryPath, targetEntryPath);
      continue;
    }

    throw new Error(`Unsupported filesystem entry at ${sourceEntryPath}`);
  }
}

export async function copySkillContentsToManagedStore(
  sourcePath: string,
  targetPath: string
): Promise<void> {
  const resolvedSourcePath = resolve(sourcePath);
  const resolvedTargetPath = resolve(targetPath);

  if (pathsAreEqual(resolvedSourcePath, resolvedTargetPath)) {
    throw new Error("Source and target paths must differ");
  }

  if (isPathInside(resolvedSourcePath, resolvedTargetPath)) {
    throw new Error("Refusing to copy into a child of the source directory");
  }

  await assertNoSymlinkAncestors(resolvedSourcePath, { includeLeaf: true });
  await assertNoSymlinkAncestors(resolvedTargetPath);
  await assertDirectory(resolvedSourcePath);
  await assertTargetDoesNotExist(resolvedTargetPath);
  await copyDirectoryContents(resolvedSourcePath, resolvedTargetPath);
}

import * as fs from "node:fs/promises";
import { dirname, parse, relative, resolve, sep } from "node:path";

export function normalizeAbsolutePath(path: string): string {
  const normalized = resolve(path);
  return process.platform === "win32"
    ? normalized.replaceAll("/", "\\").toLowerCase()
    : normalized;
}

export function pathsAreEqual(left: string, right: string): boolean {
  return normalizeAbsolutePath(left) === normalizeAbsolutePath(right);
}

export function isPathInside(parentPath: string, childPath: string): boolean {
  const parent = normalizeAbsolutePath(parentPath);
  const child = normalizeAbsolutePath(childPath);

  if (parse(parent).root !== parse(child).root) {
    return false;
  }

  const relativePath = relative(parent, child);

  if (relativePath === "") {
    return true;
  }

  if (relativePath === "..") {
    return false;
  }

  if (relativePath.startsWith(`..${sep}`)) {
    return false;
  }

  return true;
}

export async function assertNoSymlinkAncestors(
  path: string,
  options?: { includeLeaf?: boolean }
): Promise<void> {
  let current = options?.includeLeaf === true ? resolve(path) : dirname(resolve(path));

  while (true) {
    try {
      const entry = await fs.lstat(current);
      if (entry.isSymbolicLink()) {
        throw new Error(`Refusing to use path with symlink ancestor at ${current}`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }

    const parent = dirname(current);
    if (parent === current) {
      return;
    }

    current = parent;
  }
}

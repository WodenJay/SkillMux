import * as fs from "node:fs/promises";

export async function safeRemoveLink(path: string): Promise<boolean> {
  try {
    const entry = await fs.lstat(path);

    if (!entry.isSymbolicLink()) {
      return false;
    }

    await fs.rm(path, { recursive: true, force: false });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

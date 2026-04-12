import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import { join } from "node:path";
import type { Manifest } from "../core/types";

function getManifestPath(home: string): string {
  return join(home, "manifest.json");
}

export function createManifestTempPath(manifestPath: string): string {
  return `${manifestPath}.${process.pid}.${randomUUID()}.tmp`;
}

export async function writeManifest(
  home: string,
  manifest: Manifest
): Promise<void> {
  await fs.mkdir(home, { recursive: true });

  const manifestPath = getManifestPath(home);
  const tempPath = createManifestTempPath(manifestPath);
  const contents = `${JSON.stringify(manifest, null, 2)}\n`;

  await fs.writeFile(tempPath, contents, "utf8");

  try {
    await fs.rename(tempPath, manifestPath);
  } catch (error) {
    await fs.unlink(tempPath).catch(() => undefined);
    throw error;
  }
}

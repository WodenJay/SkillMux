import * as fs from "node:fs/promises";
import { join, resolve } from "node:path";
import { ManifestValidationError } from "../core/errors";
import type { Manifest } from "../core/types";
import { buildEmptyManifest } from "./build-empty-manifest";
import { manifestSchema } from "./manifest-schema";
import { formatValidationIssues } from "./read-manifest";

export type ManifestSnapshot = {
  manifest: Manifest;
  exists: boolean;
};

function normalizeHomePath(home: string): string {
  const resolvedHome = resolve(home);
  return process.platform === "win32"
    ? resolvedHome.toLowerCase()
    : resolvedHome;
}

export async function readManifestSnapshot(
  home: string
): Promise<ManifestSnapshot> {
  const manifestPath = join(home, "manifest.json");

  try {
    const contents = await fs.readFile(manifestPath, "utf8");
    const parsed = manifestSchema.safeParse(JSON.parse(contents) as unknown);

    if (!parsed.success) {
      throw new ManifestValidationError(
        `Invalid manifest at ${manifestPath}: ${formatValidationIssues(parsed.error)}`
      );
    }

    if (normalizeHomePath(parsed.data.skillmuxHome) !== normalizeHomePath(home)) {
      throw new ManifestValidationError(
        `Invalid manifest at ${manifestPath}: skillmuxHome must match ${home}`
      );
    }

    return { manifest: parsed.data, exists: true };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return { manifest: buildEmptyManifest(home), exists: false };
    }

    if (error instanceof SyntaxError) {
      throw new ManifestValidationError(
        `Invalid manifest at ${manifestPath}: malformed JSON`
      );
    }

    throw error;
  }
}

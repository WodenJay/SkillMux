import * as fs from "node:fs/promises";
import { join } from "node:path";
import { ManifestValidationError } from "../core/errors";
import type { Manifest } from "../core/types";
import { buildEmptyManifest } from "./build-empty-manifest";
import { manifestSchema } from "./manifest-schema";
import { writeManifest } from "./write-manifest";

function getManifestPath(home: string): string {
  return join(home, "manifest.json");
}

function formatValidationIssues(error: { issues: Array<{ path: (string | number)[]; message: string }> }): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

export async function readManifest(home: string): Promise<Manifest> {
  const manifestPath = getManifestPath(home);

  try {
    const contents = await fs.readFile(manifestPath, "utf8");
    const parsedJson = JSON.parse(contents) as unknown;
    const parsedManifest = manifestSchema.safeParse(parsedJson);

    if (!parsedManifest.success) {
      throw new ManifestValidationError(
        `Invalid manifest at ${manifestPath}: ${formatValidationIssues(parsedManifest.error)}`
      );
    }

    return parsedManifest.data;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      const emptyManifest = buildEmptyManifest(home);
      await writeManifest(home, emptyManifest);
      return emptyManifest;
    }

    if (error instanceof SyntaxError) {
      throw new ManifestValidationError(
        `Invalid manifest at ${manifestPath}: malformed JSON`
      );
    }

    throw error;
  }
}

import * as fs from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ManifestValidationError } from "../../src/core/errors";
import type { Manifest } from "../../src/core/types";
import { readManifestSnapshot } from "../../src/manifest/read-manifest-snapshot";
import { cleanupTempHomeDir, createTempHomeDir } from "../helpers/temp-env";

async function writeManifestFile(home: string, contents: string): Promise<string> {
  const manifestPath = join(home, "manifest.json");
  await fs.writeFile(manifestPath, contents, "utf8");
  return manifestPath;
}

function buildManifest(home: string): Manifest {
  return {
    version: 1,
    skillmuxHome: home,
    skills: {
      "terminal-ui": {
        id: "terminal-ui",
        name: "terminal-ui",
        path: join(home, "skills", "terminal-ui"),
        source: {
          kind: "imported",
          path: join(home, "source", "terminal-ui")
        },
        importedAt: "2026-04-16T00:00:00.000Z"
      }
    },
    agents: {},
    activations: [],
    lastScan: {
      at: null,
      issues: []
    }
  };
}

describe("readManifestSnapshot", () => {
  it("returns an empty manifest without creating manifest.json", async () => {
    const home = createTempHomeDir();

    try {
      const result = await readManifestSnapshot(home);

      expect(result.manifest.skills).toEqual({});
      await expect(fs.lstat(join(home, "manifest.json"))).rejects.toMatchObject({
        code: "ENOENT"
      });
    } finally {
      cleanupTempHomeDir(home);
    }
  });

  it("returns an existing manifest without rewriting it", async () => {
    const home = createTempHomeDir();

    try {
      const manifest = buildManifest(home);
      const contents = `${JSON.stringify(manifest, null, 2)}\n`;
      const manifestPath = await writeManifestFile(home, contents);

      const result = await readManifestSnapshot(home);

      expect(result).toEqual({
        manifest,
        exists: true
      });
      await expect(fs.readFile(manifestPath, "utf8")).resolves.toBe(contents);
    } finally {
      cleanupTempHomeDir(home);
    }
  });

  it("rejects malformed JSON without changing the existing file", async () => {
    const home = createTempHomeDir();

    try {
      const contents = "{ bad json";
      const manifestPath = await writeManifestFile(home, contents);

      await expect(readManifestSnapshot(home)).rejects.toThrow(
        ManifestValidationError
      );
      await expect(readManifestSnapshot(home)).rejects.toThrow(/malformed JSON/);
      await expect(fs.readFile(manifestPath, "utf8")).resolves.toBe(contents);
    } finally {
      cleanupTempHomeDir(home);
    }
  });

  it("rejects invalid schemas with field details without changing the existing file", async () => {
    const home = createTempHomeDir();

    try {
      const manifest = buildManifest(home);
      const invalidManifest = {
        ...manifest,
        lastScan: {
          at: null,
          issues: [
            {
              severity: "warning",
              message: "Missing code"
            }
          ]
        }
      };
      const contents = `${JSON.stringify(invalidManifest, null, 2)}\n`;
      const manifestPath = await writeManifestFile(home, contents);

      await expect(readManifestSnapshot(home)).rejects.toThrow(
        ManifestValidationError
      );
      await expect(readManifestSnapshot(home)).rejects.toThrow(
        /lastScan\.issues\.0\.code/
      );
      await expect(fs.readFile(manifestPath, "utf8")).resolves.toBe(contents);
    } finally {
      cleanupTempHomeDir(home);
    }
  });

  it("rejects mismatched skillmuxHome without changing the existing file", async () => {
    const home = createTempHomeDir();

    try {
      const manifest = {
        ...buildManifest(home),
        skillmuxHome: join(home, "other-skillmux-home")
      };
      const contents = `${JSON.stringify(manifest, null, 2)}\n`;
      const manifestPath = await writeManifestFile(home, contents);

      await expect(readManifestSnapshot(home)).rejects.toThrow(
        ManifestValidationError
      );
      await expect(readManifestSnapshot(home)).rejects.toThrow(
        /skillmuxHome must match/
      );
      await expect(fs.readFile(manifestPath, "utf8")).resolves.toBe(contents);
    } finally {
      cleanupTempHomeDir(home);
    }
  });
});

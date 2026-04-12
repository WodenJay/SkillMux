import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ManifestValidationError } from "../../src/core/errors";
import { buildEmptyManifest } from "../../src/manifest/build-empty-manifest";
import { readManifest } from "../../src/manifest/read-manifest";
import {
  createManifestTempPath,
  writeManifest
} from "../../src/manifest/write-manifest";

describe("manifest persistence", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createTempHome(): string {
    return mkdtempSync(join(tmpdir(), "skillmux-"));
  }

  function cleanupTempHome(home: string): void {
    rmSync(home, { recursive: true, force: true });
  }

  it("round-trips a manifest on disk", async () => {
    const home = createTempHome();

    try {
      const manifest = buildEmptyManifest(home);

      await writeManifest(home, manifest);

      const loaded = await readManifest(home);

      expect(loaded).toEqual(manifest);
      expect(readFileSync(join(home, "manifest.json"), "utf8")).toBe(
        `${JSON.stringify(manifest, null, 2)}\n`
      );
    } finally {
      cleanupTempHome(home);
    }
  });

  it("creates and persists an empty manifest when missing", async () => {
    const home = createTempHome();

    try {
      const manifest = await readManifest(home);

      expect(manifest).toEqual(buildEmptyManifest(home));
      expect(readFileSync(join(home, "manifest.json"), "utf8")).toBe(
        `${JSON.stringify(manifest, null, 2)}\n`
      );
    } finally {
      cleanupTempHome(home);
    }
  });

  it("throws a typed error for invalid manifest data", async () => {
    const home = createTempHome();

    try {
      writeFileSync(
        join(home, "manifest.json"),
        JSON.stringify(
          {
            version: 1,
            skillmuxHome: home,
            skills: {},
            agents: {},
            activations: [],
            lastScan: {
              at: null,
              issues: [
                {
                  code: "",
                  severity: "warning",
                  message: ""
                }
              ]
            }
          },
          null,
          2
        ) + "\n",
        "utf8"
      );

      await expect(readManifest(home)).rejects.toBeInstanceOf(
        ManifestValidationError
      );
    } finally {
      cleanupTempHome(home);
    }
  });

  it("throws a typed error for malformed manifest json", async () => {
    const home = createTempHome();

    try {
      writeFileSync(join(home, "manifest.json"), "{", "utf8");

      await expect(readManifest(home)).rejects.toBeInstanceOf(
        ManifestValidationError
      );
    } finally {
      cleanupTempHome(home);
    }
  });

  it("rejects a manifest whose skillmuxHome does not match the requested home", async () => {
    const home = createTempHome();

    try {
      const manifest = buildEmptyManifest("C:/other-home");

      writeFileSync(
        join(home, "manifest.json"),
        `${JSON.stringify(manifest, null, 2)}\n`,
        "utf8"
      );

      await expect(readManifest(home)).rejects.toBeInstanceOf(
        ManifestValidationError
      );
    } finally {
      cleanupTempHome(home);
    }
  });

  it("creates unique temp paths even within the same millisecond", () => {
    const home = createTempHome();

    vi.spyOn(Date, "now").mockReturnValue(1);

    try {
      const manifestPath = join(home, "manifest.json");
      const firstTempPath = createManifestTempPath(manifestPath);
      const secondTempPath = createManifestTempPath(manifestPath);

      expect(firstTempPath).not.toBe(secondTempPath);
      expect(firstTempPath).toMatch(/\.tmp$/);
      expect(secondTempPath).toMatch(/\.tmp$/);
    } finally {
      cleanupTempHome(home);
    }
  });

});

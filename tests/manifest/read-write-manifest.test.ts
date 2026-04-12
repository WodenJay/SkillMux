import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ManifestValidationError } from "../../src/core/errors";
import { buildEmptyManifest } from "../../src/manifest/build-empty-manifest";
import { readManifest } from "../../src/manifest/read-manifest";
import { writeManifest } from "../../src/manifest/write-manifest";

describe("manifest persistence", () => {
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

});

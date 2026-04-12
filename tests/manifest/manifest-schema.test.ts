import { describe, expect, it } from "vitest";
import { buildEmptyManifest } from "../../src/manifest/build-empty-manifest";
import { manifestSchema } from "../../src/manifest/manifest-schema";

describe("manifestSchema", () => {
  it("accepts an empty manifest built for a skillmux home", () => {
    const skillmuxHome = "C:/skillmux";
    const manifest = buildEmptyManifest(skillmuxHome);

    expect(manifestSchema.parse(manifest)).toEqual({
      version: 1,
      skillmuxHome,
      skills: {},
      agents: {},
      activations: [],
      lastScan: {
        at: null,
        issues: [],
      },
    });
  });
});

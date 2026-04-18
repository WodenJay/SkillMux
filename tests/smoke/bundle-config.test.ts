import { describe, expect, it } from "vitest";
import tsupConfig from "../../tsup.config";

describe("bundle configuration", () => {
  it("preserves the dynamic tui launcher boundary in ESM output", () => {
    const configs = Array.isArray(tsupConfig) ? tsupConfig : [tsupConfig];

    expect(configs).toHaveLength(1);
    expect(configs[0]).toEqual(
      expect.objectContaining({
        format: ["esm"],
        splitting: true
      })
    );
  });
});

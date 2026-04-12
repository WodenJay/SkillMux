import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm"],
  clean: true,
  dts: true,
  splitting: false,
  sourcemap: true,
  target: "node20"
});

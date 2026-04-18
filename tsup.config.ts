import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm"],
  clean: true,
  dts: true,
  splitting: true,
  sourcemap: true,
  target: "node20"
});

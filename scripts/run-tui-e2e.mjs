import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join, sep } from "node:path";

const mode = process.argv[2] ?? "regression";
const scenarioArg =
  mode === "explore"
    ? ["tests/tui-e2e/scenarios/usability-probes.test.ts"]
    : await collectTestFiles("tests/tui-e2e");

async function collectTestFiles(rootDir) {
  const files = [];

  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".test.ts")) {
        files.push(fullPath.split(sep).join("/"));
      }
    }
  }

  await walk(rootDir);
  files.sort();
  return files;
}

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...extraEnv }
  });

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npm", ["run", "build"]);
run("npm", ["test", "--", ...scenarioArg], {
  SKILLMUX_TUI_ARTIFACTS: mode === "explore" ? "always" : "on-failure",
  SKILLMUX_TUI_EXPLORE: mode === "explore" ? "1" : "0"
});

# SkillMux TUI PTY Exploration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a PTY-driven TUI exploration harness that can launch `skillmux tui`, drive it like a user inside a temporary sandbox, capture event logs plus screen snapshots, and verify real lifecycle side effects.

**Architecture:** The harness will keep session-driving code in `tests/tui-e2e/` and use the existing built CLI entrypoint at `dist/cli.js` as the spawned target. A small Node runner script will build first, then run either exploratory or regression Vitest scenarios so the repo does not need an extra TypeScript script runtime such as `tsx`.

**Tech Stack:** Node.js, TypeScript, Vitest, Ink, Commander, `node-pty`, `@xterm/headless`, optional `@xterm/addon-serialize`

---

## Required Skills During Implementation

- Use `$terminal-ui` before changing TUI behavior, keyboard handling, or terminal-session assumptions.
- Use `superpowers:test-driven-development` for every task.
- Use `superpowers:subagent-driven-development` for execution unless the user explicitly chooses inline execution.
- Use `superpowers:verification-before-completion` before each commit or acceptance claim.

## Planned File Structure

### Package And Runner

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`
- Create: `scripts/run-tui-e2e.mjs`

### PTY Harness Support

- Create: `tests/tui-e2e/pty-session.ts`
- Create: `tests/tui-e2e/screen.ts`
- Create: `tests/tui-e2e/artifacts.ts`
- Create: `tests/tui-e2e/fixtures.ts`
- Create: `tests/tui-e2e/sandbox.ts`
- Create: `tests/tui-e2e/explorer.ts`

### PTY Harness Tests

- Create: `tests/tui-e2e/screen.test.ts`
- Create: `tests/tui-e2e/sandbox.test.ts`
- Create: `tests/tui-e2e/explorer.test.ts`
- Create: `tests/tui-e2e/scenarios/smoke.test.ts`
- Create: `tests/tui-e2e/scenarios/lifecycle-flow.test.ts`
- Create: `tests/tui-e2e/scenarios/usability-probes.test.ts`

### Tracking Docs

- Modify: `AGENTS.md`
- Modify: `PROJECT_STATUS.md`
- Modify: `NEXT_ACTIONS.md`
- Modify: `DECISIONS.md`
- Modify: `docs/superpowers/plans/2026-04-21-skillmux-tui-pty-exploration-implementation-plan.md`

## Implementation Order

Build the PTY exploration layer in six slices. Each slice ends with the targeted verification listed in the task, plus `npm run typecheck` if the task changes the TypeScript surface.

### Task 1: Add PTY Dependencies And Developer Entrypoints

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`
- Create: `scripts/run-tui-e2e.mjs`
- Test: `tests/tui-e2e/scenarios/smoke.test.ts`

- [x] **Step 1: Add the PTY and terminal-buffer dependencies**

Update `package.json`:

```json
{
  "scripts": {
    "build": "tsup",
    "test": "vitest run --configLoader runner",
    "typecheck": "tsc --noEmit",
    "test:tui-e2e": "node scripts/run-tui-e2e.mjs regression",
    "tui:explore": "node scripts/run-tui-e2e.mjs explore"
  },
  "devDependencies": {
    "@types/node": "^22.15.21",
    "@types/react": "^19.2.14",
    "@xterm/addon-serialize": "^0.13.0",
    "@xterm/headless": "^5.5.0",
    "ink-testing-library": "^4.0.0",
    "node-pty": "^1.0.0",
    "tsup": "^8.5.0",
    "typescript": "^5.8.3",
    "vitest": "^3.1.4"
  }
}
```

Expected: `package-lock.json` records the new packages and the two new npm scripts.

- [x] **Step 2: Ignore exploration artifacts**

Update `.gitignore`:

```gitignore
.worktrees/
.superpowers/
.artifacts/
node_modules/
dist/
skills-lock.json
```

Expected: local screen snapshots and event logs can live under `.artifacts/` without showing up in `git status`.

- [x] **Step 3: Write the first failing smoke scenario**

Create `tests/tui-e2e/scenarios/smoke.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { createScenarioFixture } from "../fixtures";
import { startExplorer } from "../explorer";

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
});

describe("tui pty smoke", () => {
  it("launches the dashboard and exits on q", async () => {
    const fixture = await createScenarioFixture({
      agents: ["codex"],
      managedEnabled: [{ agentId: "codex", skillName: "using-superpowers" }]
    });
    cleanups.push(fixture.cleanup);

    const explorer = await startExplorer({
      homeDir: fixture.homeDir,
      skillmuxHome: fixture.skillmuxHome,
      cols: 100,
      rows: 30,
      scenarioName: "smoke-launch-quit"
    });

    await explorer.waitForText("Skills for codex");
    await explorer.snapshot("initial-dashboard");
    await explorer.press("q");
    await explorer.waitForExit();

    expect(explorer.currentScreen()).toContain("Skills for codex");
    expect(explorer.exitCode()).toBe(0);
  });
});
```

- [x] **Step 4: Run the smoke scenario to verify the red state**

Run:

```powershell
npm run build
```

Expected: PASS.

Run:

```powershell
npm test -- --run tests/tui-e2e/scenarios/smoke.test.ts
```

Expected: FAIL because `fixtures.ts` and `explorer.ts` do not exist.

- [x] **Step 5: Add the runner script for regression and exploration modes**

Create `scripts/run-tui-e2e.mjs`:

```js
import { spawnSync } from "node:child_process";

const mode = process.argv[2] ?? "regression";
const scenarioArg = mode === "explore"
  ? "tests/tui-e2e/scenarios/usability-probes.test.ts"
  : "tests/tui-e2e/**/*.test.ts";

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
run(
  "npm",
  ["test", "--", "--run", scenarioArg],
  {
    SKILLMUX_TUI_ARTIFACTS: mode === "explore" ? "always" : "on-failure",
    SKILLMUX_TUI_EXPLORE: mode === "explore" ? "1" : "0"
  }
);
```

Implementation note: in the current Windows PowerShell + Vitest environment, passing the literal regression glob above through `npm test -- --run` returns `No test files found`. The accepted implementation enumerates concrete `.test.ts` files under `tests/tui-e2e/` for regression mode while keeping the same explore target and environment-variable contract.

- [x] **Step 6: Run the new developer entrypoint and commit**

Run:

```powershell
node scripts/run-tui-e2e.mjs regression
```

Expected: still FAIL because the harness files are missing, but the runner builds and invokes the intended Vitest target.

Commit:

```powershell
git add package.json package-lock.json .gitignore scripts/run-tui-e2e.mjs tests/tui-e2e/scenarios/smoke.test.ts
git commit -m "test: bootstrap tui pty runner"
```

### Task 2: Build Screen And Artifact Primitives

**Files:**
- Create: `tests/tui-e2e/screen.ts`
- Create: `tests/tui-e2e/artifacts.ts`
- Test: `tests/tui-e2e/screen.test.ts`

- [x] **Step 1: Write failing screen-buffer tests**

Create `tests/tui-e2e/screen.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createScreenBuffer } from "./screen";

describe("createScreenBuffer", () => {
  it("renders plain text writes into a stable snapshot", async () => {
    const screen = createScreenBuffer({ cols: 20, rows: 5 });

    await screen.write("hello\r\nworld");

    expect(screen.snapshot()).toContain("hello");
    expect(screen.snapshot()).toContain("world");
  });

  it("keeps the latest serialized frame for artifact output", async () => {
    const screen = createScreenBuffer({ cols: 20, rows: 5 });

    await screen.write("frame one");
    await screen.write("\rframe two");

    expect(screen.snapshot()).toContain("frame two");
  });
});
```

- [x] **Step 2: Run the test to verify the red state**

Run:

```powershell
npm test -- --run tests/tui-e2e/screen.test.ts
```

Expected: FAIL because `tests/tui-e2e/screen.ts` does not exist.

- [x] **Step 3: Implement the screen buffer with `@xterm/headless`**

Create `tests/tui-e2e/screen.ts`:

```ts
import { Terminal } from "@xterm/headless";
import { SerializeAddon } from "@xterm/addon-serialize";

export type ScreenBuffer = {
  write(data: string): Promise<void>;
  resize(cols: number, rows: number): void;
  snapshot(): string;
};

export function createScreenBuffer({
  cols,
  rows
}: {
  cols: number;
  rows: number;
}): ScreenBuffer {
  const terminal = new Terminal({ cols, rows });
  const serialize = new SerializeAddon();
  terminal.loadAddon(serialize);

  return {
    write(data: string) {
      return new Promise((resolve) => {
        terminal.write(data, resolve);
      });
    },
    resize(nextCols: number, nextRows: number) {
      terminal.resize(nextCols, nextRows);
    },
    snapshot() {
      return serialize.serialize();
    }
  };
}
```

- [x] **Step 4: Add artifact helpers for logs and snapshots**

Create `tests/tui-e2e/artifacts.ts`:

```ts
import * as fs from "node:fs/promises";
import { join } from "node:path";

export type ArtifactRecorder = {
  recordEvent(event: Record<string, unknown>): void;
  writeSnapshot(name: string, content: string): Promise<void>;
  flush(): Promise<void>;
  rootDir: string;
};

export async function createArtifactRecorder({
  scenarioName
}: {
  scenarioName: string;
}): Promise<ArtifactRecorder> {
  const rootDir = join(process.cwd(), ".artifacts", "tui-e2e", scenarioName);
  const events: Array<Record<string, unknown>> = [];

  await fs.mkdir(rootDir, { recursive: true });

  return {
    rootDir,
    recordEvent(event) {
      events.push({
        at: new Date().toISOString(),
        ...event
      });
    },
    async writeSnapshot(name, content) {
      await fs.writeFile(join(rootDir, `${name}.txt`), content, "utf8");
    },
    async flush() {
      await fs.writeFile(
        join(rootDir, "events.json"),
        `${JSON.stringify(events, null, 2)}\n`,
        "utf8"
      );
    }
  };
}
```

- [x] **Step 5: Run targeted tests and commit**

Run:

```powershell
npm test -- --run tests/tui-e2e/screen.test.ts
```

Expected: PASS.

Run:

```powershell
npm run typecheck
```

Expected: PASS.

Implementation note: while Task 2 was being accepted, `npm run typecheck` still failed for the same pre-existing Task 1 bootstrap imports in `tests/tui-e2e/scenarios/smoke.test.ts` (`../fixtures` and `../explorer`). Task 2 acceptance therefore required confirming that the new screen/artifact files did not introduce any additional typecheck failures.

Commit:

```powershell
git add tests/tui-e2e/screen.ts tests/tui-e2e/artifacts.ts tests/tui-e2e/screen.test.ts
git commit -m "test: add tui screen artifact primitives"
```

### Task 3: Build The PTY Session Driver

**Files:**
- Create: `tests/tui-e2e/pty-session.ts`
- Modify: `tests/tui-e2e/scenarios/smoke.test.ts`

- [ ] **Step 1: Extend the smoke scenario to depend on a real PTY session**

Update `tests/tui-e2e/scenarios/smoke.test.ts` so it expects a spawned CLI process, not a fake buffer-only explorer:

```ts
expect(explorer.eventLog()).toEqual(
  expect.arrayContaining([
    expect.objectContaining({ type: "spawn" }),
    expect.objectContaining({ type: "keypress", key: "q" }),
    expect.objectContaining({ type: "exit", code: 0 })
  ])
);
```

- [ ] **Step 2: Run the smoke scenario to verify the red state**

Run:

```powershell
npm run build
```

Expected: PASS.

Run:

```powershell
npm test -- --run tests/tui-e2e/scenarios/smoke.test.ts
```

Expected: FAIL because the PTY session layer does not exist yet.

- [ ] **Step 3: Implement the PTY session**

Create `tests/tui-e2e/pty-session.ts`:

```ts
import { join } from "node:path";
import pty from "node-pty";
import { createScreenBuffer } from "./screen";
import { createArtifactRecorder } from "./artifacts";

export async function createPtySession(options: {
  homeDir: string;
  skillmuxHome: string;
  cols: number;
  rows: number;
  scenarioName: string;
}) {
  const screen = createScreenBuffer({ cols: options.cols, rows: options.rows });
  const artifacts = await createArtifactRecorder({
    scenarioName: options.scenarioName
  });
  const child = pty.spawn(
    process.execPath,
    [join(process.cwd(), "dist", "cli.js"), "tui"],
    {
      cols: options.cols,
      rows: options.rows,
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOME: options.homeDir,
        USERPROFILE: options.homeDir,
        SKILLMUX_HOME: options.skillmuxHome,
        FORCE_COLOR: "0"
      }
    }
  );

  child.onData((chunk) => {
    void screen.write(chunk);
    artifacts.recordEvent({ type: "data", size: chunk.length });
  });

  return {
    async press(data: string) {
      artifacts.recordEvent({ type: "keypress", key: data });
      child.write(data);
    },
    resize(cols: number, rows: number) {
      artifacts.recordEvent({ type: "resize", cols, rows });
      child.resize(cols, rows);
      screen.resize(cols, rows);
    },
    snapshot() {
      return screen.snapshot();
    }
  };
}
```

- [ ] **Step 4: Add settle and exit helpers**

Extend `tests/tui-e2e/pty-session.ts` with:

```ts
async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForText(
  read: () => string,
  pattern: string,
  timeoutMs = 4000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (read().includes(pattern)) {
      return;
    }
    await sleep(25);
  }
  throw new Error(`Timed out waiting for text: ${pattern}`);
}
```

Expected: the session object exposes `waitForText`, `waitForExit`, `exitCode`, and `flushArtifacts`.

- [ ] **Step 5: Run the smoke scenario and commit**

Run:

```powershell
npm run build
```

Expected: PASS.

Run:

```powershell
npm test -- --run tests/tui-e2e/scenarios/smoke.test.ts
```

Expected: PASS.

Commit:

```powershell
git add tests/tui-e2e/pty-session.ts tests/tui-e2e/scenarios/smoke.test.ts
git commit -m "test: add tui pty session driver"
```

### Task 4: Build Scenario Fixtures And Temporary Sandbox Control

**Files:**
- Create: `tests/tui-e2e/fixtures.ts`
- Create: `tests/tui-e2e/sandbox.ts`
- Test: `tests/tui-e2e/sandbox.test.ts`

- [ ] **Step 1: Write failing sandbox tests**

Create `tests/tui-e2e/sandbox.test.ts`:

```ts
import * as fs from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createScenarioFixture } from "./fixtures";

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
});

describe("createScenarioFixture", () => {
  it("creates a managed enabled skill and an unmanaged skill in separate locations", async () => {
    const fixture = await createScenarioFixture({
      agents: ["codex"],
      managedEnabled: [{ agentId: "codex", skillName: "using-superpowers" }],
      unmanaged: [{ agentId: "codex", skillName: "find-skills" }]
    });
    cleanups.push(fixture.cleanup);

    await expect(
      fs.lstat(join(fixture.skillmuxHome, "skills", "using-superpowers", "SKILL.md"))
    ).resolves.toBeDefined();
    await expect(
      fs.lstat(join(fixture.homeDir, ".codex", "skills", "find-skills", "SKILL.md"))
    ).resolves.toBeDefined();
  });
});
```

- [ ] **Step 2: Run the sandbox test to verify the red state**

Run:

```powershell
npm test -- --run tests/tui-e2e/sandbox.test.ts
```

Expected: FAIL because fixture helpers do not exist.

- [ ] **Step 3: Implement the sandbox builder on top of existing temp-home helpers**

Create `tests/tui-e2e/sandbox.ts`:

```ts
import * as fs from "node:fs/promises";
import { join } from "node:path";
import { createManagedLink } from "../../src/fs/link-ops";
import { resolveSkillmuxHome } from "../../src/config/resolve-skillmux-home";
import {
  cleanupTempHomeDir,
  createTempHomeDir,
  ensureDirectory
} from "../helpers/temp-env";

const directoryLinkType = process.platform === "win32" ? "junction" : "dir";

export async function createSandbox() {
  const homeDir = createTempHomeDir();
  const { skillmuxHome } = resolveSkillmuxHome(homeDir);

  await fs.mkdir(skillmuxHome, { recursive: true });

  return {
    homeDir,
    skillmuxHome,
    async writeSkill(relativePath: string, skillName: string) {
      const target = join(homeDir, relativePath);
      await fs.mkdir(target, { recursive: true });
      await fs.writeFile(join(target, "SKILL.md"), `# ${skillName}\n`, "utf8");
      return target;
    },
    async linkManaged(agentId: string, skillName: string) {
      const managedPath = join(skillmuxHome, "skills", skillName);
      ensureDirectory(managedPath);
      await fs.writeFile(join(managedPath, "SKILL.md"), `# ${skillName}\n`, "utf8");
      await createManagedLink(
        join(homeDir, `.${agentId}`, "skills", skillName),
        managedPath
      );
    },
    cleanup() {
      cleanupTempHomeDir(homeDir);
    }
  };
}
```

- [ ] **Step 4: Add declarative fixture helpers**

Create `tests/tui-e2e/fixtures.ts`:

```ts
import { createSandbox } from "./sandbox";
import { ensureDirectory } from "../helpers/temp-env";
import { join } from "node:path";

export async function createScenarioFixture(input: {
  agents: string[];
  managedEnabled?: Array<{ agentId: string; skillName: string }>;
  managedDisabled?: Array<{ agentId: string; skillName: string }>;
  unmanaged?: Array<{ agentId: string; skillName: string }>;
}) {
  const sandbox = await createSandbox();

  for (const agentId of input.agents) {
    ensureDirectory(join(sandbox.homeDir, `.${agentId}`, "skills"));
  }

  for (const item of input.managedEnabled ?? []) {
    await sandbox.linkManaged(item.agentId, item.skillName);
  }

  for (const item of input.unmanaged ?? []) {
    await sandbox.writeSkill(`.${item.agentId}/skills/${item.skillName}`, item.skillName);
  }

  return {
    homeDir: sandbox.homeDir,
    skillmuxHome: sandbox.skillmuxHome,
    cleanup: sandbox.cleanup
  };
}
```

Implementation note: when creating agent directories, use `ensureDirectory(join(homeDir, \`.${agentId}\`, "skills"))` instead of creating a fake `.keep` skill so the fixture does not introduce noise in later scans.

- [ ] **Step 5: Run targeted tests and commit**

Run:

```powershell
npm test -- --run tests/tui-e2e/sandbox.test.ts tests/tui-e2e/scenarios/smoke.test.ts
```

Expected: PASS.

Run:

```powershell
npm run typecheck
```

Expected: PASS.

Commit:

```powershell
git add tests/tui-e2e/sandbox.ts tests/tui-e2e/fixtures.ts tests/tui-e2e/sandbox.test.ts
git commit -m "test: add tui sandbox fixtures"
```

### Task 5: Build The High-Level Explorer API And Real Lifecycle Scenarios

**Files:**
- Create: `tests/tui-e2e/explorer.ts`
- Create: `tests/tui-e2e/explorer.test.ts`
- Create: `tests/tui-e2e/scenarios/lifecycle-flow.test.ts`
- Create: `tests/tui-e2e/scenarios/usability-probes.test.ts`

- [ ] **Step 1: Write failing explorer tests**

Create `tests/tui-e2e/explorer.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { createScenarioFixture } from "./fixtures";
import { startExplorer } from "./explorer";

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
});

describe("startExplorer", () => {
  it("switches focus with arrow keys and keeps the selected agent visible", async () => {
    const fixture = await createScenarioFixture({
      agents: ["codex"],
      managedEnabled: [{ agentId: "codex", skillName: "using-superpowers" }],
      managedDisabled: [{ agentId: "codex", skillName: "terminal-ui" }]
    });
    cleanups.push(fixture.cleanup);

    const explorer = await startExplorer({
      homeDir: fixture.homeDir,
      skillmuxHome: fixture.skillmuxHome,
      scenarioName: "focus-switch"
    });

    await explorer.waitForText("Skills for codex");
    await explorer.press("right");
    await explorer.waitForText("● using-superpowers");

    expect(explorer.currentScreen()).toContain("codex");
  });
});
```

- [ ] **Step 2: Run the test to verify the red state**

Run:

```powershell
npm run build
```

Expected: PASS.

Run:

```powershell
npm test -- --run tests/tui-e2e/explorer.test.ts
```

Expected: FAIL because `tests/tui-e2e/explorer.ts` does not exist.

- [ ] **Step 3: Implement the high-level explorer wrapper**

Create `tests/tui-e2e/explorer.ts`:

```ts
import { createPtySession } from "./pty-session";

const keyMap = {
  left: "\u001B[D",
  right: "\u001B[C",
  up: "\u001B[A",
  down: "\u001B[B",
  escape: "\u001B",
  enter: "\r",
  space: " ",
  q: "q",
  a: "a",
  r: "r",
  s: "s",
  slash: "/",
  question: "?",
  ctrlC: "\u0003"
} as const;

export async function startExplorer(options: {
  homeDir: string;
  skillmuxHome: string;
  scenarioName: string;
  cols?: number;
  rows?: number;
}) {
  const session = await createPtySession({
    ...options,
    cols: options.cols ?? 100,
    rows: options.rows ?? 30
  });

  return {
    press(name: keyof typeof keyMap) {
      return session.press(keyMap[name]);
    },
    async type(text: string) {
      for (const char of text) {
        await session.press(char);
      }
    },
    waitForText: session.waitForText,
    currentScreen: session.snapshot,
    snapshot: session.saveSnapshot,
    resize: session.resize,
    waitForExit: session.waitForExit,
    exitCode: session.exitCode,
    eventLog: session.eventLog,
    assertPathExists: session.assertPathExists,
    assertPathMissing: session.assertPathMissing
  };
}
```

- [ ] **Step 4: Add the lifecycle and usability scenarios**

Create `tests/tui-e2e/scenarios/lifecycle-flow.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { join } from "node:path";
import { createScenarioFixture } from "../fixtures";
import { startExplorer } from "../explorer";

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
});

describe("tui pty lifecycle flow", () => {
  it("toggles, adopts, removes, and scans inside the temporary sandbox", async () => {
    const fixture = await createScenarioFixture({
      agents: ["codex"],
      managedEnabled: [{ agentId: "codex", skillName: "using-superpowers" }],
      managedDisabled: [{ agentId: "codex", skillName: "terminal-ui" }],
      unmanaged: [{ agentId: "codex", skillName: "find-skills" }]
    });
    cleanups.push(fixture.cleanup);

    const explorer = await startExplorer({
      homeDir: fixture.homeDir,
      skillmuxHome: fixture.skillmuxHome,
      scenarioName: "lifecycle-flow"
    });

    await explorer.waitForText("Skills for codex");
    await explorer.press("right");
    await explorer.waitForText("using-superpowers");
    await explorer.press("space");
    await explorer.waitForText("Disabled using-superpowers");

    await explorer.type("j");
    await explorer.waitForText("terminal-ui");
    await explorer.press("r");
    await explorer.waitForText("Remove terminal-ui from SkillMux?");
    await explorer.press("y");
    await explorer.waitForText("Removed terminal-ui");
    await explorer.assertPathMissing(
      join(fixture.skillmuxHome, "skills", "terminal-ui")
    );

    await explorer.type("j");
    await explorer.waitForText("find-skills");
    await explorer.press("a");
    await explorer.waitForText("Adopt find-skills for codex?");
    await explorer.press("y");
    await explorer.press("left");
    await explorer.waitForText("Adopted find-skills");
    await explorer.assertPathExists(
      join(fixture.skillmuxHome, "skills", "find-skills", "SKILL.md")
    );
    expect(explorer.currentScreen()).toContain("Skills for codex");

    await explorer.press("s");
    await explorer.waitForText("Skills for codex");
  });
});
```

Create `tests/tui-e2e/scenarios/usability-probes.test.ts`:

```ts
import { afterEach, describe, it } from "vitest";
import { createScenarioFixture } from "../fixtures";
import { startExplorer } from "../explorer";

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
});

describe("tui usability probes", () => {
  it("captures focus, help, search, resize, and Ctrl+C exit snapshots", async () => {
    const fixture = await createScenarioFixture({
      agents: ["codex"],
      managedEnabled: [{ agentId: "codex", skillName: "using-superpowers" }],
      managedDisabled: [{ agentId: "codex", skillName: "terminal-ui" }],
      unmanaged: [{ agentId: "codex", skillName: "find-skills" }]
    });
    cleanups.push(fixture.cleanup);

    const explorer = await startExplorer({
      homeDir: fixture.homeDir,
      skillmuxHome: fixture.skillmuxHome,
      scenarioName: "usability-probes"
    });

    await explorer.waitForText("Skills for codex");
    await explorer.snapshot("01-initial");
    await explorer.press("question");
    await explorer.waitForText("Navigation");
    await explorer.snapshot("02-help");
    await explorer.press("escape");
    await explorer.press("slash");
    await explorer.type("term");
    await explorer.snapshot("03-search");
    await explorer.press("escape");
    await explorer.resize(120, 40);
    await explorer.snapshot("04-resize-wide");
    await explorer.resize(80, 24);
    await explorer.snapshot("05-resize-min");
    await explorer.press("ctrlC");
    await explorer.waitForExit();
  });
});
```

- [ ] **Step 5: Run targeted scenarios and commit**

Run:

```powershell
npm run build
```

Expected: PASS.

Run:

```powershell
npm test -- --run tests/tui-e2e/explorer.test.ts tests/tui-e2e/scenarios/lifecycle-flow.test.ts tests/tui-e2e/scenarios/usability-probes.test.ts
```

Expected: PASS.

Run:

```powershell
npm run tui:explore
```

Expected: PASS. `.artifacts/tui-e2e/usability-probes/` contains `events.json` plus the named text snapshots.

Commit:

```powershell
git add tests/tui-e2e/explorer.ts tests/tui-e2e/explorer.test.ts tests/tui-e2e/scenarios/lifecycle-flow.test.ts tests/tui-e2e/scenarios/usability-probes.test.ts
git commit -m "test: add tui explorer scenarios"
```

### Task 6: Finalize Docs, Tracking, And Full Verification

**Files:**
- Modify: `AGENTS.md`
- Modify: `PROJECT_STATUS.md`
- Modify: `NEXT_ACTIONS.md`
- Modify: `DECISIONS.md`
- Modify: `docs/superpowers/plans/2026-04-21-skillmux-tui-pty-exploration-implementation-plan.md`

- [ ] **Step 1: Update tracking docs as each task lands**

Update:

- `PROJECT_STATUS.md` with the new plan path, accepted task slices, and verification status
- `NEXT_ACTIONS.md` by marking completed PTY exploration tasks and recording the next implementation slice
- `DECISIONS.md` with the runner choice: build `dist/cli.js` first, then drive the real CLI through PTY-backed Vitest scenarios
- `AGENTS.md` with the active PTY exploration execution notes

- [ ] **Step 2: Mark this plan as execution progresses**

For each accepted task, change only the completed checkboxes in this file from `[ ]` to `[x]`.

- [ ] **Step 3: Run the full PTY and repository verification gate**

Run:

```powershell
npm run build
```

Expected: PASS.

Run:

```powershell
npm run test:tui-e2e
```

Expected: PASS.

Run:

```powershell
npm test
```

Expected: PASS.

Run:

```powershell
npm run typecheck
```

Expected: PASS.

Run:

```powershell
git diff --check
```

Expected: no whitespace or conflict-marker errors.

- [ ] **Step 4: Commit the final PTY exploration docs state**

Commit:

```powershell
git add AGENTS.md PROJECT_STATUS.md NEXT_ACTIONS.md DECISIONS.md docs/superpowers/plans/2026-04-21-skillmux-tui-pty-exploration-implementation-plan.md
git commit -m "docs: record tui pty exploration plan progress"
```

## Final Verification Before Acceptance

Run from the root accepted state:

```powershell
npm run build
```

Expected: PASS.

```powershell
npm run test:tui-e2e
```

Expected: PASS.

```powershell
npm test
```

Expected: PASS.

```powershell
npm run typecheck
```

Expected: PASS.

```powershell
git diff --check
```

Expected: no whitespace or unresolved-merge-marker errors.

## Execution Handoff

Recommended execution mode: **Subagent-Driven**.

Use a fresh worker per task. After each task:

1. Run the targeted verification listed in the task.
2. Review spec compliance for that task.
3. Review code quality for that task.
4. Update this plan's checkboxes and the root tracking docs.
5. Commit the accepted slice before moving to the next task.

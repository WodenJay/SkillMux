import * as fs from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveSkillmuxHome } from "../../../src/config/resolve-skillmux-home";
import { createManagedLink } from "../../../src/fs/link-ops";
import {
  cleanupTempHomeDir,
  createTempHomeDir,
  ensureDirectory
} from "../../helpers/temp-env";
import { createPtySession } from "../pty-session";

const cleanups: Array<() => void | Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describe("tui pty smoke", () => {
  it("launches the dashboard and exits on q", async () => {
    const fixture = await createSmokeFixture();
    cleanups.push(fixture.cleanup);

    const session = await createPtySession({
      homeDir: fixture.homeDir,
      skillmuxHome: fixture.skillmuxHome,
      cols: 100,
      rows: 30,
      scenarioName: "smoke-launch-quit"
    });
    cleanups.push(() => session.close());

    await session.waitForText("Skills for codex");
    await session.saveSnapshot("initial-dashboard");
    await session.press("q");
    await session.waitForExit();
    await session.flushArtifacts();

    expect(session.snapshot()).toContain("Skills for codex");
    expect(session.exitCode()).toBe(0);
    expect(session.eventLog()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "spawn" }),
        expect.objectContaining({ type: "keypress", key: "q" }),
        expect.objectContaining({ type: "exit", code: 0 })
      ])
    );
  });
});

async function createSmokeFixture(): Promise<{
  homeDir: string;
  skillmuxHome: string;
  cleanup: () => void;
}> {
  const homeDir = createTempHomeDir();
  const { skillmuxHome } = resolveSkillmuxHome(homeDir);
  const managedSkillPath = join(skillmuxHome, "skills", "using-superpowers");
  const activationLinkPath = join(homeDir, ".codex", "skills", "using-superpowers");

  await fs.mkdir(managedSkillPath, { recursive: true });
  ensureDirectory(join(homeDir, ".codex", "skills"));
  await fs.writeFile(join(managedSkillPath, "SKILL.md"), "# using-superpowers\n", "utf8");
  await createManagedLink(activationLinkPath, managedSkillPath);
  await fs.writeFile(
    join(skillmuxHome, "manifest.json"),
    `${JSON.stringify(
      {
        version: 1,
        skillmuxHome,
        skills: {
          "using-superpowers": {
            id: "using-superpowers",
            name: "using-superpowers",
            path: managedSkillPath,
            source: {
              kind: "local",
              path: managedSkillPath
            },
            importedAt: "2026-04-21T00:00:00.000Z"
          }
        },
        agents: {
          codex: {
            id: "codex",
            name: "codex",
            path: join(homeDir, ".codex"),
            discovery: "builtin",
            available: true,
            lastSeenAt: "2026-04-21T00:00:00.000Z"
          }
        },
        activations: [
          {
            skillId: "using-superpowers",
            agentId: "codex",
            linkPath: activationLinkPath,
            state: "enabled",
            updatedAt: "2026-04-21T00:00:00.000Z"
          }
        ],
        lastScan: {
          at: null,
          issues: []
        }
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  return {
    homeDir,
    skillmuxHome,
    cleanup: () => {
      cleanupTempHomeDir(homeDir);
    }
  };
}

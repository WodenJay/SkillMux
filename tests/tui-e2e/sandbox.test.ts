import * as fs from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createScenarioFixture } from "./fixtures";

const cleanups: Array<() => void | Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describe("createScenarioFixture", () => {
  it("creates managed and unmanaged skills in separate locations", async () => {
    const fixture = await createScenarioFixture({
      agents: ["codex"],
      managedEnabled: [{ agentId: "codex", skillName: "using-superpowers" }],
      unmanaged: [{ agentId: "codex", skillName: "find-skills" }]
    });
    cleanups.push(fixture.cleanup);

    const managedSkillPath = join(
      fixture.skillmuxHome,
      "skills",
      "using-superpowers",
      "SKILL.md"
    );
    const agentLinkPath = join(fixture.homeDir, ".codex", "skills", "using-superpowers");
    const unmanagedSkillPath = join(
      fixture.homeDir,
      ".codex",
      "skills",
      "find-skills",
      "SKILL.md"
    );

    expect((await fs.lstat(managedSkillPath)).isFile()).toBe(true);
    expect((await fs.lstat(unmanagedSkillPath)).isFile()).toBe(true);

    const agentLinkStats = await fs.lstat(agentLinkPath);
    expect(agentLinkStats.isSymbolicLink()).toBe(true);
    await expect(fs.realpath(agentLinkPath)).resolves.toBe(join(fixture.skillmuxHome, "skills", "using-superpowers"));

    const manifest = JSON.parse(
      await fs.readFile(join(fixture.skillmuxHome, "manifest.json"), "utf8")
    ) as {
      activations: Array<{ agentId: string; skillId: string; state: string; linkPath: string }>;
      lastScan: { at: string | null };
    };

    expect(manifest.lastScan.at).toBeNull();
    expect(manifest.activations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agentId: "codex",
          skillId: "using-superpowers",
          state: "enabled",
          linkPath: agentLinkPath
        })
      ])
    );
  });

  it("rejects invalid agent references and conflicting activation declarations", async () => {
    await expect(
      createScenarioFixture({
        agents: ["codex"],
        managedEnabled: [{ agentId: "claude", skillName: "using-superpowers" }]
      })
    ).rejects.toThrow(/not declared in agents/i);

    await expect(
      createScenarioFixture({
        agents: ["codex"],
        managedEnabled: [{ agentId: "codex", skillName: "using-superpowers" }],
        managedDisabled: [{ agentId: "codex", skillName: "using-superpowers" }]
      })
    ).rejects.toThrow(/conflicting activation/i);
  });
});

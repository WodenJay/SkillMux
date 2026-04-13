import { join } from "node:path";
import { runDisable } from "../../src/commands/disable";
import { runImport } from "../../src/commands/import";
import { afterEach, describe, expect, it } from "vitest";
import { readManifest } from "../../src/manifest/read-manifest";
import { runList } from "../../src/commands/list";
import { runScan } from "../../src/commands/scan";
import { createAgentFixture, type AgentFixture } from "../helpers/create-agent-fixture";

const fixtures: AgentFixture[] = [];

afterEach(() => {
  fixtures.splice(0).forEach((fixture) => fixture.cleanup());
});

describe("scan and list commands", () => {
  it("classifies discovered skill entries and persists scan state into the manifest", async () => {
    const fixture = await createAgentFixture();
    fixtures.push(fixture);

    const now = new Date("2026-04-12T08:00:00.000Z");
    const result = await runScan({
      homeDir: fixture.homeDir,
      platform: "win32",
      now,
      json: true
    });

    expect(result.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agentId: "codex",
          skillName: "find-skills",
          kind: "managed-link",
          path: join(fixture.homeDir, ".codex", "skills", "find-skills"),
          targetPath: fixture.managedSkillPath
        }),
        expect.objectContaining({
          agentId: "claude",
          skillName: "find-skills",
          kind: "managed-link"
        }),
        expect.objectContaining({
          agentId: "claude",
          skillName: "local-draft",
          kind: "unmanaged-directory"
        }),
        expect.objectContaining({
          agentId: "claude",
          skillName: "shared-skill",
          kind: "unknown"
        }),
        expect.objectContaining({
          agentId: "claude",
          skillName: "broken-skill",
          kind: "broken-link"
        })
      ])
    );

    expect(result.manifest.agents.codex).toMatchObject({
      id: "codex",
      discovery: "builtin",
      available: true,
      path: join(fixture.homeDir, ".codex", "skills"),
      lastSeenAt: now.toISOString()
    });
    expect(result.manifest.agents.claude).toMatchObject({
      id: "claude",
      discovery: "builtin",
      available: true,
      path: join(fixture.homeDir, ".claude", "skills"),
      lastSeenAt: now.toISOString()
    });
    expect(result.manifest.lastScan).toMatchObject({
      at: now.toISOString()
    });
    expect(result.manifest.lastScan.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "broken-link",
          path: join(fixture.homeDir, ".claude", "skills", "broken-skill")
        }),
        expect.objectContaining({
          code: "unknown-entry",
          path: join(fixture.homeDir, ".claude", "skills", "shared-skill")
        })
      ])
    );

    await expect(readManifest(fixture.skillmuxHome)).resolves.toMatchObject({
      lastScan: {
        at: now.toISOString()
      }
    });
  });

  it("groups scanned records by skill in json list output", async () => {
    const fixture = await createAgentFixture();
    fixtures.push(fixture);

    const result = await runList({
      homeDir: fixture.homeDir,
      platform: "win32",
      view: "skills",
      format: "json"
    });
    const parsed = JSON.parse(result.output) as {
      view: string;
      skills: Array<{
        skillName: string;
        entries: Array<{ agentId: string; kind: string }>;
      }>;
    };

    expect(parsed.view).toBe("skills");
    expect(parsed.skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          skillName: "find-skills",
          entries: expect.arrayContaining([
            expect.objectContaining({
              agentId: "codex",
              kind: "managed-link"
            }),
            expect.objectContaining({
              agentId: "claude",
              kind: "managed-link"
            })
          ])
        }),
        expect.objectContaining({
          skillName: "local-draft",
          entries: expect.arrayContaining([
            expect.objectContaining({
              agentId: "claude",
              kind: "unmanaged-directory"
            })
          ])
        })
      ])
    );
  });

  it("keeps discovered agents and managed skills visible in list views even without live entries", async () => {
    const fixture = await createAgentFixture();
    fixtures.push(fixture);

    const sourcePath = join(fixture.homeDir, "skill-sources", "managed-only-skill");
    await runScan({
      homeDir: fixture.homeDir,
      platform: "win32",
      now: new Date("2026-04-12T09:00:00.000Z")
    });

    await import("node:fs/promises").then((fs) =>
      fs.mkdir(sourcePath, { recursive: true }).then(async () => {
        await fs.writeFile(join(sourcePath, "SKILL.md"), "# Managed Only Skill\n", "utf8");
      })
    );

    await runImport({
      homeDir: fixture.homeDir,
      sourcePath,
      skillName: "managed-only-skill",
      now: new Date("2026-04-12T09:01:00.000Z")
    });

    await runDisable({
      homeDir: fixture.homeDir,
      skill: "managed-only-skill",
      agent: "codex",
      now: new Date("2026-04-12T09:02:00.000Z")
    });

    const agentsView = JSON.parse(
      (
        await runList({
          homeDir: fixture.homeDir,
          platform: "win32",
          view: "agents",
          format: "json",
          now: new Date("2026-04-12T09:03:00.000Z")
        })
      ).output
    ) as {
      view: string;
      agents: Array<{
        agentId: string;
        entries: Array<{ skillName: string }>;
      }>;
    };

    const skillsView = JSON.parse(
      (
        await runList({
          homeDir: fixture.homeDir,
          platform: "win32",
          view: "skills",
          format: "json",
          now: new Date("2026-04-12T09:04:00.000Z")
        })
      ).output
    ) as {
      view: string;
      skills: Array<{
        skillName: string;
        entries: Array<{ agentId: string }>;
      }>;
    };

    expect(agentsView.view).toBe("agents");
    expect(agentsView.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agentId: "codex"
        })
      ])
    );

    expect(skillsView.view).toBe("skills");
    expect(skillsView.skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          skillName: "managed-only-skill",
          entries: []
        })
      ])
    );
  });
});

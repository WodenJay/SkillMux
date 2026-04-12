import { join } from "node:path";
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
});

import * as fs from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

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
  if (scenarioName.trim() === "") {
    throw new Error("scenarioName must name a scenario subdirectory");
  }

  const baseDir = join(process.cwd(), ".artifacts", "tui-e2e");
  const rootDir = resolve(baseDir, scenarioName);
  const events: Array<Record<string, unknown>> = [];

  assertWithin(baseDir, rootDir, "scenario");
  await fs.rm(rootDir, { recursive: true, force: true });
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
      const snapshotPath = resolve(rootDir, `${name}.txt`);
      assertWithin(rootDir, snapshotPath, "snapshot");
      await fs.writeFile(snapshotPath, content, "utf8");
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

function assertWithin(parentDir: string, candidate: string, label: string): void {
  const normalizedParent = resolve(parentDir);
  const normalizedCandidate = resolve(candidate);
  const pathFromParent = relative(normalizedParent, normalizedCandidate);

  if (pathFromParent === "" || (!pathFromParent.startsWith("..") && !isAbsolute(pathFromParent))) {
    return;
  }

  throw new Error(`Invalid ${label} path outside artifact root: ${candidate}`);
}

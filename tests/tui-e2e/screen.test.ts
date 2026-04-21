import * as fs from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createArtifactRecorder } from "./artifacts";
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

  it("resizes the terminal and keeps the updated frame available", async () => {
    const screen = createScreenBuffer({ cols: 10, rows: 3 });

    await screen.write("1234567890");
    screen.resize(6, 3);

    expect(screen.snapshot()).toContain("123456");
  });
});

describe("createArtifactRecorder", () => {
  it("keeps output inside the scenario directory and writes fresh artifacts", async () => {
    const scenarioName = `screen-contract-${Date.now()}`;
    const artifactsRoot = join(
      process.cwd(),
      ".artifacts",
      "tui-e2e",
      scenarioName
    );

    await fs.mkdir(artifactsRoot, { recursive: true });
    await fs.writeFile(join(artifactsRoot, "stale.txt"), "stale", "utf8");

    const recorder = await createArtifactRecorder({ scenarioName });

    expect(recorder.rootDir).toBe(artifactsRoot);
    await expect(
      fs.stat(join(artifactsRoot, "stale.txt"))
    ).rejects.toMatchObject({ code: "ENOENT" });

    recorder.recordEvent({ type: "spawn" });
    await recorder.writeSnapshot("initial", "frame one");
    await recorder.flush();

    await expect(fs.readFile(join(artifactsRoot, "events.json"), "utf8")).resolves.toContain(
      '"type": "spawn"'
    );
    await expect(fs.readFile(join(artifactsRoot, "initial.txt"), "utf8")).resolves.toBe(
      "frame one"
    );

    await expect(
      recorder.writeSnapshot("../escape", "nope")
    ).rejects.toThrow();
    await expect(
      createArtifactRecorder({ scenarioName: "../escape" })
    ).rejects.toThrow();
  });

  it("rejects an empty scenario name", async () => {
    await expect(createArtifactRecorder({ scenarioName: "" })).rejects.toThrow(
      "scenarioName"
    );
  });
});

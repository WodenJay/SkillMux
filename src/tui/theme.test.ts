import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveTheme } from "./theme";

describe("resolveTheme", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns nord theme when COLORTERM=truecolor", () => {
    vi.stubEnv("COLORTERM", "truecolor");
    vi.stubEnv("NO_COLOR", undefined);
    vi.stubEnv("TERM", "xterm-256color");

    const theme = resolveTheme();

    expect(theme.fg.default).toBe("#d8dee9");
    expect(theme.accent.primary).toBe("#81a1c1");
  });

  it("returns nord theme when COLORTERM=24bit", () => {
    vi.stubEnv("COLORTERM", "24bit");
    vi.stubEnv("NO_COLOR", undefined);
    vi.stubEnv("TERM", "xterm");

    const theme = resolveTheme();

    expect(theme.fg.default).toBe("#d8dee9");
  });

  it("returns nord theme for 256color terminals", () => {
    vi.stubEnv("COLORTERM", undefined);
    vi.stubEnv("NO_COLOR", undefined);
    vi.stubEnv("TERM", "xterm-256color");

    const theme = resolveTheme();

    expect(theme.fg.default).toBe("#d8dee9");
  });

  it("returns fallback theme for 16-color terminals", () => {
    vi.stubEnv("COLORTERM", undefined);
    vi.stubEnv("NO_COLOR", undefined);
    vi.stubEnv("TERM", "xterm");

    const theme = resolveTheme();

    expect(theme.fg.default).toBe("white");
    expect(theme.accent.primary).toBe("cyan");
  });

  it("returns fallback theme when NO_COLOR is set", () => {
    vi.stubEnv("COLORTERM", "truecolor");
    vi.stubEnv("NO_COLOR", "1");
    vi.stubEnv("TERM", "xterm-256color");

    const theme = resolveTheme();

    expect(theme.fg.default).toBe("white");
  });
});

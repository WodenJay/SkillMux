import { join, resolve } from "node:path";

export type SkillmuxHomeResolution = {
  skillmuxHome: string;
  configPath: string;
};

export function buildConfigPath(skillmuxHome: string): string {
  return join(resolve(skillmuxHome), "config.json");
}

export function resolveSkillmuxHome(homeDir: string): SkillmuxHomeResolution {
  const resolvedHomeDir = resolve(homeDir);
  const skillmuxHome = join(resolvedHomeDir, ".skillmux");

  return {
    skillmuxHome,
    configPath: buildConfigPath(skillmuxHome)
  };
}

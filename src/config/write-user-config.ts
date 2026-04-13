import * as fs from "node:fs/promises";
import { buildConfigPath, type SkillmuxHomeResolution } from "./resolve-skillmux-home";
import type { UserConfig } from "./load-user-config";

export async function writeUserConfig(
  skillmuxHome: string,
  config: UserConfig
): Promise<SkillmuxHomeResolution> {
  const configPath = buildConfigPath(skillmuxHome);
  await fs.mkdir(skillmuxHome, { recursive: true });
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  return {
    skillmuxHome,
    configPath
  };
}

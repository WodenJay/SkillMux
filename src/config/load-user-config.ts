import * as fs from "node:fs/promises";
import { z } from "zod";
import {
  supportedPlatforms,
  type SupportedPlatform
} from "./default-agent-rules";
import { buildConfigPath } from "./resolve-skillmux-home";

const supportedPlatformSchema = z.enum(supportedPlatforms);

const agentOverrideSchema = z
  .object({
    stableName: z.string().min(1).optional(),
    supportedPlatforms: z.array(supportedPlatformSchema).min(1).optional(),
    homeRelativeRootPath: z.string().min(1).optional(),
    skillsDirectoryPath: z.string().min(1).optional(),
    enabledByDefault: z.boolean().optional()
  })
  .strict();

const userConfigSchema = z
  .object({
    version: z.literal(1),
    agents: z.record(z.string().min(1), agentOverrideSchema)
  })
  .strict();

export type AgentOverride = {
  stableName?: string;
  supportedPlatforms?: SupportedPlatform[];
  homeRelativeRootPath?: string;
  skillsDirectoryPath?: string;
  enabledByDefault?: boolean;
};

export type UserConfig = {
  version: 1;
  agents: Record<string, AgentOverride>;
};

function createEmptyUserConfig(): UserConfig {
  return {
    version: 1,
    agents: {}
  };
}

export async function loadUserConfig(skillmuxHome: string): Promise<UserConfig> {
  const configPath = buildConfigPath(skillmuxHome);

  try {
    const contents = await fs.readFile(configPath, "utf8");
    const parsed = JSON.parse(contents) as unknown;
    return userConfigSchema.parse(parsed);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return createEmptyUserConfig();
    }

    throw error;
  }
}

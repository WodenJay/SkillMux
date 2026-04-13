import * as fs from "node:fs/promises";
import { z } from "zod";
import { UserConfigValidationError } from "../core/errors";
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

export const userConfigSchema = z
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

function stripUtf8Bom(contents: string): string {
  return contents.charCodeAt(0) === 0xfeff ? contents.slice(1) : contents;
}

function formatValidationIssues(error: { issues: Array<{ path: (string | number)[]; message: string }> }): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

export async function loadUserConfig(skillmuxHome: string): Promise<UserConfig> {
  const configPath = buildConfigPath(skillmuxHome);

  try {
    const contents = await fs.readFile(configPath, "utf8");
    const parsed = JSON.parse(stripUtf8Bom(contents)) as unknown;
    const validated = userConfigSchema.safeParse(parsed);

    if (!validated.success) {
      throw new UserConfigValidationError(
        `Invalid config at ${configPath}: ${formatValidationIssues(validated.error)}`
      );
    }

    return validated.data;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return createEmptyUserConfig();
    }

    if (error instanceof SyntaxError) {
      throw new UserConfigValidationError(
        `Invalid config at ${configPath}: malformed JSON`
      );
    }

    throw error;
  }
}

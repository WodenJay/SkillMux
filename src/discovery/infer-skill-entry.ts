import * as fs from "node:fs/promises";
import { basename, resolve } from "node:path";
import type { ScanIssue } from "../core/types";
import { isPathInside } from "../fs/path-utils";

export type SkillEntryKind =
  | "managed-link"
  | "unmanaged-link"
  | "unmanaged-directory"
  | "broken-link"
  | "unknown";

export type ScannedSkillEntry = {
  agentId: string;
  agentName: string;
  skillName: string;
  kind: SkillEntryKind;
  path: string;
  targetPath?: string;
};

export type InferSkillEntryOptions = {
  agentId: string;
  agentName: string;
  path: string;
  skillmuxHome: string;
};

export type InferSkillEntryResult = {
  entry: ScannedSkillEntry;
  issue?: ScanIssue;
};

function buildIssue(
  code: string,
  severity: ScanIssue["severity"],
  message: string,
  path: string
): ScanIssue {
  return { code, severity, message, path };
}

export async function inferSkillEntry(
  options: InferSkillEntryOptions
): Promise<InferSkillEntryResult> {
  const absolutePath = resolve(options.path);
  const skillName = basename(absolutePath);
  const stats = await fs.lstat(absolutePath);

  if (stats.isSymbolicLink()) {
    try {
      const targetPath = await fs.realpath(absolutePath);

      if (isPathInside(options.skillmuxHome, targetPath)) {
        return {
          entry: {
            agentId: options.agentId,
            agentName: options.agentName,
            skillName,
            kind: "managed-link",
            path: absolutePath,
            targetPath
          }
        };
      }

      return {
        entry: {
          agentId: options.agentId,
          agentName: options.agentName,
          skillName,
          kind: "unmanaged-link",
          path: absolutePath,
          targetPath
        }
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }

      return {
        entry: {
          agentId: options.agentId,
          agentName: options.agentName,
          skillName,
          kind: "broken-link",
          path: absolutePath
        },
        issue: buildIssue(
          "broken-link",
          "error",
          "Skill entry points to a missing target",
          absolutePath
        )
      };
    }
  }

  if (stats.isDirectory()) {
    return {
      entry: {
        agentId: options.agentId,
        agentName: options.agentName,
        skillName,
        kind: "unmanaged-directory",
        path: absolutePath
      }
    };
  }

  return {
    entry: {
      agentId: options.agentId,
      agentName: options.agentName,
      skillName,
      kind: "unknown",
      path: absolutePath
    },
    issue: buildIssue(
      "unknown-entry",
      "warning",
      "Skill entry is neither a managed link nor a directory",
      absolutePath
    )
  };
}

import { z } from "zod";
import type {
  ActivationRecord,
  AgentRecord,
  ManagedSkill,
  Manifest,
  ScanIssue
} from "../core/types";

export const scanIssueSchema = z
  .object({
    code: z.string().min(1),
    severity: z.enum(["info", "warning", "error"]),
    message: z.string().min(1),
    path: z.string().min(1).optional()
  })
  .strict();

export const managedSkillSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    path: z.string().min(1),
    source: z
      .object({
        kind: z.enum(["local", "imported"]),
        path: z.string().min(1)
      })
      .strict(),
    importedAt: z.string().min(1)
  })
  .strict();

export const agentRecordSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    path: z.string().min(1),
    discovery: z.enum(["builtin", "custom"]),
    available: z.boolean(),
    lastSeenAt: z.string().min(1).nullable()
  })
  .strict();

export const activationRecordSchema = z
  .object({
    skillId: z.string().min(1),
    agentId: z.string().min(1),
    linkPath: z.string().min(1),
    state: z.enum(["enabled", "disabled"]),
    updatedAt: z.string().min(1)
  })
  .strict();

export const manifestSchema = z
  .object({
    version: z.literal(1),
    skillmuxHome: z.string().min(1),
    skills: z.record(z.string(), managedSkillSchema),
    agents: z.record(z.string(), agentRecordSchema),
    activations: z.array(activationRecordSchema),
    lastScan: z
      .object({
        at: z.string().min(1).nullable(),
        issues: z.array(scanIssueSchema)
      })
      .strict()
  })
  .strict();

export type { ActivationRecord, AgentRecord, ManagedSkill, Manifest, ScanIssue };

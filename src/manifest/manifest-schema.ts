import { z } from "zod";
import { isValidId } from "../core/ids";
import type {
  ActivationRecord,
  AgentRecord,
  ManagedSkill,
  Manifest,
  ScanIssue
} from "../core/types";

const idSchema = z
  .string()
  .min(1)
  .refine(isValidId, "Expected a canonical lowercase slug identifier");

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
    id: idSchema,
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
    id: idSchema,
    name: z.string().min(1),
    path: z.string().min(1),
    discovery: z.enum(["builtin", "custom"]),
    available: z.boolean(),
    lastSeenAt: z.string().min(1).nullable()
  })
  .strict();

export const activationRecordSchema = z
  .object({
    skillId: idSchema,
    agentId: idSchema,
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
  .strict()
  .superRefine((manifest, ctx) => {
    for (const [skillId, skill] of Object.entries(manifest.skills)) {
      if (!isValidId(skillId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["skills", skillId],
          message: `Invalid skill id key: ${skillId}`
        });
      }

      if (skill.id !== skillId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["skills", skillId, "id"],
          message: `Skill id must match its record key: ${skillId}`
        });
      }
    }

    for (const [agentId, agent] of Object.entries(manifest.agents)) {
      if (!isValidId(agentId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["agents", agentId],
          message: `Invalid agent id key: ${agentId}`
        });
      }

      if (agent.id !== agentId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["agents", agentId, "id"],
          message: `Agent id must match its record key: ${agentId}`
        });
      }
    }

    const activationPairs = new Set<string>();

    manifest.activations.forEach((activation, index) => {
      if (!(activation.skillId in manifest.skills)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["activations", index, "skillId"],
          message: `Unknown skill reference: ${activation.skillId}`
        });
      }

      if (!(activation.agentId in manifest.agents)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["activations", index, "agentId"],
          message: `Unknown agent reference: ${activation.agentId}`
        });
      }

      const pairKey = `${activation.skillId}:${activation.agentId}`;
      if (activationPairs.has(pairKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["activations", index],
          message: `Duplicate activation for ${pairKey}`
        });
        return;
      }

      activationPairs.add(pairKey);
    });
  });

export type { ActivationRecord, AgentRecord, ManagedSkill, Manifest, ScanIssue };

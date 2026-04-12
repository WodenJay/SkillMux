import type { Manifest } from "../core/types";

export function buildEmptyManifest(skillmuxHome: string): Manifest {
  return {
    version: 1,
    skillmuxHome,
    skills: {},
    agents: {},
    activations: [],
    lastScan: {
      at: null,
      issues: []
    }
  };
}

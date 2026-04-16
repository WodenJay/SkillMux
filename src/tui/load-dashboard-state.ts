import { homedir } from "node:os";
import { resolveSkillmuxHome } from "../config/resolve-skillmux-home";
import {
  collectDoctorIssues,
  dedupeAndSortIssues
} from "../diagnostics/collect-doctor-issues";
import { discoverAgents } from "../discovery/discover-agents";
import {
  scanAgentSkills,
  type ScanAgentSkillsResult
} from "../discovery/scan-agent-skills";
import { readManifestSnapshot } from "../manifest/read-manifest-snapshot";
import {
  buildDashboardModel,
  type DashboardModel
} from "./dashboard-model";

export type LoadDashboardStateOptions = {
  homeDir?: string;
  skillmuxHome?: string;
  platform?: NodeJS.Platform;
  selectedAgentId?: string;
  selectedSkillId?: string;
};

export async function loadDashboardState(
  options: LoadDashboardStateOptions = {}
): Promise<DashboardModel> {
  const homeDir = options.homeDir ?? homedir();
  const resolvedSkillmuxHome = resolveSkillmuxHome(homeDir).skillmuxHome;
  const skillmuxHome = options.skillmuxHome ?? resolvedSkillmuxHome;
  const { manifest } = await readManifestSnapshot(skillmuxHome);
  const agents = await discoverAgents({
    homeDir,
    platform: options.platform,
    skillmuxHome
  });
  const scanResults: ScanAgentSkillsResult[] = [];

  for (const agent of agents) {
    scanResults.push(await scanAgentSkills(agent, skillmuxHome));
  }

  const entries = scanResults.flatMap((result) => result.entries);
  const scanIssues = scanResults.flatMap((result) => result.issues);
  const doctorIssues = await collectDoctorIssues({ manifest, agents, entries });
  const issues = dedupeAndSortIssues([...scanIssues, ...doctorIssues]);

  return buildDashboardModel({
    manifest,
    agents,
    entries,
    issues,
    selectedAgentId: options.selectedAgentId,
    selectedSkillId: options.selectedSkillId
  });
}

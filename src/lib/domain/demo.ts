import type { ContributionEvidence, DashboardSnapshot, Repository, RepositoryCoverage } from "@/lib/contracts";
import { deriveProgression } from "./progression";

const DEMO_REPOSITORIES = ["chaoss/8Knot", "chaoss/CollectOSS"] as const;

function coverage(username: string, repositoryId: string): RepositoryCoverage {
  return {
    username,
    repositoryId,
    requestedScope: "all_accessible_history",
    supportedKinds: ["pull_request", "review", "issue"],
    backfillStatus: "not_started",
    oldestEvidenceAt: null,
    newestEvidenceAt: null,
    lastAttemptAt: null,
    lastSuccessfulSyncAt: null,
    coveredThrough: null,
    canResume: false,
    limitations: ["Running without a GitHub token. Connect a token for live imports."],
  };
}

export function buildDemoDashboard(): DashboardSnapshot {
  const username = "engcaiofonseca";
  const repositories: Repository[] = DEMO_REPOSITORIES.map((slug) => {
    const [owner, name] = slug.split("/");
    return {
      id: slug,
      owner,
      name,
      url: `https://github.com/${slug}`,
      description: "Demo repository target",
      xp: 0,
      evidenceCount: 0,
      coverage: coverage(username, slug),
    };
  });
  const evidence: ContributionEvidence[] = [];
  const snapshot = deriveProgression(
    {
      username,
      displayName: "engcaiofonseca",
      avatarUrl: null,
    },
    repositories,
    evidence,
    { kind: "global" },
    [...DEMO_REPOSITORIES],
    "demo",
    false,
    ["Demo mode: no fabricated contributions are shown. Run live sync to import real GitHub history."],
    null,
  );
  const repoById = new Map(repositories.map((repo) => [repo.id, repo]));
  for (const item of snapshot.evidence) {
    const repo = repoById.get(item.repositoryId);
    if (!repo) continue;
    repo.xp += item.xp;
    repo.evidenceCount += 1;
  }
  return snapshot;
}

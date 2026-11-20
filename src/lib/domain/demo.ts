import { DEFAULT_REPOSITORIES, type ContributionEvidence, type DashboardScope, type DashboardSnapshot, type Repository, type RepositoryCoverage } from "@/lib/contracts";
import { deriveProgression } from "./progression";

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

export function buildDemoDashboard(scope: DashboardScope = { kind: "global" }): DashboardSnapshot {
  const username = "demo-adventurer";
  const repositories: Repository[] = DEFAULT_REPOSITORIES.map((slug) => {
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
  const scopedRepositories = scope.kind === "global"
    ? repositories
    : repositories.filter((repository) => repository.id.toLowerCase() === scope.repositoryId.toLowerCase());
  const scopedEvidence = scope.kind === "global"
    ? evidence
    : evidence.filter((item) => item.repositoryId.toLowerCase() === scope.repositoryId.toLowerCase());
  const snapshot = deriveProgression(
    {
      username,
      displayName: "Demo Adventurer",
      avatarUrl: null,
    },
    scopedRepositories,
    scopedEvidence,
    scope,
    [...DEFAULT_REPOSITORIES],
    "demo",
    false,
    ["Demo mode: no fabricated contributions are shown. Run live sync to import real GitHub history."],
    null,
  );
  const repoById = new Map(snapshot.repositories.map((repo) => [repo.id, repo]));
  for (const item of snapshot.evidence) {
    const repo = repoById.get(item.repositoryId);
    if (!repo) continue;
    repo.xp += item.xp;
    repo.evidenceCount += 1;
  }
  return snapshot;
}

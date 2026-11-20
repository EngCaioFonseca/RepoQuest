import "server-only";
import { DEFAULT_REPOSITORIES, type DashboardScope, type DashboardSnapshot, type Repository, type RepositoryCoverage } from "@/lib/contracts";
import { defaultClassPreference } from "@/lib/domain/classes";
import { buildDemoDashboard } from "@/lib/domain/demo";
import { deriveProgression } from "@/lib/domain/progression";
import { restoreFromCloudOnce, storageStatus } from "./cloud-save";
import { emptyCoverage, readClassPreference, readCoverageForUser, readEvidence, readProfile, readRepositories, readSyncState } from "./repository";
import { resolveTrackedScope } from "./scope";

function mapWarnings(coverages: RepositoryCoverage[]): string[] {
  const warnings: string[] = [];
  for (const coverage of coverages) {
    if (coverage.backfillStatus === "partial") {
      warnings.push(`${coverage.repositoryId}: historical import is partial and provisional.`);
    } else if (coverage.backfillStatus === "failed") {
      warnings.push(`${coverage.repositoryId}: historical import failed; existing progress is preserved.`);
    } else if (coverage.backfillStatus === "in_progress") {
      warnings.push(`${coverage.repositoryId}: historical import is in progress.`);
    }
  }
  return warnings;
}

function scopeWarnings(scope: DashboardScope, warnings: string[]): string[] {
  if (scope.kind === "global") return warnings;
  const target = scope.repositoryId.toLowerCase();
  return warnings.filter((warning) => {
    const matches = warning.match(/[a-z0-9][a-z0-9._-]{0,37}\/[a-z0-9][a-z0-9._-]{0,99}/gi) ?? [];
    if (matches.length === 0) return true;
    return matches.some((repositoryId) => repositoryId.toLowerCase() === target);
  });
}

export async function buildDashboardSnapshot(forUsername?: string | null, requestedScope: DashboardScope = { kind: "global" }): Promise<DashboardSnapshot> {
  await restoreFromCloudOnce();
  const sync = readSyncState();
  const username = (forUsername ?? sync.username)?.toLowerCase() ?? null;
  const liveSyncAvailable = Boolean(process.env.GITHUB_TOKEN?.trim());

  if (!username) {
    const trackedRepositories = [...DEFAULT_REPOSITORIES];
    const scope = resolveTrackedScope(requestedScope, trackedRepositories);
    const demo = buildDemoDashboard(scope);
    demo.trackedRepositories = trackedRepositories;
    demo.liveSyncAvailable = liveSyncAvailable;
    demo.classPreference = defaultClassPreference(false);
    demo.profile.displayTitle = demo.profile.title;
    if (!liveSyncAvailable) {
      demo.warnings = ["Demo mode: live sync unavailable until GITHUB_TOKEN is configured."];
    } else {
      demo.warnings = ["No live profile has been synced yet. Run Sync to import history."];
    }
    demo.storage = storageStatus();
    return demo;
  }

  const trackedRepositories = sync.selectedRepositories.length > 0 ? sync.selectedRepositories : [...DEFAULT_REPOSITORIES];
  const scope = resolveTrackedScope(requestedScope, trackedRepositories);
  const profile = readProfile(username) ?? {
    username,
    displayName: username,
    avatarUrl: null,
  };
  const classPreference = readClassPreference(username);
  const selectedRepoSet = new Set(trackedRepositories.map((value) => value.toLowerCase()));
  const filterBySelection = selectedRepoSet.size > 0;
  const selectedEvidence = readEvidence(username).filter((item) => !filterBySelection || selectedRepoSet.has(item.repositoryId.toLowerCase()));
  const selectedCoverageRows = readCoverageForUser(username).filter((item) => !filterBySelection || selectedRepoSet.has(item.repositoryId.toLowerCase()));
  const evidence = scope.kind === "global" ? selectedEvidence : selectedEvidence.filter((item) => item.repositoryId.toLowerCase() === scope.repositoryId.toLowerCase());
  const coverageRows = scope.kind === "global"
    ? selectedCoverageRows
    : selectedCoverageRows.filter((item) => item.repositoryId.toLowerCase() === scope.repositoryId.toLowerCase());
  const coverageMap = new Map(coverageRows.map((coverage) => [coverage.repositoryId, coverage]));
  const repoIds = new Set<string>([
    ...coverageRows.map((item) => item.repositoryId),
    ...evidence.map((item) => item.repositoryId),
    ...(scope.kind === "global" ? trackedRepositories : [scope.repositoryId]),
  ]);
  const reposMeta = readRepositories([...repoIds]);
  const repositories: Repository[] = [...repoIds].sort().map((repositoryId) => {
    const [ownerFallback, nameFallback] = repositoryId.split("/");
    const meta = reposMeta.get(repositoryId);
    return {
      id: repositoryId,
      owner: meta?.owner ?? ownerFallback,
      name: meta?.name ?? nameFallback,
      url: meta?.url ?? `https://github.com/${repositoryId}`,
      description: meta?.description ?? "",
      xp: 0,
      evidenceCount: 0,
      coverage: coverageMap.get(repositoryId) ?? emptyCoverage(username, repositoryId),
    };
  });

  const snapshot = deriveProgression(
    profile,
    repositories,
    evidence,
    scope,
    trackedRepositories,
    "live",
    liveSyncAvailable,
    scopeWarnings(scope, [...sync.warnings, ...mapWarnings(coverageRows)]),
    sync.lastSyncedAt,
    classPreference,
    true,
  );

  const byRepo = new Map(snapshot.repositories.map((repo) => [repo.id, repo]));
  for (const item of snapshot.evidence) {
    const repo = byRepo.get(item.repositoryId);
    if (!repo) continue;
    repo.xp += item.xp;
    repo.evidenceCount += 1;
  }
  snapshot.storage = storageStatus();
  return snapshot;
}

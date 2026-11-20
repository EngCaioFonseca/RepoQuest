import "server-only";
import type { ContributionEvidence, RepositoryCoverage, SyncRequest, SyncResponse } from "@/lib/contracts";
import { cloudSaveEnabled, cloudSaveProblem, restoreFromCloudOnce, saveToCloud } from "./cloud-save";
import { buildDashboardSnapshot } from "./dashboard";
import {
  GitHubSyncError,
  classifyPullTrack,
  getRepository,
  getUser,
  isDocumentationIssue,
  listIssuePageByCreator,
  listIssuePageByCreatorIncremental,
  listPullPage,
  listPullPageIncremental,
  listPullReviewPage,
} from "./github";
import {
  persistEvidenceAndCoverage,
  readCoverage,
  readSyncState,
  resolveCanonicalRepositoryId,
  saveProfile,
  updateCoverage,
  upsertRepository,
  upsertSyncState,
} from "./repository";

type CoverageCheckpoint = {
  version: 3;
  mode: "backfill" | "incremental";
  pullOrder: "created_asc_state_all_v1" | "updated_desc_state_all_v1";
  issueOrder: "created_asc_state_all_v2" | "updated_desc_state_all_v1";
  watermark: string | null;
  phase: "pulls" | "issues";
  pullPage: number;
  pullIndex: number;
  reviewPage: number;
  issuePage: number;
};

type RepoSyncResult = {
  imported: number;
  unchanged: number;
  coverage: RepositoryCoverage;
  checkpoint: CoverageCheckpoint | null;
  warnings: string[];
};

const BASE_LIMITATIONS = [
  "Supported evidence currently includes merged pull requests by the selected contributor, submitted pull-request reviews with APPROVED/CHANGES_REQUESTED states on open or closed pull requests, and closed documentation-focused issues by the selected contributor.",
  "Inline review comments and raw commit history are intentionally excluded to avoid rewarding volume-only signals.",
];

const MAX_REQUESTS_PER_SYNC = Number.parseInt(process.env.REPOQUEST_MAX_REQUESTS_PER_SYNC ?? "220", 10);
const CHECKPOINT_VERSION = 3 as const;
const PULL_ORDER = "created_asc_state_all_v1" as const;
const ISSUE_ORDER = "created_asc_state_all_v2" as const;
const INCREMENTAL_ORDER = "updated_desc_state_all_v1" as const;

export class SyncInProgressError extends Error {
  constructor() {
    super("Another sync is already running.");
  }
}

let activeSync = false;

function canonicalRepoId(fullName: string): string {
  const [owner, name] = fullName.split("/");
  return `${owner}/${name}`;
}

function baseCoverage(username: string, repositoryId: string): RepositoryCoverage {
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
    limitations: [...BASE_LIMITATIONS],
  };
}

function evidenceId(kind: "pr" | "review" | "issue", repositoryId: string, numericId: number): string {
  return `gh:${kind}:${repositoryId.toLowerCase()}:${numericId}`;
}

function updateObservedRange(coverage: RepositoryCoverage, occurredAt: string): void {
  if (!coverage.oldestEvidenceAt || Date.parse(occurredAt) < Date.parse(coverage.oldestEvidenceAt)) coverage.oldestEvidenceAt = occurredAt;
  if (!coverage.newestEvidenceAt || Date.parse(occurredAt) > Date.parse(coverage.newestEvidenceAt)) coverage.newestEvidenceAt = occurredAt;
}

function isSameActor(login: string | undefined | null, username: string): boolean {
  return (login ?? "").toLowerCase() === username.toLowerCase();
}

function initialCheckpoint(mode: CoverageCheckpoint["mode"], watermark: string | null): CoverageCheckpoint {
  return {
    version: CHECKPOINT_VERSION,
    mode,
    pullOrder: mode === "incremental" ? INCREMENTAL_ORDER : PULL_ORDER,
    issueOrder: mode === "incremental" ? INCREMENTAL_ORDER : ISSUE_ORDER,
    watermark,
    phase: "pulls",
    pullPage: 1,
    pullIndex: 0,
    reviewPage: 1,
    issuePage: 1,
  };
}

function parseCheckpoint(value: unknown): { checkpoint: CoverageCheckpoint | null; legacy: boolean } {
  if (!value || typeof value !== "object") return { checkpoint: null, legacy: false };
  const row = value as Record<string, unknown>;
  if (row.version !== CHECKPOINT_VERSION) {
    return { checkpoint: null, legacy: true };
  }
  const mode = row.mode === "incremental" ? "incremental" : row.mode === "backfill" ? "backfill" : null;
  const pullOrder = row.pullOrder === PULL_ORDER || row.pullOrder === INCREMENTAL_ORDER ? row.pullOrder : null;
  const issueOrder = row.issueOrder === ISSUE_ORDER || row.issueOrder === INCREMENTAL_ORDER ? row.issueOrder : null;
  if (!mode || !pullOrder || !issueOrder) return { checkpoint: null, legacy: true };
  const phase = row.phase === "issues" ? "issues" : "pulls";
  const pullPage = typeof row.pullPage === "number" && row.pullPage > 0 ? Math.floor(row.pullPage) : 1;
  const pullIndex = typeof row.pullIndex === "number" && row.pullIndex >= 0 ? Math.floor(row.pullIndex) : 0;
  const reviewPage = typeof row.reviewPage === "number" && row.reviewPage > 0 ? Math.floor(row.reviewPage) : 1;
  const issuePage = typeof row.issuePage === "number" && row.issuePage > 0 ? Math.floor(row.issuePage) : 1;
  const watermark = typeof row.watermark === "string" ? row.watermark : null;
  return {
    checkpoint: {
      version: CHECKPOINT_VERSION,
      mode,
      pullOrder,
      issueOrder,
      watermark,
      phase,
      pullPage,
      pullIndex,
      reviewPage,
      issuePage,
    },
    legacy: false,
  };
}

async function syncRepository(username: string, repositoryIdInput: string): Promise<RepoSyncResult> {
  const [ownerInput, nameInput] = repositoryIdInput.split("/");
  const repoInfo = await getRepository(ownerInput, nameInput);
  const owner = repoInfo.owner.login;
  const name = repoInfo.name;
  const repositoryId = canonicalRepoId(repoInfo.full_name);
  if ((repoInfo as { private?: boolean }).private) {
    const now = new Date().toISOString();
    const coverage = readCoverage(username, repositoryId)?.coverage ?? baseCoverage(username, repositoryId);
    coverage.lastAttemptAt = now;
    coverage.backfillStatus = "failed";
    coverage.failureReason = "permission_denied";
    coverage.canResume = false;
    coverage.retryAt = undefined;
    coverage.limitations = [...new Set([...coverage.limitations, "Private repositories are not imported into shareable progression data."])];
    updateCoverage(coverage, null);
    return {
      imported: 0,
      unchanged: 0,
      coverage,
      checkpoint: null,
      warnings: [`${repositoryId}: private repositories are not supported for sync.`],
    };
  }
  upsertRepository({
    id: repositoryId,
    owner: repoInfo.owner.login,
    name: repoInfo.name,
    url: repoInfo.html_url,
    description: repoInfo.description ?? "",
  });

  const now = new Date().toISOString();
  const warnings: string[] = [];
  const existing = readCoverage(username, repositoryId);
  const coverage = existing?.coverage ?? baseCoverage(username, repositoryId);
  const parsedCheckpoint = parseCheckpoint(existing?.checkpoint ?? null);
  const checkpoint = parsedCheckpoint.checkpoint;
  const incrementalMode = checkpoint?.mode === "incremental"
    || (!parsedCheckpoint.legacy
      && checkpoint === null
      && existing?.coverage.backfillStatus === "complete"
      && Boolean(existing?.coverage.coveredThrough));
  if (parsedCheckpoint.legacy) {
    coverage.backfillStatus = "in_progress";
    coverage.canResume = false;
    coverage.coveredThrough = null;
    coverage.lastSuccessfulSyncAt = null;
    coverage.failureReason = undefined;
    coverage.retryAt = undefined;
  }
  coverage.lastAttemptAt = now;
  coverage.backfillStatus = "in_progress";
  coverage.canResume = false;
  coverage.failureReason = undefined;
  coverage.retryAt = undefined;
  if (!coverage.limitations.length) coverage.limitations = [...BASE_LIMITATIONS];
  if (parsedCheckpoint.legacy) {
    warnings.push(`${repositoryId}: existing legacy checkpoint format is incompatible with current traversal order; restarting repository backfill from the beginning.`);
  }
  updateCoverage(coverage, checkpoint);

  const incrementalWatermark = checkpoint?.mode === "incremental"
    ? checkpoint.watermark
    : incrementalMode
      ? existing?.coverage.coveredThrough ?? now
      : null;
  const start = checkpoint ?? initialCheckpoint(incrementalMode ? "incremental" : "backfill", incrementalWatermark);
  let pullPage = start.pullPage;
  let pullIndex = start.pullIndex;
  let reviewPage = start.reviewPage;
  let issuePage = start.issuePage;
  let phase = start.phase;
  const incrementalSince = incrementalMode ? Date.parse(start.watermark ?? now) : null;
  const resumePullPage = pullPage;
  const resumePullIndex = pullIndex;
  const resumeReviewPage = reviewPage;
  let requests = 0;
  const requestLimit = Number.isFinite(MAX_REQUESTS_PER_SYNC) && MAX_REQUESTS_PER_SYNC > 10 ? MAX_REQUESTS_PER_SYNC : 220;

  const emitted: ContributionEvidence[] = [];
  const canContinue = (): boolean => requests < requestLimit;
  const shouldStop = (): boolean => !canContinue();
  const resumeCheckpoint = (): CoverageCheckpoint => ({
    ...initialCheckpoint(incrementalMode ? "incremental" : "backfill", incrementalMode ? (start.watermark ?? null) : null),
    phase,
    pullPage,
    pullIndex,
    reviewPage,
    issuePage,
  });
  // A function call keeps TypeScript from narrowing the status away after pauseForRequestLimit mutates it.
  const isPaused = (): boolean => coverage.backfillStatus === "partial";
  const pauseForRequestLimit = (): void => {
    coverage.backfillStatus = "partial";
    coverage.failureReason = "api_limit";
    coverage.canResume = true;
    warnings.push(`Backfill for ${repositoryId} paused after ${requestLimit} GitHub requests; rerun sync to continue.`);
  };

  try {
    while (phase === "pulls") {
      if (!canContinue()) {
        pauseForRequestLimit();
        break;
      }
      const pullPageResult = incrementalMode
        ? await listPullPageIncremental(owner, name, pullPage)
        : await listPullPage(owner, name, pullPage);
      requests += 1;
      const pulls = pullPageResult.data;
      if (pulls.length === 0) {
        phase = "issues";
        break;
      }
      if (incrementalSince !== null && pulls.every((pull) => Date.parse(pull.updated_at) <= incrementalSince)) {
        phase = "issues";
        break;
      }
      for (let index = pullIndex; index < pulls.length; index += 1) {
        pullIndex = index;
        const pull = pulls[index];
        if (isSameActor(pull.user?.login, username) && pull.merged_at) {
          const track = classifyPullTrack(pull.title);
          emitted.push({
            id: evidenceId("pr", repositoryId, pull.number),
            actor: { login: pull.user?.login ?? username, id: pull.user?.id ?? 0 },
            repositoryId,
            kind: "pull_request",
            track,
            title: pull.title,
            url: pull.html_url,
            occurredAt: pull.merged_at,
            state: "merged",
            xp: 0,
            reason: track === "documentation"
              ? "Merged pull request classified as documentation-focused by title keywords."
              : "Merged pull request authored by the selected contributor.",
          });
          updateObservedRange(coverage, pull.merged_at);
        }

        let localReviewPage = pullPage === resumePullPage && index === resumePullIndex ? resumeReviewPage : 1;
        while (pull.number > 0) {
          reviewPage = localReviewPage;
          if (shouldStop()) {
            pauseForRequestLimit();
            break;
          }
          if (incrementalSince !== null && Date.parse(pull.updated_at) <= incrementalSince) break;
          const reviewResult = await listPullReviewPage(owner, name, pull.number, localReviewPage);
          requests += 1;
          const reviews = reviewResult.data;
          for (const review of reviews) {
            if (!isSameActor(review.user?.login, username)) continue;
            if (review.state !== "APPROVED" && review.state !== "CHANGES_REQUESTED") continue;
            if (!review.submitted_at) continue;
            emitted.push({
              id: evidenceId("review", repositoryId, review.id),
              actor: { login: review.user?.login ?? username, id: review.user?.id ?? 0 },
              repositoryId,
              kind: "review",
              track: "review",
              title: `Review on PR #${pull.number}`,
              url: review.html_url || `${repoInfo.html_url}/pull/${pull.number}`,
              occurredAt: review.submitted_at,
              state: "submitted",
              xp: 0,
              reason: "Pull-request review with APPROVED/CHANGES_REQUESTED state by the selected contributor.",
            });
            updateObservedRange(coverage, review.submitted_at);
          }
          if (reviews.length < 100 && reviewResult.nextPage === null) break;
          localReviewPage = reviewResult.nextPage ?? localReviewPage + 1;
        }
        if (isPaused()) break;
        reviewPage = 1;
      }
      if (isPaused()) break;
      pullIndex = 0;
      if (pullPageResult.nextPage === null) {
        phase = "issues";
        break;
      }
      pullPage = pullPageResult.nextPage;
    }

    if (!isPaused() && phase === "issues") {
      while (true) {
        phase = "issues";
        if (shouldStop()) {
          pauseForRequestLimit();
          break;
        }
        const issuePageResult = incrementalMode
          ? await listIssuePageByCreatorIncremental(owner, name, username, issuePage)
          : await listIssuePageByCreator(owner, name, username, issuePage);
        requests += 1;
        const issues = issuePageResult.data;
        if (issues.length === 0) break;
        if (incrementalSince !== null && issues.every((issue) => Date.parse(issue.updated_at) <= incrementalSince)) break;
        for (const issue of issues) {
          if (issue.pull_request) continue;
          if (!isSameActor(issue.user?.login, username)) continue;
          if (issue.state !== "closed" || !issue.closed_at) continue;
          if (!isDocumentationIssue(issue.title, issue.body, issue.labels)) continue;
          emitted.push({
            id: evidenceId("issue", repositoryId, issue.number),
            actor: { login: issue.user?.login ?? username, id: issue.user?.id ?? 0 },
            repositoryId,
            kind: "issue",
            track: "documentation",
            title: issue.title,
            url: issue.html_url,
            occurredAt: issue.closed_at,
            state: "closed",
            xp: 0,
            reason: "Closed documentation-focused issue attributed to the selected contributor.",
          });
          updateObservedRange(coverage, issue.closed_at);
        }
        if (issuePageResult.nextPage === null) break;
        issuePage = issuePageResult.nextPage;
      }
    }
  } catch (error) {
    if (error instanceof GitHubSyncError) {
      coverage.backfillStatus = "failed";
      coverage.failureReason = error.failureReason;
      coverage.retryAt = error.retryAt;
      coverage.canResume = true;
      warnings.push(`${repositoryId}: ${error.message}`);
      const failureCheckpoint = resumeCheckpoint();
      const counts = persistEvidenceAndCoverage(username, emitted, coverage, failureCheckpoint);
      return { imported: counts.imported, unchanged: counts.unchanged, coverage, checkpoint: failureCheckpoint, warnings };
    }
    throw error;
  }

  let finalCheckpoint: CoverageCheckpoint | null = null;
  const hasCheckpoint = isPaused();
  if (hasCheckpoint) {
    coverage.failureReason ??= "interrupted";
    coverage.canResume = true;
    finalCheckpoint = resumeCheckpoint();
  } else {
    coverage.backfillStatus = coverage.oldestEvidenceAt ? "complete" : "empty";
    coverage.coveredThrough = now;
    coverage.lastSuccessfulSyncAt = now;
    coverage.canResume = false;
  }

  const { imported, unchanged } = persistEvidenceAndCoverage(username, emitted, coverage, finalCheckpoint);
  return {
    imported,
    unchanged,
    coverage,
    checkpoint: hasCheckpoint ? finalCheckpoint : null,
    warnings,
  };
}

export async function syncFromGitHub(input: SyncRequest): Promise<SyncResponse> {
  if (activeSync) throw new SyncInProgressError();
  activeSync = true;
  try {
  await restoreFromCloudOnce();
  const requestedUsername = input.username.toLowerCase();
  const profile = await getUser(requestedUsername);
  const username = profile.login.toLowerCase();
  saveProfile({
    username,
    displayName: profile.name ?? profile.login,
    avatarUrl: profile.avatar_url ?? null,
  });

  let imported = 0;
  let unchanged = 0;
  const warnings: string[] = [];
  const retryHints: string[] = [];
  const results: RepoSyncResult[] = [];
  const trackedCanonical = new Set<string>();

  for (const repositorySlug of input.repositories) {
    try {
      const result = await syncRepository(username, repositorySlug);
      imported += result.imported;
      unchanged += result.unchanged;
      warnings.push(...result.warnings);
      if (result.coverage.retryAt) retryHints.push(result.coverage.retryAt);
      trackedCanonical.add(result.coverage.repositoryId);
      if (result.coverage.repositoryId.toLowerCase() !== repositorySlug.toLowerCase()) {
        warnings.push(`Canonicalized repository ${repositorySlug} to ${result.coverage.repositoryId}.`);
      }
      results.push(result);
    } catch (error) {
      if (error instanceof GitHubSyncError) {
        const canonical = resolveCanonicalRepositoryId(username, repositorySlug) ?? repositorySlug;
        const fallbackCoverage = readCoverage(username, canonical)?.coverage ?? baseCoverage(username, canonical);
        fallbackCoverage.lastAttemptAt = new Date().toISOString();
        fallbackCoverage.backfillStatus = "failed";
        fallbackCoverage.failureReason = error.failureReason;
        fallbackCoverage.retryAt = error.retryAt;
        fallbackCoverage.canResume = true;
        updateCoverage(fallbackCoverage, null);
        warnings.push(`${canonical}: ${error.message}`);
        if (error.retryAt) retryHints.push(error.retryAt);
        trackedCanonical.add(canonical);
        results.push({ imported: 0, unchanged: 0, coverage: fallbackCoverage, checkpoint: null, warnings: [`${canonical}: ${error.message}`] });
        continue;
      }
      throw error;
    }
  }

  const partial = results.some((result) => result.coverage.backfillStatus === "partial" || result.coverage.backfillStatus === "failed" || result.coverage.backfillStatus === "in_progress");
  const previous = readSyncState();
  const lastSyncedAt = partial ? previous.lastSyncedAt : new Date().toISOString();
  upsertSyncState(username, lastSyncedAt, warnings, [...trackedCanonical]);
  if (cloudSaveEnabled() && !(await saveToCloud(username))) {
    warnings.push(`Cloud save failed; this progress is saved locally only and will be retried on the next sync. ${cloudSaveProblem() ?? ""}`.trim());
  }
  const dashboard = await buildDashboardSnapshot(username, { kind: "global" });

  return {
    dashboard,
    imported,
    unchanged,
    partial,
    warnings,
    retryAt: retryHints.sort()[0],
  };
  } finally {
    activeSync = false;
  }
}

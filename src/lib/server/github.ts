import "server-only";
import type { RepositoryCoverage, SkillTrack } from "@/lib/contracts";

const API_BASE = "https://api.github.com";
const USER_AGENT = "RepoQuest/0.1 (+https://github.com)";
const REQUEST_TIMEOUT_MS = 15000;

export type GitHubFailureReason = NonNullable<RepositoryCoverage["failureReason"]>;

export class GitHubSyncError extends Error {
  constructor(
    message: string,
    public readonly failureReason: GitHubFailureReason,
    public readonly retryAt?: string,
  ) {
    super(message);
  }
}

type FetchJsonResult<T> = {
  data: T;
  nextPage: number | null;
};

function tokenOrThrow(): string {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) {
    throw new GitHubSyncError(
      "Live sync is unavailable because GITHUB_TOKEN is not configured.",
      "provider_error",
    );
  }
  return token;
}

function parseNextPage(linkHeader: string | null): number | null {
  if (!linkHeader) return null;
  const part = linkHeader.split(",").find((value) => value.includes('rel="next"'));
  if (!part) return null;
  const match = part.match(/[?&]page=(\d+)/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function retryAtFromRetryAfter(retryAfterHeader: string | null): string | undefined {
  if (!retryAfterHeader) return undefined;
  const seconds = Number.parseInt(retryAfterHeader, 10);
  if (Number.isFinite(seconds) && seconds > 0) return new Date(Date.now() + seconds * 1000).toISOString();
  const fromDate = Date.parse(retryAfterHeader);
  if (!Number.isNaN(fromDate)) return new Date(fromDate).toISOString();
  return undefined;
}

async function fetchJson<T>(path: string): Promise<FetchJsonResult<T>> {
  const token = tokenOrThrow();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": "2022-11-28",
        "user-agent": USER_AGENT,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new GitHubSyncError("Network or timeout error while contacting GitHub.", "network_error");
  }

  if (!response.ok) {
    const reset = response.headers.get("x-ratelimit-reset");
    const retryAt = reset ? new Date(Number.parseInt(reset, 10) * 1000).toISOString() : undefined;
    const retryAfter = retryAtFromRetryAfter(response.headers.get("retry-after"));
    if (response.status === 429) {
      throw new GitHubSyncError("GitHub API rate limit reached.", "rate_limited", retryAfter ?? retryAt);
    }
    if (response.status === 403 && retryAfter) {
      throw new GitHubSyncError("GitHub secondary rate limit reached.", "rate_limited", retryAfter ?? retryAt);
    }
    if ((response.status === 403 || response.status === 429) && response.headers.get("x-ratelimit-remaining") === "0") {
      throw new GitHubSyncError("GitHub API rate limit reached.", "rate_limited", retryAt ?? retryAfter);
    }
    if (response.status === 401) {
      throw new GitHubSyncError("GitHub authentication failed.", "permission_denied", retryAt);
    }
    if (response.status === 403 || response.status === 404) {
      throw new GitHubSyncError("Repository access denied or not found.", "permission_denied", retryAt);
    }
    if (response.status >= 500) {
      throw new GitHubSyncError("GitHub provider error.", "provider_error", retryAt);
    }
    throw new GitHubSyncError("GitHub request failed.", "provider_error", retryAt);
  }

  const data = (await response.json()) as T;
  return {
    data,
    nextPage: parseNextPage(response.headers.get("link")),
  };
}

export type GitHubUser = { login: string; id: number; name: string | null; avatar_url: string | null };
export type GitHubRepo = { full_name: string; name: string; owner: { login: string }; html_url: string; description: string | null; private?: boolean };
export type GitHubPull = {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: "open" | "closed";
  merged_at: string | null;
  updated_at: string;
  user: { login: string; id: number } | null;
};
export type GitHubReview = {
  id: number;
  html_url: string;
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED" | "PENDING";
  submitted_at: string | null;
  user: { login: string; id: number } | null;
  pull_request_url: string;
};
export type GitHubIssue = {
  id: number;
  number: number;
  title: string;
  html_url: string;
  body: string | null;
  state: "open" | "closed";
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  pull_request?: unknown;
  labels: Array<{ name?: string }>;
  user: { login: string; id: number } | null;
};

export async function getUser(login: string): Promise<GitHubUser> {
  const { data } = await fetchJson<GitHubUser>(`/users/${encodeURIComponent(login)}`);
  return data;
}

export async function getRepository(owner: string, name: string): Promise<GitHubRepo> {
  const { data } = await fetchJson<GitHubRepo>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`);
  return data;
}

export async function listPullPage(owner: string, name: string, page: number): Promise<FetchJsonResult<GitHubPull[]>> {
  return fetchJson<GitHubPull[]>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls?state=all&sort=created&direction=asc&per_page=100&page=${page}`,
  );
}

export async function listPullPageIncremental(owner: string, name: string, page: number): Promise<FetchJsonResult<GitHubPull[]>> {
  return fetchJson<GitHubPull[]>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls?state=all&sort=updated&direction=desc&per_page=100&page=${page}`,
  );
}

export async function listPullReviewPage(owner: string, name: string, pullNumber: number, page: number): Promise<FetchJsonResult<GitHubReview[]>> {
  return fetchJson<GitHubReview[]>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls/${pullNumber}/reviews?per_page=100&page=${page}`,
  );
}

export async function listIssuePageByCreator(owner: string, name: string, creator: string, page: number): Promise<FetchJsonResult<GitHubIssue[]>> {
  return fetchJson<GitHubIssue[]>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/issues?state=all&sort=created&direction=asc&creator=${encodeURIComponent(creator)}&per_page=100&page=${page}`,
  );
}

export async function listIssuePageByCreatorIncremental(owner: string, name: string, creator: string, page: number): Promise<FetchJsonResult<GitHubIssue[]>> {
  return fetchJson<GitHubIssue[]>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/issues?state=all&sort=updated&direction=desc&creator=${encodeURIComponent(creator)}&per_page=100&page=${page}`,
  );
}

export function classifyPullTrack(title: string): SkillTrack {
  const text = title.toLowerCase();
  if (/\b(doc|docs|readme|tutorial|guide|handbook|changelog)\b/.test(text)) return "documentation";
  return "engineering";
}

export function isDocumentationIssue(title: string, body: string | null, labels: Array<{ name?: string }>): boolean {
  const labelText = labels.map((label) => (label.name ?? "").toLowerCase()).join(" ");
  const content = `${title}\n${body ?? ""}\n${labelText}`.toLowerCase();
  return /\b(doc|docs|documentation|readme|guide|tutorial|wiki)\b/.test(content);
}

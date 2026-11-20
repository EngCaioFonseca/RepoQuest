import "server-only";

export const GITHUB_API_BASE = "https://api.github.com";
export const GITHUB_USER_AGENT = "RepoQuest/0.1 (+https://github.com)";

/** Headers every authenticated GitHub REST request carries. */
export function githubApiHeaders(token: string): Record<string, string> {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "x-github-api-version": "2022-11-28",
    "user-agent": GITHUB_USER_AGENT,
  };
}

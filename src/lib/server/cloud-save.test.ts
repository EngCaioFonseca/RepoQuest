import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const TOKEN = "test-token-never-exported";
const USERNAME = "engcaiofonseca";
const REPO = "chaoss/CollectOSS";
const SAVE_FILE = `repoquest-save-${USERNAME}.json`;

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

function requestUrl(input: string | URL | Request): string {
  return typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
}

type FetchMock = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function githubResponse(url: URL): Response {
  if (url.pathname === `/users/${USERNAME}`) return jsonResponse({ login: "EngCaioFonseca", id: 999, name: "Eng", avatar_url: null });
  if (url.pathname.toLowerCase() === "/repos/chaoss/collectoss") {
    return jsonResponse({ full_name: REPO, name: "CollectOSS", owner: { login: "chaoss" }, html_url: `https://github.com/${REPO}`, description: "CollectOSS" });
  }
  if (url.pathname === `/repos/${REPO}/pulls`) {
    return jsonResponse([{ id: 1001, number: 11, title: "Core init", html_url: `https://github.com/${REPO}/pull/11`, state: "closed", merged_at: "2020-01-01T00:00:00Z", updated_at: "2020-01-01T00:00:00Z", user: { login: USERNAME, id: 1 } }]);
  }
  if (url.pathname === `/repos/${REPO}/pulls/11/reviews`) return jsonResponse([]);
  if (url.pathname === `/repos/${REPO}/issues`) return jsonResponse([]);
  return jsonResponse({ message: `unexpected ${url.pathname}` }, 500);
}

const githubMock: FetchMock = async (input) => githubResponse(new URL(requestUrl(input)));

type FakeGist = { id: string; updated_at: string; public: boolean; description: string; files: Record<string, string> };

/** An in-memory Gist API shared by every install in a test, plus the GitHub endpoints sync uses. */
function fakeGitHubWithGists(options: { denyGists?: boolean; truncateAbove?: number } = {}) {
  const gists = new Map<string, FakeGist>();
  const calls: Array<{ method: string; url: URL; authorization: string | null; body: string | null }> = [];
  let clock = 0;
  const tick = () => new Date(Date.UTC(2030, 0, 1, 0, 0, clock++)).toISOString();
  const fileView = (gist: FakeGist, name: string, withContent: boolean) => {
    const content = gist.files[name];
    const raw_url = `https://gist.githubusercontent.com/u/${gist.id}/raw/${name}`;
    if (!withContent) return { filename: name, raw_url };
    const truncated = options.truncateAbove !== undefined && content.length > options.truncateAbove;
    return { filename: name, raw_url, truncated, content: truncated ? content.slice(0, options.truncateAbove) : content };
  };
  const view = (gist: FakeGist, withContent: boolean) => ({
    id: gist.id,
    updated_at: gist.updated_at,
    public: gist.public,
    description: gist.description,
    files: Object.fromEntries(Object.keys(gist.files).map((name) => [name, fileView(gist, name, withContent)])),
  });

  const fetchMock: FetchMock = async (input, init) => {
    const url = new URL(requestUrl(input));
    const method = (init?.method ?? "GET").toUpperCase();
    const headers = new Headers(init?.headers);
    const body = typeof init?.body === "string" ? init.body : null;
    calls.push({ method, url, authorization: headers.get("authorization"), body });
    if (url.hostname === "gist.githubusercontent.com") {
      const [, , id, , name] = url.pathname.split("/");
      const content = gists.get(id)?.files[name];
      return content === undefined ? new Response("not found", { status: 404 }) : new Response(content);
    }
    if (!url.pathname.startsWith("/gists")) return githubResponse(url);
    if (options.denyGists) return jsonResponse({ message: "Resource not accessible by personal access token" }, 403);
    if (method === "GET" && url.pathname === "/gists") {
      const page = Number(url.searchParams.get("page") ?? "1");
      return jsonResponse(page === 1 ? [...gists.values()].map((gist) => view(gist, false)) : []);
    }
    if (method === "POST" && url.pathname === "/gists") {
      const payload = JSON.parse(body ?? "{}") as { description: string; public: boolean; files: Record<string, { content: string }> };
      const gist: FakeGist = {
        id: `gist${gists.size + 1}`,
        updated_at: tick(),
        public: payload.public,
        description: payload.description,
        files: Object.fromEntries(Object.entries(payload.files).map(([name, file]) => [name, file.content])),
      };
      gists.set(gist.id, gist);
      return jsonResponse(view(gist, true), 201);
    }
    const gist = gists.get(url.pathname.split("/")[2] ?? "");
    if (!gist) return jsonResponse({ message: "Not Found" }, 404);
    if (method === "GET") return jsonResponse(view(gist, true));
    if (method === "PATCH") {
      const payload = JSON.parse(body ?? "{}") as { files: Record<string, { content: string }> };
      for (const [name, file] of Object.entries(payload.files)) gist.files[name] = file.content;
      gist.updated_at = tick();
      return jsonResponse(view(gist, true));
    }
    return jsonResponse({ message: "unsupported" }, 500);
  };
  return { fetchMock, gists, calls };
}

type Install = {
  sync: typeof import("./sync");
  dashboard: typeof import("./dashboard");
  repository: typeof import("./repository");
  cloud: typeof import("./cloud-save");
};

const opened: Install[] = [];

/** A fresh module graph and SQLite file: what a new clone, machine or container sees. */
async function freshInstall(options: { env?: Record<string, string | undefined>; databasePath?: string } = {}): Promise<Install> {
  vi.resetModules();
  process.env.DATABASE_PATH = options.databasePath ?? join(mkdtempSync(join(tmpdir(), "repoquest-cloud-test-")), "repoquest.db");
  delete process.env.REPOQUEST_DB_PATH;
  delete process.env.CLOUD_SAVE;
  process.env.GITHUB_TOKEN = TOKEN;
  for (const [key, value] of Object.entries(options.env ?? {})) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  const install = {
    sync: await import("./sync"),
    dashboard: await import("./dashboard"),
    repository: await import("./repository"),
    cloud: await import("./cloud-save"),
  };
  opened.push(install);
  return install;
}

function pullSorts(calls: Array<{ url: URL }>): string[] {
  return calls.filter(({ url }) => url.pathname === `/repos/${REPO}/pulls`).map(({ url }) => url.searchParams.get("sort") ?? "");
}

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  while (opened.length) await opened.pop()?.cloud.closeCloudSave();
  delete process.env.CLOUD_SAVE;
});

describe("storage modes without cloud save", () => {
  it("keeps state in memory only when DATABASE_PATH is :memory:", async () => {
    vi.stubGlobal("fetch", vi.fn(githubMock));
    const cwdEntries = readdirSync(process.cwd());
    const { sync, dashboard } = await freshInstall({ databasePath: ":memory:" });
    const out = await sync.syncFromGitHub({ username: USERNAME, repositories: [REPO] });
    expect(out.dashboard.evidence.length).toBeGreaterThan(0);
    const snapshot = await dashboard.buildDashboardSnapshot();
    expect(snapshot.storage).toEqual({ local: "memory", cloudSave: "off", cloudBackend: null, cloudProblem: null, lastCloudSaveAt: null, restoredFromCloud: false });
    expect(existsSync(join(process.cwd(), ":memory:"))).toBe(false);
    expect(readdirSync(process.cwd())).toEqual(cwdEntries);
  });

  it("reports a local file without cloud save by default", async () => {
    vi.stubGlobal("fetch", vi.fn(githubMock));
    const { dashboard } = await freshInstall();
    const snapshot = await dashboard.buildDashboardSnapshot();
    expect(snapshot.storage?.local).toBe("file");
    expect(snapshot.storage?.cloudSave).toBe("off");
  });

  it("reports an unknown CLOUD_SAVE value as a configuration error", async () => {
    vi.stubGlobal("fetch", vi.fn(githubMock));
    const { dashboard } = await freshInstall({ env: { CLOUD_SAVE: "dropbox" } });
    const snapshot = await dashboard.buildDashboardSnapshot();
    expect(snapshot.storage?.cloudSave).toBe("error");
    expect(snapshot.storage?.cloudProblem).toMatch(/gist or off/);
  });
});

describe("mergeSaves", () => {
  it("unions evidence, keeps the newer coverage and the stored sync selection", async () => {
    const { cloud } = await freshInstall();
    const base = {
      format: "repoquest-save" as const,
      version: 1 as const,
      savedAt: "2030-01-01T00:00:00.000Z",
      profile: { username: USERNAME, display_name: "Eng", avatar_url: null, is_ai_engineer: false, ai_tool_usage: "unspecified", mage_quiz_json: null, updated_at: "2030-01-01T00:00:00.000Z" },
      repositories: [{ id: REPO, owner: "chaoss", name: "CollectOSS", url: `https://github.com/${REPO}`, description: "" }],
    };
    const coverage = (lastAttemptAt: string, status: string) => ({
      username: USERNAME, repository_id: REPO, requested_scope: "all_accessible_history", supported_kinds_json: "[]", backfill_status: status,
      oldest_evidence_at: null, newest_evidence_at: null, last_attempt_at: lastAttemptAt, last_successful_sync_at: lastAttemptAt,
      covered_through: lastAttemptAt, can_resume: false, limitations_json: "[]", failure_reason: null, retry_at: null, checkpoint_json: null,
    });
    const evidence = (id: string) => ({
      id, username: USERNAME, actor_login: USERNAME, actor_id: 1, repository_id: REPO, kind: "pull_request", track: "engineering",
      title: id, url: `https://github.com/${REPO}/pull/1`, occurred_at: "2020-01-01T00:00:00Z", state: "merged", reason: "", imported_at: "2030-01-01T00:00:00.000Z",
    });
    const stored = { ...base, syncState: { selected_repositories_json: `["${REPO}"]`, last_synced_at: "2030-02-01T00:00:00.000Z", warnings_json: "[]" }, coverage: [coverage("2030-02-01T00:00:00.000Z", "complete")], evidence: [evidence("a"), evidence("b")] };
    const local = { ...base, syncState: null, coverage: [coverage("2030-01-01T00:00:00.000Z", "partial")], evidence: [evidence("b"), evidence("c")] };
    const merged = cloud.mergeSaves(stored, local);
    expect(merged.evidence.map((row) => row.id)).toEqual(["a", "b", "c"]);
    expect(merged.coverage).toEqual([stored.coverage[0]]);
    expect(merged.syncState).toEqual(stored.syncState);
    expect(cloud.mergeSaves({ ...stored, profile: { ...stored.profile, username: "other" } }, local)).toBe(local);
  });
});

describe("cloud save to a GitHub Gist", () => {
  it("creates a secret Gist, restores a fresh install from it, and syncs incrementally afterwards", async () => {
    const github = fakeGitHubWithGists();
    vi.stubGlobal("fetch", vi.fn(github.fetchMock));
    const first = await freshInstall({ env: { CLOUD_SAVE: "gist" } });
    const original = await first.sync.syncFromGitHub({ username: USERNAME, repositories: [REPO] });
    expect(original.warnings.join("\n")).not.toMatch(/Cloud save failed/);
    expect(original.dashboard.storage).toMatchObject({ cloudSave: "ready", cloudBackend: "gist", cloudProblem: null });
    expect(github.gists.size).toBe(1);
    const [gist] = [...github.gists.values()];
    expect(gist.public).toBe(false);
    expect(Object.keys(gist.files)).toEqual([SAVE_FILE]);
    expect(JSON.parse(gist.files[SAVE_FILE]).evidence).toHaveLength(1);
    first.repository.updateClassPreference(USERNAME, { isAiEngineer: true, aiToolUsage: "frequent" });
    expect(await first.cloud.saveToCloud(USERNAME)).toBe(true);

    const second = await freshInstall({ env: { CLOUD_SAVE: "gist" } });
    const restored = await second.dashboard.buildDashboardSnapshot();
    expect(restored.source).toBe("live");
    expect(restored.profile.username).toBe(USERNAME);
    expect(restored.progression.totalXp).toBe(original.dashboard.progression.totalXp);
    expect(restored.evidence.map((item) => item.id)).toEqual(original.dashboard.evidence.map((item) => item.id));
    expect(restored.trackedRepositories).toEqual([REPO]);
    expect(restored.storage?.restoredFromCloud).toBe(true);
    expect(second.repository.readClassPreference(USERNAME)).toMatchObject({ isAiEngineer: true, aiToolUsage: "frequent" });

    github.calls.length = 0;
    const resumed = await second.sync.syncFromGitHub({ username: USERNAME, repositories: [REPO] });
    const sorts = pullSorts(github.calls);
    expect(sorts.length).toBeGreaterThan(0);
    expect(sorts.every((sort) => sort === "updated")).toBe(true);
    expect(resumed.imported).toBe(0);
    expect(github.gists.size).toBe(1);
    expect(github.calls.some(({ method }) => method === "PATCH")).toBe(true);
  });

  it("never sends the token to the raw host or into the save", async () => {
    const github = fakeGitHubWithGists({ truncateAbove: 100 });
    vi.stubGlobal("fetch", vi.fn(github.fetchMock));
    const first = await freshInstall({ env: { CLOUD_SAVE: "gist" } });
    await first.sync.syncFromGitHub({ username: USERNAME, repositories: [REPO] });
    const second = await freshInstall({ env: { CLOUD_SAVE: "gist" } });
    const restored = await second.dashboard.buildDashboardSnapshot();
    expect(restored.storage?.restoredFromCloud).toBe(true);
    const rawCalls = github.calls.filter(({ url }) => url.hostname === "gist.githubusercontent.com");
    expect(rawCalls.length).toBeGreaterThan(0);
    expect(rawCalls.every(({ authorization }) => authorization === null)).toBe(true);
    expect(github.calls.every(({ body }) => !body?.includes(TOKEN))).toBe(true);
  });

  it("keeps a sync successful and explains a token without Gist permission", async () => {
    const github = fakeGitHubWithGists({ denyGists: true });
    vi.stubGlobal("fetch", vi.fn(github.fetchMock));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { sync } = await freshInstall({ env: { CLOUD_SAVE: "gist" } });
    const out = await sync.syncFromGitHub({ username: USERNAME, repositories: [REPO] });
    expect(out.dashboard.evidence.length).toBeGreaterThan(0);
    expect(out.warnings.join("\n")).toMatch(/Cloud save failed.*Gists read and write permission/);
    expect(out.dashboard.storage).toMatchObject({ cloudSave: "error", cloudBackend: "gist" });
    expect(JSON.stringify(out)).not.toContain(TOKEN);
  });

  it("reports Gist mode without a token as a configuration error", async () => {
    vi.stubGlobal("fetch", vi.fn(githubMock));
    const { dashboard } = await freshInstall({ env: { CLOUD_SAVE: "gist", GITHUB_TOKEN: undefined } });
    const snapshot = await dashboard.buildDashboardSnapshot();
    expect(snapshot.storage).toMatchObject({ cloudSave: "error", cloudBackend: "gist" });
    expect(snapshot.storage?.cloudProblem).toMatch(/GITHUB_TOKEN/);
  });

  it("never overwrites a local player with the Gist save", async () => {
    const github = fakeGitHubWithGists();
    vi.stubGlobal("fetch", vi.fn(github.fetchMock));
    const saved = await freshInstall({ env: { CLOUD_SAVE: "gist" } });
    await saved.sync.syncFromGitHub({ username: USERNAME, repositories: [REPO] });
    const local = await freshInstall();
    local.repository.upsertSyncState("someone-else", null, [], []);
    const reopened = await freshInstall({ env: { CLOUD_SAVE: "gist" }, databasePath: process.env.DATABASE_PATH });
    const snapshot = await reopened.dashboard.buildDashboardSnapshot();
    expect(snapshot.profile.username).toBe("someone-else");
    expect(snapshot.storage?.restoredFromCloud).toBe(false);
  });
});

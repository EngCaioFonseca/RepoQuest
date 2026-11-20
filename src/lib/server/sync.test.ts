import { existsSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardScope, SyncRequest } from "@/lib/contracts";
import { DatabaseSync } from "node:sqlite";

vi.mock("server-only", () => ({}));

type JsonBody = unknown;

function jsonResponse(body: JsonBody, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

function buildFetchMock(options: { paginated?: boolean; rateLimited?: boolean } = {}): (input: string | URL | Request) => Promise<Response> {
  const paginated = options.paginated ?? false;
  const rateLimited = options.rateLimited ?? false;
  return async (input) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(raw);
    const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
    if (url.pathname === "/users/engcaiofonseca") {
      return jsonResponse({ login: "EngCaioFonseca", id: 999, name: "Eng", avatar_url: null });
    }
    if (url.pathname === "/repos/oss-aspen/8Knot") {
      return jsonResponse({ full_name: "chaoss/8Knot", name: "8Knot", owner: { login: "chaoss" }, html_url: "https://github.com/chaoss/8Knot", description: "8Knot" });
    }
    if (url.pathname === "/repos/chaoss/CollectOSS") {
      return jsonResponse({ full_name: "chaoss/CollectOSS", name: "CollectOSS", owner: { login: "chaoss" }, html_url: "https://github.com/chaoss/CollectOSS", description: "CollectOSS" });
    }
    if (url.pathname === "/repos/chaoss/CollectOSS/pulls") {
      if (url.searchParams.get("state") !== "all") return jsonResponse({ message: "expected state=all" }, { status: 500 });
      if (url.searchParams.get("sort") !== "created") return jsonResponse({ message: "expected sort=created" }, { status: 500 });
      if (url.searchParams.get("direction") !== "asc") return jsonResponse({ message: "expected direction=asc" }, { status: 500 });
      if (rateLimited) {
        return jsonResponse({ message: "rate limit" }, {
          status: 403,
          headers: {
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": "2000000000",
          },
        });
      }
      if (paginated && page === 1) {
        return jsonResponse(
          [{ id: 1001, number: 11, title: "Feature 1", html_url: "https://github.com/chaoss/CollectOSS/pull/11", state: "closed", merged_at: "2023-01-01T00:00:00Z", user: { login: "engcaiofonseca", id: 1 }, body: "" }],
          { headers: { link: '<https://api.github.com/repos/chaoss/CollectOSS/pulls?page=2>; rel="next"' } },
        );
      }
      if (paginated && page === 2) {
        return jsonResponse([{ id: 1002, number: 12, title: "Feature 2", html_url: "https://github.com/chaoss/CollectOSS/pull/12", state: "closed", merged_at: "2023-01-02T00:00:00Z", user: { login: "engcaiofonseca", id: 1 }, body: "" }]);
      }
      return jsonResponse([
        { id: 1001, number: 11, title: "Feature 1", html_url: "https://github.com/chaoss/CollectOSS/pull/11", state: "closed", merged_at: "2023-01-01T00:00:00Z", user: { login: "engcaiofonseca", id: 1 }, body: "docs update" },
        { id: 1002, number: 12, title: "Other author", html_url: "https://github.com/chaoss/CollectOSS/pull/12", state: "closed", merged_at: "2023-01-03T00:00:00Z", user: { login: "someoneelse", id: 2 }, body: "" },
      ]);
    }
    if (url.pathname === "/repos/chaoss/8Knot/pulls") {
      if (url.searchParams.get("state") !== "all") return jsonResponse({ message: "expected state=all" }, { status: 500 });
      return jsonResponse([{ id: 2001, number: 21, title: "Docs: improve guide", html_url: "https://github.com/chaoss/8Knot/pull/21", state: "closed", merged_at: "2023-02-01T00:00:00Z", user: { login: "engcaiofonseca", id: 1 }, body: "docs" }]);
    }
    if (url.pathname === "/repos/chaoss/CollectOSS/pulls/11/reviews") {
      return jsonResponse([
        { id: 5001, html_url: "https://github.com/chaoss/CollectOSS/pull/11#pullrequestreview-5001", state: "APPROVED", submitted_at: "2023-01-04T00:00:00Z", user: { login: "engcaiofonseca", id: 1 }, pull_request_url: "" },
      ]);
    }
    if (url.pathname === "/repos/chaoss/CollectOSS/pulls/12/reviews") {
      return jsonResponse([]);
    }
    if (url.pathname === "/repos/chaoss/8Knot/pulls/21/reviews") {
      return jsonResponse([
        { id: 5002, html_url: "https://github.com/chaoss/8Knot/pull/21#pullrequestreview-5002", state: "CHANGES_REQUESTED", submitted_at: "2023-02-04T00:00:00Z", user: { login: "engcaiofonseca", id: 1 }, pull_request_url: "" },
      ]);
    }
    if (url.pathname === "/repos/chaoss/CollectOSS/issues") {
      return jsonResponse([
        { id: 8001, number: 31, title: "Docs: onboarding", html_url: "https://github.com/chaoss/CollectOSS/issues/31", body: "", state: "closed", closed_at: "2023-01-05T00:00:00Z", created_at: "2023-01-01T00:00:00Z", labels: [{ name: "documentation" }], user: { login: "engcaiofonseca", id: 1 } },
      ]);
    }
    if (url.pathname === "/repos/chaoss/8Knot/issues") {
      return jsonResponse([]);
    }
    return jsonResponse({ message: `unexpected ${url.pathname}` }, { status: 500 });
  };
}

function buildMidPageFailureFetchMock(options: { failOnce?: boolean } = {}): (input: string | URL | Request) => Promise<Response> {
  let failReviewPage2Once = options.failOnce ?? true;
  return async (input) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(raw);
    const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
    if (url.pathname === "/users/engcaiofonseca") {
      return jsonResponse({ login: "EngCaioFonseca", id: 999, name: "Eng", avatar_url: null });
    }
    if (url.pathname === "/repos/chaoss/CollectOSS") {
      return jsonResponse({ full_name: "chaoss/CollectOSS", name: "CollectOSS", owner: { login: "chaoss" }, html_url: "https://github.com/chaoss/CollectOSS", description: "CollectOSS" });
    }
    if (url.pathname === "/repos/chaoss/CollectOSS/pulls") {
      if (page === 1) {
        return jsonResponse(
          [
            { id: 1001, number: 11, title: "Feature 1", html_url: "https://github.com/chaoss/CollectOSS/pull/11", state: "closed", merged_at: "2023-01-01T00:00:00Z", user: { login: "engcaiofonseca", id: 1 }, body: "" },
            { id: 1002, number: 12, title: "Feature 2", html_url: "https://github.com/chaoss/CollectOSS/pull/12", state: "closed", merged_at: "2023-01-02T00:00:00Z", user: { login: "engcaiofonseca", id: 1 }, body: "" },
          ],
          { headers: { link: '<https://api.github.com/repos/chaoss/CollectOSS/pulls?page=2>; rel="next"' } },
        );
      }
      if (page === 2) {
        return jsonResponse([
          { id: 1003, number: 13, title: "Feature 3", html_url: "https://github.com/chaoss/CollectOSS/pull/13", state: "closed", merged_at: "2023-01-03T00:00:00Z", user: { login: "engcaiofonseca", id: 1 }, body: "" },
        ]);
      }
      return jsonResponse([]);
    }
    if (url.pathname === "/repos/chaoss/CollectOSS/pulls/11/reviews") {
      if (page === 1) {
        return jsonResponse(
          [{ id: 5001, html_url: "https://github.com/chaoss/CollectOSS/pull/11#pullrequestreview-5001", state: "APPROVED", submitted_at: "2023-01-04T00:00:00Z", user: { login: "engcaiofonseca", id: 1 }, pull_request_url: "" }],
          { headers: { link: '<https://api.github.com/repos/chaoss/CollectOSS/pulls/11/reviews?page=2>; rel="next"' } },
        );
      }
      if (page === 2) {
        if (failReviewPage2Once) {
          failReviewPage2Once = false;
          return jsonResponse({ message: "rate limit" }, {
            status: 403,
            headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "2000000000" },
          });
        }
        return jsonResponse([{ id: 5002, html_url: "https://github.com/chaoss/CollectOSS/pull/11#pullrequestreview-5002", state: "CHANGES_REQUESTED", submitted_at: "2023-01-04T12:00:00Z", user: { login: "engcaiofonseca", id: 1 }, pull_request_url: "" }]);
      }
    }
    if (url.pathname === "/repos/chaoss/CollectOSS/pulls/12/reviews") {
      return jsonResponse([]);
    }
    if (url.pathname === "/repos/chaoss/CollectOSS/pulls/13/reviews") {
      return jsonResponse([{ id: 5003, html_url: "https://github.com/chaoss/CollectOSS/pull/13#pullrequestreview-5003", state: "APPROVED", submitted_at: "2023-01-06T00:00:00Z", user: { login: "engcaiofonseca", id: 1 }, pull_request_url: "" }]);
    }
    if (url.pathname === "/repos/chaoss/CollectOSS/issues") {
      return jsonResponse([]);
    }
    return jsonResponse({ message: `unexpected ${url.pathname}` }, { status: 500 });
  };
}

function buildOpenPrReviewFetchMock(): (input: string | URL | Request) => Promise<Response> {
  return async (input) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(raw);
    if (url.pathname === "/users/engcaiofonseca") {
      return jsonResponse({ login: "EngCaioFonseca", id: 999, name: "Eng", avatar_url: null });
    }
    if (url.pathname === "/repos/chaoss/CollectOSS") {
      return jsonResponse({ full_name: "chaoss/CollectOSS", name: "CollectOSS", owner: { login: "chaoss" }, html_url: "https://github.com/chaoss/CollectOSS", description: "CollectOSS" });
    }
    if (url.pathname === "/repos/chaoss/CollectOSS/pulls") {
      return jsonResponse([
        { id: 1001, number: 11, title: "Open PR by other", html_url: "https://github.com/chaoss/CollectOSS/pull/11", state: "open", merged_at: null, user: { login: "other", id: 2 }, body: "" },
      ]);
    }
    if (url.pathname === "/repos/chaoss/CollectOSS/pulls/11/reviews") {
      return jsonResponse([
        { id: 5001, html_url: "https://github.com/chaoss/CollectOSS/pull/11#pullrequestreview-5001", state: "APPROVED", submitted_at: "2024-01-04T00:00:00Z", user: { login: "engcaiofonseca", id: 1 }, pull_request_url: "" },
      ]);
    }
    if (url.pathname === "/repos/chaoss/CollectOSS/issues") {
      return jsonResponse([]);
    }
    return jsonResponse({ message: `unexpected ${url.pathname}` }, { status: 500 });
  };
}

function buildBudgetExhaustFetchMock(): (input: string | URL | Request) => Promise<Response> {
  return async (input) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(raw);
    const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
    if (url.pathname === "/users/engcaiofonseca") {
      return jsonResponse({ login: "EngCaioFonseca", id: 999, name: "Eng", avatar_url: null });
    }
    if (url.pathname === "/repos/chaoss/CollectOSS") {
      return jsonResponse({ full_name: "chaoss/CollectOSS", name: "CollectOSS", owner: { login: "chaoss" }, html_url: "https://github.com/chaoss/CollectOSS", description: "CollectOSS" });
    }
    if (url.pathname === "/repos/chaoss/CollectOSS/pulls") {
      const body = [{ id: 1000 + page, number: page, title: `Feature ${page}`, html_url: `https://github.com/chaoss/CollectOSS/pull/${page}`, state: "closed", merged_at: `2023-01-${String((page % 28) + 1).padStart(2, "0")}T00:00:00Z`, user: { login: "engcaiofonseca", id: 1 }, body: "" }];
      const headers = page < 40 ? { link: `<https://api.github.com/repos/chaoss/CollectOSS/pulls?page=${page + 1}>; rel="next"` } : undefined;
      return jsonResponse(body, headers ? { headers } : {});
    }
    if (url.pathname.match(/\/repos\/chaoss\/CollectOSS\/pulls\/\d+\/reviews/)) {
      return jsonResponse([]);
    }
    if (url.pathname === "/repos/chaoss/CollectOSS/issues") {
      return jsonResponse([]);
    }
    return jsonResponse({ message: `unexpected ${url.pathname}` }, { status: 500 });
  };
}

async function loadFresh(mods: { maxRequests?: string; dbPath?: string } = {}): Promise<{
  syncFromGitHub: (input: SyncRequest) => Promise<any>;
  buildDashboardSnapshot: (username?: string | null, scope?: DashboardScope) => Promise<any>;
  buildShareSvg: (scope: DashboardScope) => Promise<string>;
  readCoverage: (username: string, repositoryId: string) => { coverage: any; checkpoint: unknown } | null;
  updateCoverage: (coverage: any, checkpoint: Record<string, unknown> | null) => void;
  upsertSyncState: (username: string | null, lastSyncedAt: string | null, warnings: string[], selectedRepositories: string[]) => void;
  readEvidenceRow: (id: string) => { track: string; imported_at: string } | null;
  readClassPreference: (username: string) => { isAiEngineer: boolean; aiToolUsage: string };
  updateClassPreference: (username: string, preference: { isAiEngineer: boolean; aiToolUsage: "unspecified" | "none" | "occasional" | "frequent" | "ai_first"; mageQuiz?: { workflow: "prompting" | "single_agent" | "multi_agent" | "agent_systems"; engineering: "prompting" | "integrating" | "building" | "operating"; verification: "manual" | "automated_tests" | "evaluations" | "continuous" } | null }) => void;
}> {
  vi.resetModules();
  const path = mods.dbPath ?? join(mkdtempSync(join(tmpdir(), "repoquest-sync-test-")), "repoquest.sqlite");
  process.env.DATABASE_PATH = path;
  delete process.env.REPOQUEST_DB_PATH;
  process.env.REPOQUEST_MAX_REQUESTS_PER_SYNC = mods.maxRequests ?? "220";
  process.env.GITHUB_TOKEN = "test-token-never-exported";
  const sync = await import("./sync");
  const dashboard = await import("./dashboard");
  const share = await import("./share");
  const repository = await import("./repository");
  const db = await import("./db");
  return {
    syncFromGitHub: sync.syncFromGitHub,
    buildDashboardSnapshot: dashboard.buildDashboardSnapshot,
    buildShareSvg: share.buildShareSvg,
    readCoverage: repository.readCoverage,
    updateCoverage: repository.updateCoverage,
    upsertSyncState: repository.upsertSyncState,
    readEvidenceRow: (id: string) => {
      const row = db.database().prepare("SELECT track, imported_at FROM evidence WHERE id = ?").get(id) as
        | { track: string; imported_at: string }
        | undefined;
      return row ?? null;
    },
    readClassPreference: repository.readClassPreference,
    updateClassPreference: (username, preference) => {
      repository.updateClassPreference(username, preference);
    },
  };
}

function buildIncrementalPauseFetchMock(): (input: string | URL | Request) => Promise<Response> {
  let mode: "backfill" | "incremental" = "backfill";
  return async (input) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(raw);
    if (url.pathname === "/users/engcaiofonseca") return jsonResponse({ login: "EngCaioFonseca", id: 999, name: "Eng", avatar_url: null });
    if (url.pathname.toLowerCase() === "/repos/chaoss/collectoss") {
      return jsonResponse({ full_name: "chaoss/CollectOSS", name: "CollectOSS", owner: { login: "chaoss" }, html_url: "https://github.com/chaoss/CollectOSS", description: "CollectOSS" });
    }
    if (url.pathname === "/repos/chaoss/CollectOSS/pulls") {
      const sort = url.searchParams.get("sort");
      mode = sort === "created" ? "backfill" : "incremental";
      if (sort === "created") {
        return jsonResponse([{ id: 1001, number: 11, title: "Core init", html_url: "https://github.com/chaoss/CollectOSS/pull/11", state: "closed", merged_at: "2020-01-01T00:00:00Z", updated_at: "2020-01-01T00:00:00Z", user: { login: "engcaiofonseca", id: 1 } }]);
      }
      return jsonResponse([{ id: 1001, number: 11, title: "Core init", html_url: "https://github.com/chaoss/CollectOSS/pull/11", state: "closed", merged_at: "2020-01-01T00:00:00Z", updated_at: "2030-01-01T00:00:00Z", user: { login: "engcaiofonseca", id: 1 } }]);
    }
    if (url.pathname === "/repos/chaoss/CollectOSS/pulls/11/reviews") {
      if (mode === "backfill") return jsonResponse([]);
      const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
      const review = { id: 9000 + page, html_url: `https://github.com/chaoss/CollectOSS/pull/11#pullrequestreview-${9000 + page}`, state: "APPROVED", submitted_at: "2030-01-01T12:00:00Z", user: { login: "engcaiofonseca", id: 1 }, pull_request_url: "" };
      if (page < 20) return jsonResponse([review], { headers: { link: `<https://api.github.com/repos/chaoss/CollectOSS/pulls/11/reviews?page=${page + 1}>; rel="next"` } });
      return jsonResponse([review]);
    }
    if (url.pathname === "/repos/chaoss/CollectOSS/issues") return jsonResponse([]);
    return jsonResponse({ message: `unexpected ${url.pathname}` }, { status: 500 });
  };
}

describe("sync service", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(buildFetchMock()));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("imports historical data idempotently and keeps actor attribution", async () => {
    const { syncFromGitHub } = await loadFresh();
    const request: SyncRequest = { username: "engcaiofonseca", repositories: ["oss-aspen/8Knot", "chaoss/CollectOSS"] };
    const first = await syncFromGitHub(request);
    const second = await syncFromGitHub(request);
    expect(first.imported).toBeGreaterThan(0);
    expect(second.imported).toBe(0);
    expect(second.unchanged).toBeGreaterThan(0);
    expect(first.dashboard.evidence.every((item: { actor: { login: string } }) => item.actor.login.toLowerCase() === "engcaiofonseca")).toBe(true);
    expect(first.warnings.join("\n")).toContain("Canonicalized repository oss-aspen/8Knot to chaoss/8Knot.");
    expect(first.dashboard.progression.totalXp).toBe(second.dashboard.progression.totalXp);
  });

  it("isolates tests from inherited DATABASE_PATH sentinel", async () => {
    const sentinelDir = mkdtempSync(join(tmpdir(), "repoquest-sentinel-"));
    const sentinelPath = join(sentinelDir, "sentinel.sqlite");
    const sentinelDb = new DatabaseSync(sentinelPath);
    sentinelDb.exec("CREATE TABLE evidence (id TEXT PRIMARY KEY, username TEXT, imported_at TEXT)");
    sentinelDb.exec("INSERT INTO evidence (id, username, imported_at) VALUES ('keep', 'sentinel', '2000-01-01T00:00:00Z')");
    sentinelDb.close();
    process.env.DATABASE_PATH = sentinelPath;
    const { syncFromGitHub } = await loadFresh();
    await syncFromGitHub({ username: "engcaiofonseca", repositories: ["chaoss/CollectOSS"] });
    const verify = new DatabaseSync(sentinelPath);
    const row = verify.prepare("SELECT COUNT(*) AS c FROM evidence").get() as { c: number };
    verify.close();
    expect(row.c).toBe(1);
    expect(existsSync(sentinelPath)).toBe(true);
  });

  it("marks sync partial on request budget exhaustion and resumes later", async () => {
    vi.stubGlobal("fetch", vi.fn(buildBudgetExhaustFetchMock()));
    const lowBudget = await loadFresh({ maxRequests: "11" });
    const req: SyncRequest = { username: "engcaiofonseca", repositories: ["chaoss/CollectOSS"] };
    const partial = await lowBudget.syncFromGitHub(req);
    const partialCoverage = partial.dashboard.repositories.find((repo: { id: string }) => repo.id === "chaoss/CollectOSS")?.coverage;
    expect(partial.partial).toBe(true);
    expect(partialCoverage?.canResume).toBe(true);
    expect(partialCoverage?.backfillStatus).toBe("partial");

    const resumed = await lowBudget.syncFromGitHub(req);
    expect(resumed.dashboard.evidence.length).toBeGreaterThanOrEqual(partial.dashboard.evidence.length);
  });

  it("returns partial warnings with retryAt on GitHub rate limits", async () => {
    vi.stubGlobal("fetch", vi.fn(buildFetchMock({ rateLimited: true })));
    const { syncFromGitHub, buildDashboardSnapshot } = await loadFresh();
    const out = await syncFromGitHub({ username: "engcaiofonseca", repositories: ["chaoss/CollectOSS"] });
    expect(out.partial).toBe(true);
    expect(out.retryAt).toMatch(/^20/);
    const dashboard = await buildDashboardSnapshot("engcaiofonseca");
    expect(dashboard.warnings.join(" ")).toMatch(/rate limit/i);
    expect(dashboard.progression.totalXp).toBe(0);
  });

  it("persists fetched evidence on mid-page failure and resumes to full uninterrupted history", async () => {
    vi.stubGlobal("fetch", vi.fn(buildMidPageFailureFetchMock({ failOnce: true })));
    const { syncFromGitHub } = await loadFresh();
    const req: SyncRequest = { username: "engcaiofonseca", repositories: ["chaoss/CollectOSS"] };
    const first = await syncFromGitHub(req);
    expect(first.partial).toBe(true);
    expect(first.imported).toBeGreaterThan(0);
    const resumed = await syncFromGitHub(req);
    expect(resumed.partial).toBe(false);
    const resumedIds = resumed.dashboard.evidence.map((item: { id: string }) => item.id).sort();

    vi.stubGlobal("fetch", vi.fn(buildMidPageFailureFetchMock({ failOnce: false })));
    const uninterruptedCtx = await loadFresh();
    const uninterrupted = await uninterruptedCtx.syncFromGitHub(req);
    const uninterruptedIds = uninterrupted.dashboard.evidence.map((item: { id: string }) => item.id).sort();
    expect(resumedIds).toEqual(uninterruptedIds);
  });

  it("includes review evidence from open pull requests and uses stable pull pagination ordering", async () => {
    const fetchSpy = vi.fn(buildOpenPrReviewFetchMock());
    vi.stubGlobal("fetch", fetchSpy);
    const { syncFromGitHub } = await loadFresh();
    const out = await syncFromGitHub({ username: "engcaiofonseca", repositories: ["chaoss/CollectOSS"] });
    expect(out.dashboard.evidence.some((item: { kind: string; id: string }) => item.kind === "review" && item.id.includes("5001"))).toBe(true);

    const pullCall = fetchSpy.mock.calls
      .map(([request]) => (typeof request === "string" ? request : request instanceof URL ? request.toString() : request.url))
      .find((url) => url.includes("/repos/chaoss/CollectOSS/pulls?"));
    expect(pullCall).toContain("state=all");
    expect(pullCall).toContain("sort=created");
    expect(pullCall).toContain("direction=asc");
  });

  it("restarts from page 1 for legacy checkpoints without double-crediting existing evidence", async () => {
    const fetchSpy = vi.fn(buildFetchMock({ paginated: true }));
    vi.stubGlobal("fetch", fetchSpy);
    const { syncFromGitHub, readCoverage, updateCoverage } = await loadFresh();
    const req: SyncRequest = { username: "engcaiofonseca", repositories: ["chaoss/CollectOSS"] };
    const first = await syncFromGitHub(req);
    const baselineXp = first.dashboard.progression.totalXp;

    const current = readCoverage("engcaiofonseca", "chaoss/CollectOSS");
    expect(current).not.toBeNull();
    if (!current) throw new Error("coverage must exist");
    current.coverage.backfillStatus = "partial";
    current.coverage.canResume = true;
    updateCoverage(current.coverage, {
      phase: "pulls",
      pullPage: 7,
      pullIndex: 22,
      reviewPage: 4,
      issuePage: 1,
    });

    fetchSpy.mockClear();
    const resumed = await syncFromGitHub(req);
    const pullsCalls = fetchSpy.mock.calls
      .map(([request]) => (typeof request === "string" ? request : request instanceof URL ? request.toString() : request.url))
      .filter((url) => url.includes("/repos/chaoss/CollectOSS/pulls?"));
    expect(pullsCalls.some((url) => url.includes("page=1"))).toBe(true);
    expect(resumed.dashboard.progression.totalXp).toBe(baselineXp);
    expect(resumed.imported).toBe(0);
    expect(resumed.unchanged).toBeGreaterThan(0);
    expect(resumed.warnings.join(" ")).toMatch(/legacy checkpoint format/i);
  });

  it("never leaks GITHUB_TOKEN in share SVG output", async () => {
    const { syncFromGitHub, buildShareSvg } = await loadFresh();
    await syncFromGitHub({ username: "engcaiofonseca", repositories: ["chaoss/CollectOSS"] });
    const svg = await buildShareSvg({ kind: "global" });
    expect(svg).not.toContain("test-token-never-exported");
  });

  it("resumes interrupted incremental sync in incremental mode and imports new review", async () => {
    vi.stubGlobal("fetch", vi.fn(buildIncrementalPauseFetchMock()));
    const dbPath = join(mkdtempSync(join(tmpdir(), "repoquest-sync-p2-2-")), "repoquest.sqlite");
    const setup = await loadFresh({ dbPath, maxRequests: "220" });
    const req: SyncRequest = { username: "engcaiofonseca", repositories: ["chaoss/CollectOSS"] };
    const baseline = await setup.syncFromGitHub(req);
    expect(baseline.partial).toBe(false);

    const pausedCtx = await loadFresh({ dbPath, maxRequests: "11" });
    const paused = await pausedCtx.syncFromGitHub(req);
    expect(paused.partial).toBe(true);

    const resumedCtx = await loadFresh({ dbPath, maxRequests: "220" });
    const resumed = await resumedCtx.syncFromGitHub(req);
    expect(resumed.partial).toBe(false);
    expect(resumed.dashboard.evidence.some((item: { id: string }) => item.id === "gh:review:chaoss/collectoss:9001")).toBe(true);
  });

  it("records canonical repository identity on repo-fetch failure fallback", async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "repoquest-sync-p2-4-")), "repoquest.sqlite");
    vi.stubGlobal("fetch", vi.fn(buildFetchMock()));
    const first = await loadFresh({ dbPath });
    await first.syncFromGitHub({ username: "engcaiofonseca", repositories: ["chaoss/CollectOSS"] });

    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const url = new URL(raw);
      if (url.pathname === "/users/engcaiofonseca") return jsonResponse({ login: "EngCaioFonseca", id: 999, name: "Eng", avatar_url: null });
      if (url.pathname.toLowerCase() === "/repos/chaoss/collectoss") return jsonResponse({ message: "boom" }, { status: 500 });
      return jsonResponse({ message: "unexpected" }, { status: 500 });
    }));
    const second = await loadFresh({ dbPath });
    const out = await second.syncFromGitHub({ username: "engcaiofonseca", repositories: ["chaoss/collectoss"] });
    const ids = out.dashboard.repositories.map((repo: { id: string }) => repo.id);
    expect(ids.includes("chaoss/CollectOSS")).toBe(true);
    expect(ids.includes("chaoss/collectoss")).toBe(false);
  });

  it("prevents overlapping syncs in one process", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const url = new URL(raw);
      if (url.pathname === "/users/engcaiofonseca") {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return jsonResponse({ login: "EngCaioFonseca", id: 999, name: "Eng", avatar_url: null });
      }
      if (url.pathname.toLowerCase() === "/repos/chaoss/collectoss") {
        return jsonResponse({ full_name: "chaoss/CollectOSS", name: "CollectOSS", owner: { login: "chaoss" }, html_url: "https://github.com/chaoss/CollectOSS", description: "CollectOSS" });
      }
      if (url.pathname === "/repos/chaoss/CollectOSS/pulls") return jsonResponse([]);
      if (url.pathname === "/repos/chaoss/CollectOSS/issues") return jsonResponse([]);
      return jsonResponse({ message: "unexpected" }, { status: 500 });
    }));
    const ctx = await loadFresh();
    const req: SyncRequest = { username: "engcaiofonseca", repositories: ["chaoss/CollectOSS"] };
    const first = ctx.syncFromGitHub(req);
    await expect(ctx.syncFromGitHub(req)).rejects.toThrow(/already running/i);
    await first;
  });

  it("supports scope switching without mutating tracked selection or evidence state", async () => {
    const { syncFromGitHub, buildDashboardSnapshot } = await loadFresh();
    await syncFromGitHub({ username: "engcaiofonseca", repositories: ["chaoss/8Knot", "chaoss/CollectOSS"] });

    const globalBefore = await buildDashboardSnapshot("engcaiofonseca", { kind: "global" });
    const localCollect = await buildDashboardSnapshot("engcaiofonseca", { kind: "repository", repositoryId: "chaoss/CollectOSS" });
    const globalAfter = await buildDashboardSnapshot("engcaiofonseca", { kind: "global" });

    expect(localCollect.scope).toEqual({ kind: "repository", repositoryId: "chaoss/CollectOSS" });
    expect(localCollect.repositories).toHaveLength(1);
    expect(localCollect.repositories[0].id).toBe("chaoss/CollectOSS");
    expect(localCollect.evidence.every((item: { repositoryId: string }) => item.repositoryId === "chaoss/CollectOSS")).toBe(true);
    expect(globalBefore.progression.totalXp).toBe(globalAfter.progression.totalXp);
    expect(globalBefore.trackedRepositories).toEqual(globalAfter.trackedRepositories);
  });

  it("keeps achievement evidence ids and unlock dates scoped to repository view", async () => {
    const { syncFromGitHub, buildDashboardSnapshot } = await loadFresh();
    await syncFromGitHub({ username: "engcaiofonseca", repositories: ["chaoss/CollectOSS"] });
    const local = await buildDashboardSnapshot("engcaiofonseca", { kind: "repository", repositoryId: "chaoss/CollectOSS" });
    const evidenceIds = new Set(local.evidence.map((item: { id: string }) => item.id));
    for (const achievement of local.achievements as Array<{ evidenceIds: string[]; unlockedAt: string | null }>) {
      for (const id of achievement.evidenceIds) {
        expect(evidenceIds.has(id)).toBe(true);
      }
      if (achievement.unlockedAt) {
        expect(achievement.unlockedAt.startsWith("2023-")).toBe(true);
      }
    }
  });

  it("renders share svg in repository scope with matching label", async () => {
    const { syncFromGitHub, buildShareSvg } = await loadFresh();
    await syncFromGitHub({ username: "engcaiofonseca", repositories: ["chaoss/CollectOSS"] });
    const svg = await buildShareSvg({ kind: "repository", repositoryId: "chaoss/CollectOSS" });
    expect(svg).toContain("Repository: chaoss/CollectOSS");
  });

  it("scopes dashboard warnings to selected repository", async () => {
    const { syncFromGitHub, buildDashboardSnapshot, upsertSyncState } = await loadFresh();
    await syncFromGitHub({ username: "engcaiofonseca", repositories: ["chaoss/8Knot", "chaoss/CollectOSS"] });
    upsertSyncState(
      "engcaiofonseca",
      null,
      ["chaoss/8Knot: historical import is partial and provisional.", "Backfill for chaoss/8Knot paused after 220 requests.", "global note"],
      ["chaoss/8Knot", "chaoss/CollectOSS"],
    );
    const localCollect = await buildDashboardSnapshot("engcaiofonseca", { kind: "repository", repositoryId: "chaoss/CollectOSS" });
    expect(localCollect.warnings.some((text: string) => text.includes("chaoss/8Knot:"))).toBe(false);
    expect(localCollect.warnings.some((text: string) => text.includes("Backfill for chaoss/8Knot"))).toBe(false);
    expect(localCollect.warnings).toContain("global note");
  });

  it("omits global-only realm achievements in repository scope", async () => {
    const { syncFromGitHub, buildDashboardSnapshot } = await loadFresh();
    await syncFromGitHub({ username: "engcaiofonseca", repositories: ["chaoss/8Knot", "chaoss/CollectOSS"] });
    const localCollect = await buildDashboardSnapshot("engcaiofonseca", { kind: "repository", repositoryId: "chaoss/CollectOSS" });
    const ids = new Set(localCollect.achievements.map((item: { id: string }) => item.id));
    expect(ids.has("realm-dual")).toBe(false);
    expect(ids.has("realm-triple")).toBe(false);
  });

  it("counts merged pull-request milestones across tracks", async () => {
    let docsTitle = true;
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const url = new URL(raw);
      if (url.pathname === "/users/engcaiofonseca") return jsonResponse({ login: "EngCaioFonseca", id: 999, name: "Eng", avatar_url: null });
      if (url.pathname === "/repos/chaoss/CollectOSS") return jsonResponse({ full_name: "chaoss/CollectOSS", name: "CollectOSS", owner: { login: "chaoss" }, html_url: "https://github.com/chaoss/CollectOSS", description: "CollectOSS" });
      if (url.pathname === "/repos/chaoss/CollectOSS/pulls") {
        return jsonResponse([
          { id: 1001, number: 11, title: `${docsTitle ? "Docs" : "Core"}: one`, html_url: "https://github.com/chaoss/CollectOSS/pull/11", state: "closed", merged_at: "2023-01-01T00:00:00Z", updated_at: "2023-01-01T00:00:00Z", user: { login: "engcaiofonseca", id: 1 } },
          { id: 1002, number: 12, title: "Docs: two", html_url: "https://github.com/chaoss/CollectOSS/pull/12", state: "closed", merged_at: "2023-01-02T00:00:00Z", updated_at: "2023-01-02T00:00:00Z", user: { login: "engcaiofonseca", id: 1 } },
          { id: 1003, number: 13, title: "Docs: three", html_url: "https://github.com/chaoss/CollectOSS/pull/13", state: "closed", merged_at: "2023-01-03T00:00:00Z", updated_at: "2023-01-03T00:00:00Z", user: { login: "engcaiofonseca", id: 1 } },
          { id: 1004, number: 14, title: "Docs: four", html_url: "https://github.com/chaoss/CollectOSS/pull/14", state: "closed", merged_at: "2023-01-04T00:00:00Z", updated_at: "2023-01-04T00:00:00Z", user: { login: "engcaiofonseca", id: 1 } },
        ]);
      }
      if (url.pathname.match(/\/repos\/chaoss\/CollectOSS\/pulls\/\d+\/reviews/)) {
        return jsonResponse([{ id: 5001, html_url: "https://github.com/chaoss/CollectOSS/pull/11#pullrequestreview-5001", state: "APPROVED", submitted_at: "2023-01-04T12:00:00Z", user: { login: "engcaiofonseca", id: 1 }, pull_request_url: "" }]);
      }
      if (url.pathname === "/repos/chaoss/CollectOSS/issues") return jsonResponse([]);
      return jsonResponse({ message: `unexpected ${url.pathname}` }, { status: 500 });
    }));
    const { syncFromGitHub, buildDashboardSnapshot } = await loadFresh();
    await syncFromGitHub({ username: "engcaiofonseca", repositories: ["chaoss/CollectOSS"] });
    const local = await buildDashboardSnapshot("engcaiofonseca", { kind: "repository", repositoryId: "chaoss/CollectOSS" });
    const forge = local.quests.find((quest: { id: string }) => quest.id === "quest-engineering-5");
    expect(forge?.progress).toBe(4);
    expect(local.progression.nextRankRequirement?.includes("Land 3 merged pull requests")).toBe(false);
  });

  it("updates stored evidence metadata on reimport without duplicating xp or resetting imported_at", async () => {
    let docsTitle = true;
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const url = new URL(raw);
      if (url.pathname === "/users/engcaiofonseca") return jsonResponse({ login: "EngCaioFonseca", id: 999, name: "Eng", avatar_url: null });
      if (url.pathname === "/repos/chaoss/CollectOSS") return jsonResponse({ full_name: "chaoss/CollectOSS", name: "CollectOSS", owner: { login: "chaoss" }, html_url: "https://github.com/chaoss/CollectOSS", description: "CollectOSS" });
      if (url.pathname === "/repos/chaoss/CollectOSS/pulls") {
        return jsonResponse([
          { id: 1001, number: 11, title: docsTitle ? "Docs: setup" : "Core setup", html_url: "https://github.com/chaoss/CollectOSS/pull/11", state: "closed", merged_at: "2023-01-01T00:00:00Z", updated_at: docsTitle ? "2023-01-01T00:00:00Z" : "2030-01-01T00:00:00Z", user: { login: "engcaiofonseca", id: 1 } },
        ]);
      }
      if (url.pathname === "/repos/chaoss/CollectOSS/pulls/11/reviews") return jsonResponse([]);
      if (url.pathname === "/repos/chaoss/CollectOSS/issues") return jsonResponse([]);
      return jsonResponse({ message: `unexpected ${url.pathname}` }, { status: 500 });
    }));
    const { syncFromGitHub, readEvidenceRow } = await loadFresh();
    const first = await syncFromGitHub({ username: "engcaiofonseca", repositories: ["chaoss/CollectOSS"] });
    const row1 = readEvidenceRow("gh:pr:chaoss/collectoss:11");
    expect(first.imported).toBe(1);
    expect(row1?.track).toBe("documentation");
    docsTitle = false;
    const second = await syncFromGitHub({ username: "engcaiofonseca", repositories: ["chaoss/CollectOSS"] });
    const row2 = readEvidenceRow("gh:pr:chaoss/collectoss:11");
    expect(second.imported).toBe(0);
    expect(second.unchanged).toBeGreaterThan(0);
    expect(row2?.track).toBe("engineering");
    expect(row2?.imported_at).toBe(row1?.imported_at);
    expect(second.dashboard.evidence.length).toBe(1);
  });

  it("persists self-reported mage preference per contributor with no xp/rank drift", async () => {
    const { syncFromGitHub, buildDashboardSnapshot, updateClassPreference, readClassPreference } = await loadFresh();
    await syncFromGitHub({ username: "engcaiofonseca", repositories: ["chaoss/CollectOSS"] });
    const before = await buildDashboardSnapshot("engcaiofonseca", { kind: "global" });
    updateClassPreference("engcaiofonseca", {
      isAiEngineer: false,
      aiToolUsage: "frequent",
      mageQuiz: { workflow: "multi_agent", engineering: "integrating", verification: "automated_tests" },
    });
    const after = await buildDashboardSnapshot("engcaiofonseca", { kind: "global" });
    expect(readClassPreference("engcaiofonseca").aiToolUsage).toBe("frequent");
    expect(after.profile.title).toBe(before.profile.title);
    expect(after.profile.displayTitle).toBe(`${before.profile.title} · Mage — Orchestrator`);
    expect(after.progression).toEqual(before.progression);
    expect(after.classPreference.mageActive).toBe(true);
    expect(after.classPreference.magePath?.id).toBe("orchestrator");
  });

  it("keeps class preference consistent across scopes and share output", async () => {
    const { syncFromGitHub, buildDashboardSnapshot, buildShareSvg, updateClassPreference } = await loadFresh();
    await syncFromGitHub({ username: "engcaiofonseca", repositories: ["chaoss/8Knot", "chaoss/CollectOSS"] });
    updateClassPreference("engcaiofonseca", { isAiEngineer: true, aiToolUsage: "none", mageQuiz: null });
    const global = await buildDashboardSnapshot("engcaiofonseca", { kind: "global" });
    const local = await buildDashboardSnapshot("engcaiofonseca", { kind: "repository", repositoryId: "chaoss/CollectOSS" });
    const svg = await buildShareSvg({ kind: "repository", repositoryId: "chaoss/CollectOSS" });
    expect(global.classPreference.mageActive).toBe(true);
    expect(local.classPreference.mageActive).toBe(true);
    expect(global.profile.displayTitle.endsWith(" · Mage")).toBe(true);
    expect(local.profile.displayTitle.endsWith(" · Mage")).toBe(true);
    expect(svg).toContain("· Mage");
  });

  it("persists class preference across module reloads (restart-like)", async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "repoquest-class-pref-persist-")), "repoquest.sqlite");
    const first = await loadFresh({ dbPath });
    await first.syncFromGitHub({ username: "engcaiofonseca", repositories: ["chaoss/CollectOSS"] });
    first.updateClassPreference("engcaiofonseca", { isAiEngineer: false, aiToolUsage: "ai_first", mageQuiz: null });

    const second = await loadFresh({ dbPath });
    const dashboard = await second.buildDashboardSnapshot("engcaiofonseca", { kind: "global" });
    expect(dashboard.classPreference.aiToolUsage).toBe("ai_first");
    expect(dashboard.classPreference.mageActive).toBe(true);
    expect(dashboard.profile.displayTitle.endsWith(" · Mage")).toBe(true);
  });

  it("uses a fictional demo identity when no contributor is synced", async () => {
    const { buildDashboardSnapshot } = await loadFresh();
    const demo = await buildDashboardSnapshot(undefined, { kind: "global" });
    expect(demo.source).toBe("demo");
    expect(demo.profile.username).toBe("demo-adventurer");
    expect(demo.profile.displayTitle).toBe(demo.profile.title);
  });
});

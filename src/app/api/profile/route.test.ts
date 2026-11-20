import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

async function loadModules() {
  vi.resetModules();
  const tempDir = mkdtempSync(join(tmpdir(), "repoquest-profile-route-test-"));
  process.env.DATABASE_PATH = join(tempDir, "route.sqlite");
  delete process.env.REPOQUEST_DB_PATH;
  process.env.GITHUB_TOKEN = "test-token-never-exported";
  const route = await import("./route");
  const repository = await import("@/lib/server/repository");
  return { route, repository };
}

describe("profile preference route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects untrusted host/origin and non-json payload", async () => {
    const { route } = await loadModules();
    const badHost = await route.PATCH(new Request("http://attacker.test:3111/api/profile", {
      method: "PATCH",
      headers: { host: "attacker.test:3111", origin: "http://attacker.test:3111", "content-type": "application/json" },
      body: JSON.stringify({ username: "engcaiofonseca", preference: { isAiEngineer: false, aiToolUsage: "none" } }),
    }));
    expect(badHost.status).toBe(403);

    const badOrigin = await route.PATCH(new Request("http://localhost:3111/api/profile", {
      method: "PATCH",
      headers: { host: "localhost:3111", origin: "null", "content-type": "application/json" },
      body: JSON.stringify({ username: "engcaiofonseca", preference: { isAiEngineer: false, aiToolUsage: "none" } }),
    }));
    expect(badOrigin.status).toBe(403);

    const badType = await route.PATCH(new Request("http://localhost:3111/api/profile", {
      method: "PATCH",
      headers: { host: "localhost:3111", "content-type": "text/plain" },
      body: "{}",
    }));
    expect(badType.status).toBe(415);
  });

  it("validates payload schema strictly", async () => {
    const { route } = await loadModules();
    const invalidEnum = await route.PATCH(new Request("http://localhost:3111/api/profile", {
      method: "PATCH",
      headers: { host: "localhost:3111", "content-type": "application/json" },
      body: JSON.stringify({ username: "engcaiofonseca", preference: { isAiEngineer: false, aiToolUsage: "always" } }),
    }));
    expect(invalidEnum.status).toBe(400);

    const extraKey = await route.PATCH(new Request("http://localhost:3111/api/profile", {
      method: "PATCH",
      headers: { host: "localhost:3111", "content-type": "application/json" },
      body: JSON.stringify({ username: "engcaiofonseca", preference: { isAiEngineer: false, aiToolUsage: "none", extra: true } }),
    }));
    expect(extraKey.status).toBe(400);

    const partialQuiz = await route.PATCH(new Request("http://localhost:3111/api/profile", {
      method: "PATCH",
      headers: { host: "localhost:3111", "content-type": "application/json" },
      body: JSON.stringify({ username: "engcaiofonseca", preference: { isAiEngineer: false, aiToolUsage: "none", mageQuiz: { workflow: "multi_agent" } } }),
    }));
    expect(partialQuiz.status).toBe(400);
  });

  it("requires active contributor identity and prevents stale updates", async () => {
    const { route, repository } = await loadModules();
    repository.saveProfile({ username: "engcaiofonseca", displayName: "Eng", avatarUrl: null });
    repository.upsertSyncState("otheruser", null, [], []);
    const stale = await route.PATCH(new Request("http://localhost:3111/api/profile", {
      method: "PATCH",
      headers: { host: "localhost:3111", "content-type": "application/json" },
      body: JSON.stringify({ username: "engcaiofonseca", preference: { isAiEngineer: true, aiToolUsage: "frequent" } }),
    }));
    expect(stale.status).toBe(409);
  });

  it("updates only active contributor preference and keeps users isolated", async () => {
    const { route, repository } = await loadModules();
    repository.saveProfile({ username: "engcaiofonseca", displayName: "Eng", avatarUrl: null });
    repository.saveProfile({ username: "otheruser", displayName: "Other", avatarUrl: null });
    repository.upsertSyncState("engcaiofonseca", null, [], []);

    const response = await route.PATCH(new Request("http://localhost:3111/api/profile", {
      method: "PATCH",
      headers: { host: "localhost:3111", "content-type": "application/json" },
      body: JSON.stringify({ username: "engcaiofonseca", preference: { isAiEngineer: false, aiToolUsage: "occasional" } }),
    }));
    expect(response.status).toBe(200);
    const payload = await response.json() as { username: string; preference: { mageActive: boolean } };
    expect(payload.username).toBe("engcaiofonseca");
    expect(payload.preference.mageActive).toBe(true);

    const eng = repository.readClassPreference("engcaiofonseca");
    const other = repository.readClassPreference("otheruser");
    expect(eng.aiToolUsage).toBe("occasional");
    expect(other.aiToolUsage).toBe("unspecified");
  });

  it("preserves quiz when omitted and clears quiz when explicit null", async () => {
    const { route, repository } = await loadModules();
    repository.saveProfile({ username: "engcaiofonseca", displayName: "Eng", avatarUrl: null });
    repository.upsertSyncState("engcaiofonseca", null, [], []);

    const setQuiz = await route.PATCH(new Request("http://localhost:3111/api/profile", {
      method: "PATCH",
      headers: { host: "localhost:3111", "content-type": "application/json" },
      body: JSON.stringify({
        username: "engcaiofonseca",
        preference: {
          isAiEngineer: false,
          aiToolUsage: "frequent",
          mageQuiz: { workflow: "multi_agent", engineering: "integrating", verification: "automated_tests" },
        },
      }),
    }));
    expect(setQuiz.status).toBe(200);
    expect(repository.readClassPreference("engcaiofonseca").mageQuiz?.workflow).toBe("multi_agent");

    const omitQuiz = await route.PATCH(new Request("http://localhost:3111/api/profile", {
      method: "PATCH",
      headers: { host: "localhost:3111", "content-type": "application/json" },
      body: JSON.stringify({
        username: "engcaiofonseca",
        preference: { isAiEngineer: true, aiToolUsage: "none" },
      }),
    }));
    expect(omitQuiz.status).toBe(200);
    expect(repository.readClassPreference("engcaiofonseca").mageQuiz?.workflow).toBe("multi_agent");

    const clearQuiz = await route.PATCH(new Request("http://localhost:3111/api/profile", {
      method: "PATCH",
      headers: { host: "localhost:3111", "content-type": "application/json" },
      body: JSON.stringify({
        username: "engcaiofonseca",
        preference: { isAiEngineer: true, aiToolUsage: "none", mageQuiz: null },
      }),
    }));
    expect(clearQuiz.status).toBe(200);
    expect(repository.readClassPreference("engcaiofonseca").mageQuiz).toBeNull();
  });
});

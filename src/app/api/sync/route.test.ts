import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

async function loadRoute() {
  vi.resetModules();
  const tempDir = mkdtempSync(join(tmpdir(), "repoquest-route-test-"));
  process.env.DATABASE_PATH = join(tempDir, "route.sqlite");
  delete process.env.REPOQUEST_DB_PATH;
  process.env.GITHUB_TOKEN = "test-token-never-exported";
  return await import("./route");
}

describe("sync route protections", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects non-json content type", async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request("http://localhost:3111/api/sync", {
      method: "POST",
      headers: { "content-type": "text/plain", host: "localhost:3111" },
      body: "{}",
    }));
    expect(response.status).toBe(415);
  });

  it("rejects cross-origin requests", async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request("http://localhost:3111/api/sync", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://evil.example",
        host: "localhost:3111",
      },
      body: JSON.stringify({ username: "engcaiofonseca", repositories: ["chaoss/8knot"] }),
    }));
    expect(response.status).toBe(403);
  });

  it("rejects null or malformed origin and untrusted host", async () => {
    const { POST } = await loadRoute();
    const nullOrigin = await POST(new Request("http://localhost:3111/api/sync", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "null",
        host: "localhost:3111",
      },
      body: JSON.stringify({ username: "engcaiofonseca", repositories: ["chaoss/8knot"] }),
    }));
    expect(nullOrigin.status).toBe(403);

    const malformed = await POST(new Request("http://localhost:3111/api/sync", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "::::",
        host: "localhost:3111",
      },
      body: JSON.stringify({ username: "engcaiofonseca", repositories: ["chaoss/8knot"] }),
    }));
    expect(malformed.status).toBe(403);

    const rebind = await POST(new Request("http://attacker.test:3111/api/sync", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://attacker.test:3111",
        host: "attacker.test:3111",
      },
      body: JSON.stringify({ username: "engcaiofonseca", repositories: ["chaoss/8knot"] }),
    }));
    expect(rebind.status).toBe(403);
  });
});

import { existsSync, mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

function runScript(
  script: string,
  env: NodeJS.ProcessEnv,
): Promise<{ code: number | null; stderr: string; stdout: string; durationMs: number }> {
  return new Promise((resolvePromise) => {
    const started = Date.now();
    const child = spawn(
      process.execPath,
      [
        "--conditions=react-server",
        "--input-type=module",
        "-e",
        script,
      ],
      {
        env,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stderr = "";
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("close", (code) => resolvePromise({ code, stderr, stdout, durationMs: Date.now() - started }));
  });
}

function envWithPaths(databasePath: string, legacyPath: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DATABASE_PATH: databasePath,
    REPOQUEST_DB_PATH: legacyPath,
  };
}

function importModuleScript(modulePath: string): string {
  return `import("file://${modulePath}").then(() => process.exit(0)).catch((error) => { console.error(error?.stack ?? String(error)); process.exit(1); });`;
}

function importAndOpenDbScript(modulePath: string): string {
  return `
    import("file://${modulePath}")
      .then((mod) => {
        mod.database().prepare("SELECT 1").get();
        process.exit(0);
      })
      .catch((error) => {
        console.error(error?.stack ?? String(error));
        process.exit(1);
      });
  `;
}

describe("database bootstrap", () => {
  it("does not initialize DB during route-module import, even while DB is externally locked", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "repoquest-db-route-import-"));
    const databasePath = join(tempDir, "repoquest.sqlite");
    const legacyPath = join(tempDir, "legacy-ignored.sqlite");
    process.env.DATABASE_PATH = databasePath;
    process.env.REPOQUEST_DB_PATH = legacyPath;
    vi.resetModules();

    const lockDb = new DatabaseSync(databasePath);
    lockDb.exec("BEGIN EXCLUSIVE");
    const started = Date.now();
    await import("../../app/api/dashboard/route");
    const durationMs = Date.now() - started;
    lockDb.exec("ROLLBACK");
    lockDb.close();

    expect(durationMs).toBeLessThan(3000);
  });

  it("initializes schema lazily on first runtime database() call and preserves existing data", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "repoquest-db-lazy-runtime-"));
    const databasePath = join(tempDir, "repoquest.sqlite");
    const legacyPath = join(tempDir, "legacy-ignored.sqlite");
    const dbModulePath = resolve(process.cwd(), "src/lib/server/db.ts");

    expect(existsSync(databasePath)).toBe(false);
    const importedOnly = await runScript(importModuleScript(dbModulePath), envWithPaths(databasePath, legacyPath));
    expect(importedOnly.code).toBe(0);
    expect(existsSync(databasePath)).toBe(false);

    const setup = new DatabaseSync(databasePath);
    setup.exec(`
      CREATE TABLE profiles (
        username TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        avatar_url TEXT,
        updated_at TEXT NOT NULL
      );
      INSERT INTO profiles (username, display_name, avatar_url, updated_at)
      VALUES ('existing-user', 'Existing User', NULL, '2000-01-01T00:00:00.000Z');
    `);
    setup.close();

    const runtimeInit = await runScript(importAndOpenDbScript(dbModulePath), envWithPaths(databasePath, legacyPath));
    expect(runtimeInit.code).toBe(0);
    expect(runtimeInit.stderr).toBe("");

    const verify = new DatabaseSync(databasePath);
    const existing = verify
      .prepare("SELECT display_name AS displayName FROM profiles WHERE username = ?")
      .get("existing-user") as { displayName: string } | undefined;
    const syncColumns = verify.prepare("PRAGMA table_info(sync_state)").all() as Array<{ name: string }>;
    verify.close();
    expect(existing?.displayName).toBe("Existing User");
    expect(syncColumns.some((column) => column.name === "selected_repositories_json")).toBe(true);
  });

  it("initializes a fresh file from concurrent runtime calls without lock errors", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "repoquest-db-concurrent-"));
    const databasePath = join(tempDir, "repoquest.sqlite");
    const legacyPath = join(tempDir, "legacy-ignored.sqlite");
    const dbModulePath = resolve(process.cwd(), "src/lib/server/db.ts");

    const results = await Promise.all(
      Array.from({ length: 8 }, () => runScript(importAndOpenDbScript(dbModulePath), envWithPaths(databasePath, legacyPath))),
    );
    for (const result of results) {
      expect(result.code).toBe(0);
      expect(result.stderr).not.toMatch(/database is locked/i);
    }

    const db = new DatabaseSync(databasePath);
    const columns = db.prepare("PRAGMA table_info(sync_state)").all() as Array<{ name: string }>;
    const profileColumns = db.prepare("PRAGMA table_info(profiles)").all() as Array<{ name: string }>;
    db.close();
    expect(columns.some((column) => column.name === "selected_repositories_json")).toBe(true);
    expect(profileColumns.some((column) => column.name === "is_ai_engineer")).toBe(true);
    expect(profileColumns.some((column) => column.name === "ai_tool_usage")).toBe(true);
    expect(profileColumns.some((column) => column.name === "mage_quiz_json")).toBe(true);
  });

  it("handles concurrent legacy sync_state migration idempotently", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "repoquest-db-legacy-"));
    const databasePath = join(tempDir, "repoquest.sqlite");
    const legacyPath = join(tempDir, "legacy-ignored.sqlite");
    const setup = new DatabaseSync(databasePath);
    setup.exec(`
      CREATE TABLE sync_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        username TEXT,
        last_synced_at TEXT,
        last_attempt_at TEXT,
        warnings_json TEXT NOT NULL DEFAULT '[]'
      );
    `);
    setup.close();

    const dbModulePath = resolve(process.cwd(), "src/lib/server/db.ts");
    const results = await Promise.all(
      Array.from({ length: 8 }, () => runScript(importAndOpenDbScript(dbModulePath), envWithPaths(databasePath, legacyPath))),
    );
    for (const result of results) {
      expect(result.code).toBe(0);
      expect(result.stderr).not.toMatch(/duplicate column name/i);
      expect(result.stderr).not.toMatch(/database is locked/i);
    }

    const db = new DatabaseSync(databasePath);
    const columns = db.prepare("PRAGMA table_info(sync_state)").all() as Array<{ name: string }>;
    const profileColumns = db.prepare("PRAGMA table_info(profiles)").all() as Array<{ name: string }>;
    db.close();
    expect(columns.some((column) => column.name === "selected_repositories_json")).toBe(true);
    expect(profileColumns.some((column) => column.name === "is_ai_engineer")).toBe(true);
    expect(profileColumns.some((column) => column.name === "ai_tool_usage")).toBe(true);
    expect(profileColumns.some((column) => column.name === "mage_quiz_json")).toBe(true);
  });
});

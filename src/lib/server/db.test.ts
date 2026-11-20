import { mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

function runDbInit(modulePath: string, databasePath: string, legacyPath: string): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolvePromise) => {
    const child = spawn(
      process.execPath,
      [
        "--conditions=react-server",
        "--input-type=module",
        "-e",
        `import("file://${modulePath}").then(() => process.exit(0)).catch((error) => { console.error(error?.stack ?? String(error)); process.exit(1); });`,
      ],
      {
        env: {
          ...process.env,
          DATABASE_PATH: databasePath,
          REPOQUEST_DB_PATH: legacyPath,
        },
        stdio: ["ignore", "ignore", "pipe"],
      },
    );
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("close", (code) => resolvePromise({ code, stderr }));
  });
}

describe("database bootstrap", () => {
  it("initializes a fresh file from concurrent processes without lock errors", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "repoquest-db-concurrent-"));
    const databasePath = join(tempDir, "repoquest.sqlite");
    const legacyPath = join(tempDir, "legacy-ignored.sqlite");
    const modulePath = resolve(process.cwd(), "src/lib/server/db.ts");

    const results = await Promise.all(
      Array.from({ length: 8 }, () => runDbInit(modulePath, databasePath, legacyPath)),
    );
    for (const result of results) {
      expect(result.code).toBe(0);
      expect(result.stderr).not.toMatch(/database is locked/i);
    }

    const db = new DatabaseSync(databasePath);
    const columns = db.prepare("PRAGMA table_info(sync_state)").all() as Array<{ name: string }>;
    db.close();
    expect(columns.some((column) => column.name === "selected_repositories_json")).toBe(true);
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

    const modulePath = resolve(process.cwd(), "src/lib/server/db.ts");
    const results = await Promise.all(
      Array.from({ length: 8 }, () => runDbInit(modulePath, databasePath, legacyPath)),
    );
    for (const result of results) {
      expect(result.code).toBe(0);
      expect(result.stderr).not.toMatch(/duplicate column name/i);
      expect(result.stderr).not.toMatch(/database is locked/i);
    }

    const db = new DatabaseSync(databasePath);
    const columns = db.prepare("PRAGMA table_info(sync_state)").all() as Array<{ name: string }>;
    db.close();
    expect(columns.some((column) => column.name === "selected_repositories_json")).toBe(true);
  });
});

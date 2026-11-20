# Independent packaging gate — 2026-11-20

## Final result: Node packaging PASS; Docker acceptance NOT RUN

A pre-fix clean production build exposed
`ERR_SQLITE_ERROR: database is locked`. After the backend's concurrency fix, a
fresh clean build and the final standalone runtime/persistence smoke both
**passed**. The failed attempt is retained below as evidence.
Docker/container acceptance is **not run**, because the daemon is unavailable
and Compose is absent. This gate approves the measured Node packaging snapshot,
not untested container deployment or overall release.

Skills applied: existing `karpathy-skills` and `codebase-design` guidance for
bounded changes, module initialization review, and measured claims; the loaded
Orca orchestration guide governs coordination. No helper agents were launched.

## Source snapshot and isolation

- Source: `/Users/cfonseca/Documents/GitHub/repoquest`.
- Git HEAD: `cf25c632dce584c894a420a7d9945461bdd3c3a1`. The implementation is largely
  untracked/uncommitted; this was a filesystem copy, **not** `git archive`.
- Initial copy: **2026-11-20 16:39:36.170738–16:39:36.970472 UTC**, 56 files.
- Latest progression metadata and its tests were refreshed at **16:40:13.385839
  UTC**, before the first production build.
- The final UI evidence disclosure and navigation target-size changes in
  `src/components/Sections.tsx` and `src/app/globals.css` were refreshed at
  **16:41:42.157341 UTC**, after the first build completed.
- Disposable root (`GATE` below):
  `/private/var/folders/18/h5j8yr7143s1k99dktd_kyz00000gn/T/opencode/repoquest-packaging-aro2mmqz`.
- Source copy: `$GATE/source`.
- Pre-fix per-file source hashes: `$GATE/snapshot-failed-manifest.json`.
- Manifest SHA-256 for the failing pre-fix snapshot:
  `b7da85ed720891e9cc12bad060cc04d18302061fc361e98f56b00c500324aafb`.
- Post-fix refresh of the complete current source:
  **2026-11-20 16:45:04.996154–16:45:05.394797 UTC**, 58 files.
  Includes final UI guide/accessibility edits, `db.ts`, and `db.test.ts`.
- Final manifest: `$GATE/snapshot-manifest.json`, SHA-256
  `62f1698c47f8447e5eac164baa846ad62b519445f2642d92a6e45e773ec92ad5`.
- At **16:45:33.340972 UTC**, every recorded source hash still matched the
  checkout; `$GATE/source-drift-final.json` records no differences.
  Subsequent edits to this report only update gate evidence.

Excluded: `node_modules`, `.next`, root `data`, `.repoquest`, `.factory`, `.git`,
`.opencode`, `.env*` other than `.env.example`, SQLite/database files and sidecars,
and TypeScript incremental output. Source-file hashes were checked during copying.
The snapshot includes untracked application files and `/about`.

Every install/build/runtime command removed `GITHUB_TOKEN` and
`REPOQUEST_DB_PATH` from its child environment and supplied an isolated
`DATABASE_PATH`. No live database was opened, copied, migrated, reset, or synced.
The user preview and its `.next` output were untouched. The only removed build
directory was `$GATE/source/.next`, before the final clean build.

## Commands and measured results

All npm commands ran from `$GATE/source`. Runtime verification reported
**Node v24.22.3, npm 11.20.0**, on macOS arm64.

### Clean dependency installation — PASS

```sh
env -u GITHUB_TOKEN -u REPOQUEST_DB_PATH \
  DATABASE_PATH="$GATE/runtime/repoquest.db" NEXT_TELEMETRY_DISABLED=1 \
  npx --yes --package=node@24.22.3 --package=npm@11.20.0 npm ci
```

Exit 0: added 62 packages, audited 63, zero reported vulnerabilities.
npm emitted a non-fatal warning about an unapproved optional
`fsevents@2.3.3` install script. An earlier invocation was interrupted by an
incoming coordinator message before producing output; its process was confirmed
stopped before the successful invocation.

### Initial clean production build — PASS

```sh
env -u GITHUB_TOKEN -u REPOQUEST_DB_PATH \
  DATABASE_PATH="$GATE/runtime/repoquest.db" NEXT_TELEMETRY_DISABLED=1 \
  npx --yes --package=node@24.22.3 --package=npm@11.20.0 npm run build
```

Exit 0. Next 16.4.6 compiled and typechecked; static routes `/` and `/_not-found`
and dynamic routes `/about`, `/api/dashboard`, `/api/share`, `/api/sync` were
emitted. This snapshot already included the final progression metadata edits;
the two later UI edits were not yet included.

### Standalone runtime smoke — PASS on the initial build

Copied `.next/static` and `public` into `.next/standalone` using the Dockerfile's
runtime asset layout, then ran:

```sh
env -u GITHUB_TOKEN -u REPOQUEST_DB_PATH \
  DATABASE_PATH="$GATE/runtime/repoquest.db" NEXT_TELEMETRY_DISABLED=1 \
  npx --yes --package=node@24.22.3 node "$GATE/standalone-smoke.mjs"
xmllint --noout "$GATE/demo-share.svg"
```

The isolated runner started owned server processes on dynamically allocated
loopback ports and terminated only those processes. Checks at
**16:41:12.989–16:41:13.983 UTC** passed:

- `/`, `/about`, `/api/dashboard`, and `/api/share` returned 200.
- Dashboard was explicitly global demo, with `liveSyncAvailable: false`.
- Share was `image/svg+xml`, labelled demo, and well-formed XML.
- A direct sentinel inserted into a separate `packaging_gate_probe` table in the
  isolated database survived a standalone process restart; demo still loaded.

Initial evidence was preserved as `$GATE/initial-standalone-results.json`,
`$GATE/initial-standalone-server.log`, and `$GATE/initial-demo-share.svg`;
the reusable runner is `$GATE/standalone-smoke.mjs`.
This is **Node standalone persistence evidence**, not
Docker volume verification.

### Pre-fix final clean production build — FAIL

After refreshing the two UI files and deleting only the disposable `.next`,
the build used a different, fresh database:

```sh
env -u GITHUB_TOKEN -u REPOQUEST_DB_PATH \
  DATABASE_PATH="$GATE/runtime-final/repoquest.db" NEXT_TELEMETRY_DISABLED=1 \
  npx --yes --package=node@24.22.3 --package=npm@11.20.0 npm run build
```

Exit 1. Compilation and TypeScript passed; failure occurred during
`Collecting page data using 8 workers`:

```text
Error: Failed to collect configuration for /api/sync
  [cause]: Error: database is locked
      at module evaluation (src/lib/server/db.ts:23:4)
      at module evaluation (src/lib/server/dashboard.ts:3:1)
      at module evaluation (src/lib/server/sync.ts:3:1)
    21 | const db = new DatabaseSync(DB_PATH);
    22 |
  > 23 | db.exec(`
    24 |   PRAGMA journal_mode = WAL;
    25 |   PRAGMA foreign_keys = ON;
    code: 'ERR_SQLITE_ERROR',
    errcode: 5,
    errstr: 'database is locked'
> Build error occurred
Error: Failed to collect page data for /api/sync
```

The observed failure is in the eager database initialization batch when multiple
Next build workers import the server modules. The precise statement within the
WAL/schema batch was not identified; a separate schema-migration failure was not
observed. The first successful build does not negate this fresh-database race.
No retry against the now-initialized file was used to claim a pass.

### Post-fix clean production build — PASS

The backend added a 5000 ms connection timeout before executing schema SQL and
handled only duplicate-column contention during the idempotent migration.
Code inspection confirmed these changes. The coordinator separately reported
passing multiprocess fresh-database and legacy-schema regressions; those tests
were not redundantly rerun here.

Refreshed the complete source, removed only `$GATE/source/.next`, and verified
that package and lockfile hashes were unchanged. The earlier clean `npm ci`
installation was reused. A **third, fresh** isolated database was supplied:

```sh
env -u GITHUB_TOKEN -u REPOQUEST_DB_PATH \
  DATABASE_PATH="$GATE/runtime-fixed/repoquest.db" NEXT_TELEMETRY_DISABLED=1 \
  npx --yes --package=node@24.22.3 --package=npm@11.20.0 npm run build
```

Exit 0: compilation, TypeScript, page-data collection with eight workers, static
generation, and finalization all passed. Routes emitted:

```text
○ /
○ /_not-found
ƒ /about
ƒ /api/dashboard
ƒ /api/share
ƒ /api/sync
```

### Post-fix standalone smoke and persistence — PASS

Prepared the fresh standalone asset layout and executed:

```sh
env -u GITHUB_TOKEN -u REPOQUEST_DB_PATH \
  DATABASE_PATH="$GATE/runtime-fixed/repoquest.db" NEXT_TELEMETRY_DISABLED=1 \
  npx --yes --package=node@24.22.3 node "$GATE/standalone-smoke.mjs"
xmllint --noout "$GATE/demo-share.svg"
```

Both commands exited 0. At **16:45:25.007–16:45:25.879 UTC**, the final bundle:

- Returned 200 for `/`, `/about`, `/api/dashboard`, and `/api/share`.
- Returned explicit global demo data with live sync unavailable.
- Served a demo-labelled, well-formed SVG with the correct media type.
- Preserved the isolated SQLite sentinel across termination and recreation of
  its owned standalone process; dashboard remained demo.

Final runtime evidence is `$GATE/standalone-results.json`,
`$GATE/standalone-server.log`, and `$GATE/demo-share.svg`.
Both test server processes were terminated. No user preview process was touched.

### Docker/Compose — NOT RUN

`docker version` exited 1. Docker client **28.1.1** is present, but its `colima`
context cannot connect to
`unix:///Users/cfonseca/.colima/default/docker.sock`.

`docker compose version` exited 1: `docker: unknown command: docker compose`.

No OS application or daemon was started. No test containers or volumes were
created. Image building, non-root runtime permissions, and container-recreation
volume persistence remain unverified.

## Follow-up and stack-document corrections for the lead

1. The fresh-database build failure is resolved for the final measured snapshot.
   Failure and successful post-fix commands are retained above.
2. `docs/STACK.md` can report the latest integrated clean production build,
   standalone demo/API/about/SVG smoke, and isolated process-restart persistence
   as passed on Node 24.22.3; the previous pending-production-build statement
   is now stale.
3. Docker/Compose runtime acceptance remains unavailable, independently of the
   Node build result. The architect did not edit `STACK.md`.

No general test suite was redundantly rerun for this packaging gate.

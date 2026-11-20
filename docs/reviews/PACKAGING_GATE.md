# Independent packaging gate — 2026-11-20

## Current result: lazy-init build and Podman/Compose container gates PASS

The initial timeout-only fix passed a local build but still failed for the user
on published `393596a`. A deterministic held-lock reproduction below confirms
that failure. The subsequent lazy-initialization fix passes the same locked
build, a clean build that creates no database artifacts, and the actual
no-cache Dockerfile build through the running Podman/Compose provider.
Non-root startup, demo/scoped APIs, SVG, and named-volume persistence across
container recreation all pass. See the latest verification section below for
the exact fixed source hashes.

**Correction to earlier runtime discovery:** `docker compose` was unavailable,
but `/opt/homebrew/bin/docker-compose` exists and `podman compose` invokes it.
Docker's selected Colima endpoint is unavailable; Podman's running service is
available. The earlier blanket “Compose absent/container unavailable” conclusion
was incomplete. Native Docker Engine and other architectures were not tested;
the container gate below ran on Podman, Linux arm64.

Skills applied: `diagnosing-bugs` for deterministic old-red/new-green reproduction,
plus existing `karpathy-skills` and `codebase-design` guidance for
bounded changes, module initialization review, and measured claims; the loaded
Orca orchestration guide governs coordination. No helper agents were launched.

## Earlier local gate: source snapshot and isolation

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

### Earlier Docker/Compose discovery — incomplete, superseded below

`docker version` exited 1. Docker client **28.1.1** is present, but its `colima`
context cannot connect to
`unix:///Users/cfonseca/.colima/default/docker.sock`.

`docker compose version` exited 1: `docker: unknown command: docker compose`.

No OS application or daemon was started during this earlier pass. No containers
or volumes were created then. The missing plugin was incorrectly generalized
to missing standalone Compose/runtime availability.

## Earlier follow-up conclusions — superseded by published reproduction

The timeout-only snapshot passed the measured local tests above. That evidence
did not establish that build-time database initialization was safe: the user
subsequently reproduced the same lock error in the published image build.
The controlled reproduction and stronger container gate below replace that
earlier readiness conclusion.

No general test suite was redundantly rerun for this packaging gate.

## Published-container regression and lazy-init verification — 17:13–17:17 UTC

### Snapshot and isolation

New disposable root (`CGATE` in commands):
`/private/var/folders/18/h5j8yr7143s1k99dktd_kyz00000gn/T/opencode/repoquest-container-gate-qjra80s3`.

- Published base: `393596a4dbc65357acc38bb940becf72d7e0231c`.
- Published reproduction snapshot: 58 files at **17:13:44.214788 UTC**;
  `$CGATE/published-manifest.json` SHA-256
  `085a456fc67f8f87610b8ce4980afa4bcce69235cecf03e4c3b74279b2206366`.
- Fixed current-source snapshot: 58 files at
  **17:15:15.376299–17:15:15.758543 UTC**;
  `$CGATE/fixed-manifest.json` SHA-256
  `b6965fec1d661e4476ccbaf45b89c6b8f690bdb599876bd581e96e02e539d8d6`.
- Only implementation changes from the published snapshot were:
  - `src/lib/server/db.ts`:
    `2e1b06e0df1ad3ac4bf28b3beb56ac3eecd44f094957f741d9c4f1e6ed6edcde`
  - `src/lib/server/db.test.ts`:
    `e59ea1f7538ea452cb743326f5226029ca3e2bcb54bd81afedeec3de51490d9a`
- At **17:17:18.984454 UTC**, all source hashes still matched the checkout.
  Subsequent changes to this report only add these results.

The source-copy exclusions match the earlier gate: no credentials, local
databases, `.next`, dependencies, Git metadata, or local agent configuration.
Fresh `npm ci` in this copy passed with zero audit vulnerabilities.
No live preview, database, service, OS application, or Git branch was changed.

### Deterministic published-red / fixed-green build

`$CGATE/locked-build.py` creates a separate SQLite probe database and holds
`BEGIN IMMEDIATE` throughout a full production build. It removes both credential
and legacy database environment variables, supplies only the probe
`DATABASE_PATH`, and captures the complete child output.

```sh
python3 "$CGATE/locked-build.py" --expect locked
# Refresh db.ts/db.test.ts from the confirmed fixed checkout; remove only copied .next.
python3 "$CGATE/locked-build.py" --expect success
```

- **Published red, 17:14:09–17:14:22 UTC:** the build exited 1 at page-data
  collection with `database is locked`, SQLite error code 5, at
  `db.ts:93 db.exec(SCHEMA_SQL)` despite the 5000 ms timeout. The observed route
  was `/api/sync`; the user's `/api/dashboard` failure reaches the same eager
  initializer. Compilation and TypeScript had passed.
- **Fixed green, 17:15:17–17:15:25 UTC:** after refreshing the two backend files
  and deleting copied `.next`, the same held-lock production build exited 0.
  The backend moved directory creation, opening, schema SQL, and migration into
  first-use `database()` initialization instead of module import.

Logs/results: `$CGATE/held-lock-locked-build.log`,
`held-lock-locked-result.json`, `held-lock-success-build.log`, and
`held-lock-success-result.json`. Published `db.ts` is retained as
`$CGATE/published-db.ts`. The reproduction harness itself exits 0 when the
explicit expected build outcome is observed; the child build exit codes above
are recorded separately.

A second clean fixed build, **17:15:48–17:15:56 UTC**, supplied an absent path:

```sh
env -u GITHUB_TOKEN -u REPOQUEST_DB_PATH \
  DATABASE_PATH="$CGATE/build-must-not-create/repoquest.sqlite" \
  NEXT_TELEMETRY_DISABLED=1 \
  npx --yes --package=node@24.22.3 --package=npm@11.20.0 npm run build
```

Exit 0; after the build, the configured database's parent directory, source
`data/`, and source `.repoquest/` were all still absent. This verifies no
filesystem database initialization during the production build, rather than
merely surviving a particular lock duration. All six application routes were
emitted. Evidence: `$CGATE/fresh-no-db-build.log` and `fresh-no-db-result.json`.

### Actual container tools and no-cache image build

Read-only discovery found:

- Standalone Docker Compose **2.35.1** at `/opt/homebrew/bin/docker-compose`.
- `podman compose version` explicitly delegates to that executable.
- Running Podman client **5.6.2**, server **5.4.1**, Linux arm64.
- Docker CLI **28.1.1** still points at an unavailable Colima socket.

The existing Podman service was used without changing connections or starting
any application/service. Compose rendered the isolated override successfully.
The override changes only the test image name, loopback ephemeral host port,
empty token, and restart policy; it retains the real Dockerfile and
`/app/data` volume arrangement.

```sh
env -u GITHUB_TOKEN -u REPOQUEST_DB_PATH \
  podman compose --project-name repoquest-gate-qjra80s3 \
  --file "$CGATE/source/compose.yaml" --file "$CGATE/compose.gate.yaml" \
  build --no-cache
```

**PASS**, exit 0, **17:16:04–17:16:54 UTC**. The build sent a 125.2 kB context,
ran `npm ci` with zero audit vulnerabilities, compiled/typechecked/generated all
routes in the actual image, and completed all three stages. The builder collected
page data with four workers.

Image: `localhost/repoquest-gate-qjra80s3:verify`, Linux arm64, configured user
`node`, ID
`ecc870bba2c0b34ff648b6a67e2b2a82e8ff56edf31633d34f02770482d5cb24`.
Evidence: `$CGATE/compose-build.log` and `compose-build-result.json`.

### Non-root runtime, scoped demo, and volume recreation

```sh
python3 "$CGATE/container-smoke.py"
xmllint --noout "$CGATE/container-demo-share.svg"
```

**PASS**, both commands exited 0, **17:16:58–17:17:03 UTC**. The harness uses
the same isolated Compose project and checks its ownership labels before acting.

- Runtime is **Node v24.22.3**, process **UID 1000**; volume directory owner is
  UID 1000 and `DATABASE_PATH=/app/data/repoquest.db`.
- No token is configured; the database file is absent before the first request.
- `/`, `/about`, global dashboard, `chaoss/8Knot` dashboard and matching scoped
  share all return 200. Snapshots explicitly identify demo and correct scope;
  the share is demo-labelled, repository-labelled, and valid SVG/XML.
- A synthetic sentinel is inserted directly into an isolated probe table.
  `compose up --detach --no-build --force-recreate` replaces the container
  while retaining the project's named volume. The new container has a distinct
  ID, still serves demo, and reads the original sentinel.
- First container:
  `b4ad7c6e743d181785dd800eb612b997d9a1281728e61d41dc418ea96b8a28de`.
- Replacement:
  `902215699aa42cabb80fae488d53c7a47aa8d0c5ca9d919dc31c96b18c0a76c4`.

Evidence: `$CGATE/container-smoke-results.json`,
`container-smoke-commands.json`, `container-smoke.py`, and
`container-demo-share.svg`.

Cleanup used only this project's `compose down --volumes`, exit 0. A subsequent
read-only check confirmed no project containers, named volume, or network remain.
The uniquely tagged test image was removed without pruning unrelated resources.
No GitHub sync was performed. Local disposable evidence remains for inspection.

### Current handoff

The earlier timeout-only build claim is superseded: the measured fix is lazy
runtime initialization, supported by old-red/new-green evidence and a real
Podman/standalone-Compose build plus non-root/volume smoke. The lead can inspect
and publish the two backend changes; this worker made no commit or push.
`STACK.md` should describe container verification as Podman/Compose Linux arm64,
not native Docker Engine, and should no longer claim Compose is absent.

# Backend and integration review: pass 1 (2026-11-20 16:10 GMT)

Reviewer: Claude Opus 5.5 (independent). Scope is read-only, except `docs/reviews/**`.
Tree state: uncommitted working tree. The backend was being edited during the review: `sync.ts`/`github.ts` changed at 16:07, and the findings below are against that version.
Skills applied: karpathy-guidelines (verifiable claims only, minimal scope); code-review/testing practice (severity, file:line, measured vs. read).

Constraints I respected: I started **no** sync against the live DB and ran **no** `next build`, because dev owns `.next`. I made only GET requests to the lead's dev server on `127.0.0.1:3111`. No token value appeared in any command or output: I grepped for token patterns and printed counts only.

## Measured evidence

| Check | Result |
|---|---|
| `env -u GITHUB_TOKEN npx vitest run` | **exit 0**: 3 files, 13 tests. Each sync test uses its own `mkdtemp` DB |
| `GET :3111/api/dashboard` | 200, `source: live`, user `engcaiofonseca`, level 13, rank B, 10 300 XP, 96 evidence items, all with actor `engcaiofonseca` |
| Live 8Knot coverage | `partial` / `api_limit`, `coveredThrough: null`, 62 eng + 3 doc merged PRs = **65**, matching the user's search baseline. 31 reviews |
| Live CollectOSS coverage | `complete`, 1 eng + 3 doc merged PRs = **4**, matching the baseline |
| Token patterns (`ghp_`, `github_pat_`, `gho_`, `ghs_`) in the dashboard JSON and the share SVG | **0** |
| `GET :3111/api/share` + `xmllint --noout` | 200 `image/svg+xml`, well-formed |
| `git check-ignore .repoquest/repoquest.sqlite` | **not ignored** |
| Pure `deriveProgression` probe (5 PRs dated 2020…2024) | `merge-vanguard` (target 5) `unlockedAt = 2020-01-01`. The expected date is 2024-01-01 |

## Lead-reported findings: verification

| Lead finding | Status at 16:07 | Evidence |
|---|---|---|
| The catch block discards emitted evidence but advances the checkpoint | **Fixed** | `sync.ts:243-252` now calls `persistEvidenceAndCoverage(…emitted…, failureCheckpoint)` in one transaction (`repository.ts:98-121`). Test `persists fetched evidence on mid-page failure…` passes |
| Closed-only PR listing misses reviews on open PRs | **Fixed** | `github.ts:131` uses `state=all`. The fixture asserts it |
| Moving `updated`-sorted page offsets skip evidence on resume | **Fixed for PRs only** | PRs now use `sort=created&direction=asc` (`github.ts:131`). **Issues still use `sort=updated&direction=desc` with page checkpoints** (`github.ts:143`, `sync.ts:216,240`). See B-6 |

## Findings (most severe first)

| # | Sev | Where | Finding | Reproduction / evidence | Suggested fix (owner) |
|---|---|---|---|---|---|
| B-1 | **Blocker** | `src/lib/server/db.ts:6-8` vs `.env.example:7`, `compose.yaml:8`, `Dockerfile:20`, README:74, ARCHITECTURE:106 | **The DB path env var doesn't match.** Code reads `REPOQUEST_DB_PATH`. Every document and the Docker config set `DATABASE_PATH`, which is ignored. In Docker the DB goes to `/app/.repoquest/` instead of the `/app/data` volume, so data is lost on container recreate (PER-3/DOC-3). `/app` is root-owned and the process runs as `node` (`Dockerfile:21,25`), so `mkdirSync` at `db.ts:10` will likely throw EACCES and every API route will 500 (PLAUSIBLE, Docker NOT RUN) | `grep -rn DATABASE_PATH\|REPOQUEST_DB_PATH` | Read `DATABASE_PATH` (keep the other as an alias if wanted), default to `./data/repoquest.db` (backend) |
| B-2 | **Blocker** (privacy) | `db.ts:8`, `.gitignore` | The default DB file `.repoquest/repoquest.sqlite` is **not git-ignored**. `.gitignore` covers `data/` and `*.db`, not `.sqlite` or `.repoquest/`. A contributor's local evidence DB can be committed by `git add -A` | `git check-ignore -v .repoquest/repoquest.sqlite` → no match | Fixing B-1 (default under `data/`) resolves it. Also ignore `*.sqlite*` (architect) |
| B-3 | **Major** | `src/lib/domain/progression.ts:247-250` | **Achievement unlock dates are wrong.** `unlockedAt` is the date of the *first* qualifying item, not the item that reached the target. This breaks the original-date / no-fabrication rule (HIS-9/HIS-10) | Probe above. Live: `merge-initiate`, `merge-vanguard` and `merge-architect` all show `2025-04-10T15:48:16Z`, and `history-epic` (75 items) shows the same date as the first PR | Use the `occurredAt` of the `target`-th qualifying item in date order. For distinct-count achievements (months, repos, tracks), use the item that completed the set (backend) |
| B-4 | **Major** | `src/lib/server/github.ts:147-151` | **PR track classification uses body keywords**, so PR templates and passing mentions mark engineering PRs as documentation (ATT-3, wrong XP and track) | Live doc-classified PRs include "CI: measure test coverage", "test: add a fake GitHub API so collector fixes are tested in CI" and "Remove unused Redis data cache" | Classify from changed file paths (`/pulls/{n}/files`: all paths `docs/**`, `*.md`, `README*`), or from the title/labels only. Version the rule (backend) |
| B-5 | **Major** | `src/lib/domain/progression.ts:271-273` | **Rank A is unreachable with the default 2-repository setup** (`repos < 3` → B). The user is capped at B. That makes rank depend on how many repos are selected rather than on milestone breadth (SCO-4), and the user's next-rank hint asks for a third repo they didn't choose | Live: rank B, `nextRankRequirement: "Reach 8 merged pull requests across 3 repositories for rank A."` with 65 merged PRs | Use track and milestone breadth for A/S. Make repo breadth an achievement, not a rank gate (backend; product call for lead) |
| B-6 | **Major** | `github.ts:143`, `sync.ts:206-241` | Issue backfill still paginates `sort=updated&direction=desc` with a saved `issuePage`. An issue updated between a pause and the resume moves to page 1 and is skipped (the same defect as lead finding #3) | Code read. There is no issue-resume test | `sort=created&direction=asc` for issues too (backend) |
| B-7 | **Major** | `sync.ts:108-112,256-271` | **A completed backfill regresses to partial on the next sync.** With no checkpoint, the next sync restarts at page 1 and rescans every PR, with one review request per PR, against a 220-request budget. 8Knot can't be rescanned in one sync, so a "complete" repo flips back to `partial`/provisional and `coveredThrough` goes stale. The 220 budget also means the first 8Knot backfill needs several manual syncs (it's still partial live) | Code read. Live 8Knot is `partial` after the lead's sync | After completion, do incremental syncs: PRs `sort=updated desc` until `updated_at < coveredThrough`, then stop. Don't reset the status to `in_progress`/`partial` during an incremental pass. Optionally find reviewed PRs with search `reviewed-by:` to cut the review fan-out (backend) |
| B-8 | **Major** (security) | `src/app/api/sync/route.ts:22-28` | **CSRF.** `request.json()` parses any body with no content-type or Origin check (VAL-8). Any web page the user visits can `fetch("http://127.0.0.1:3000/api/sync",{method:"POST",mode:"no-cors",body:'{"username":"x","repositories":["a/b"]}'})` as a CORS-simple `text/plain` request. That spends the server token and switches the active profile (`sync.ts:314`) to an attacker-chosen user | Code read. Not exercised against the live server, by instruction | Require `content-type: application/json` and that `Origin` is absent or equal to `Host`, else 403. Add a test (backend) |
| B-9 | **Major** | `sync.ts:84` (outside `try`), `sync.ts:299-309` | One unreachable or 404 repository makes the **whole sync fail**. `getRepository` throws before the per-repo `try`, so `syncFromGitHub` rejects, the route returns 403, already-synced repos' results are dropped from the response, and `sync_state` isn't updated (J4) | Code read | Catch per repo and record `failed` coverage for that slug. Continue the other repos and return `partial: true` (backend) |
| B-10 | **Major** | `github.ts:60-76` | Secondary rate limits (403 with `retry-after` and remaining ≠ 0) and 429 without a remaining header are reported as `permission_denied`/`provider_error`, and `retry-after` is ignored (GH-3). There is also no request timeout (GH-6): a hung socket hangs the sync route | Code read | Map 429 and 403+`retry-after` to `rate_limited` with `retryAt = now + retry-after`. Add `AbortSignal.timeout(…)` (backend) |
| B-11 | **Major** | `dashboard.ts:7,64-68`, `repository.ts:123-128` | **Selection isn't respected.** The snapshot shows evidence and coverage for every repository ever synced for the user, plus hardcoded default realms, whatever the current selection. Removing a repo from the selection doesn't remove its evidence or XP (HIS-8, ATT-9) | Code read | Persist the selected repository set in `sync_state`. Filter evidence, coverage and realms to it (backend) |
| B-12 | Minor | `sync.ts:82-106,283-314` | No concurrency guard. Two overlapping syncs read the same checkpoint, and the slower writer can move the checkpoint backwards (re-work, not loss, because of `INSERT OR IGNORE`). A crashed sync leaves `in_progress` showing until the next sync (ING-5) | Code read | Process-level mutex; return 409 when a sync is running (backend) |
| B-13 | Minor | `sync.ts:313`, UI banner | `lastSyncedAt` stays `null` while any repo is partial, even though CollectOSS completed. The live banner omits a sync time | Live `lastSyncedAt: null` | Use the max per-repo `lastSuccessfulSyncAt`, or label it "last full sync" (backend/UI) |
| B-14 | Minor | `sync.ts:84-94` | The repository's `private` flag isn't checked. With a token that can see private repos, private PR titles are stored and shown (SVG-9) | Code read | Reject `private: true` or mark it as a limitation (backend) |
| B-15 | Minor | `share-svg.ts:44`, `:3-10` | Demo cards say "Demo / self-reported". Demo data isn't self-reported, so say "Demo data (sample character)". `esc()` doesn't strip XML-invalid control characters (SVG-4) | Code read | Fix the wording and strip `[\u0000-\u0008\u000B\u000C\u000E-\u001F]` (backend) |
| B-16 | Minor | tests | Missing tests from the ACCEPTANCE §4 inventory: level boundaries at threshold±1, rank boundaries, issue resume, ≥3-page pagination, secondary rate limit, CSRF rejection, invalid repo inside a multi-repo sync, and the unlock date of the target-th item | `grep "it(" src/**/*.test.ts` | Add them alongside the fixes (backend) |

## Verified OK on code read or measurement

- Actor isolation: every evidence kind filters `isSameActor` on the actor login (`sync.ts:143,177,222`). Live evidence has a single actor. Evidence rows carry `username` and `imported_at` separately from `occurred_at` (`db.ts:51-65`), so E-4 is resolved.
- Idempotence: stable ids `gh:{pr|review|issue}:{repo}:{n}` (`sync.ts:69-71`) with a `PRIMARY KEY` and `INSERT OR IGNORE`. The repeat-sync test passes.
- Truthful mode: no username in `sync_state` gives labelled demo data. A failed sync after live data keeps `source: live` and stored evidence (`dashboard.ts:40-54`). 401 and 404 never fall back to demo.
- Tokens: read only in `github.ts:24-33` (a `server-only` module). Absent from the snapshot, the SVG and the DB schema. Error messages are fixed strings.
- SVG: `esc()` covers `& < > " '`, uses no external resources, has source marking, and is well-formed live.
- The UI snapshot findings U-1, U-3, U-4 and U-5 from ACCEPTANCE §7 are **fixed** in the current UI (`format.ts:1-10` uses `syncRequestSchema`; `ApiError.fields` is passed through; the dashboard refetches after a failed sync; the object URL is revoked after a delay).

## Addendum: re-check after the backend's checkpoint-versioning change (16:12)

The backend added versioned checkpoints (`version=1`, `pullOrder=created_asc_state_all_v1`). Unversioned checkpoints now force a restart from page 1. Re-measured: `vitest run` **exit 0, 14 tests**. B-1 (`db.ts:6-7` still `REPOQUEST_DB_PATH`), B-3 (`progression.ts` unlock lookup unchanged) and B-6 (`github.ts:143` issues still `sort=updated desc`) **remain open**. A restart from page 1 under the 220-request budget makes B-7 more visible: the live 8Knot backfill will need several more syncs.

## Release recommendation

**Do not release yet.** The live data is largely correct: merged-PR counts match the user's baseline (65 / 4) and attribution is clean, so it's fine to *show* the user their provisional dashboard now with the partial label it already carries. Before an MVP claim: fix B-1/B-2 (blockers), then B-3 to B-11. Not run: `npm ci`, `next build`, Docker, browser and a11y passes, and live sync behaviour beyond the lead's run.

---

# Pass 2: scope views and B-finding re-verification (snapshot 2026-11-20 16:24–16:28 GMT)

**Snapshot timing:** backend fixes landed *during* this pass. Files changed 16:13–16:19, and the lead reported scope fixes plus scoring v2 at about 16:26. The results below come from code as of 16:27. Anything that landed later is not covered.
**Safety:** I made no live sync, wrote nothing to the live DB, did no restart and ran no `next build`. Every probe ran in reviewer-owned vitest files under the scratchpad, each with a fresh `mkdtemp` DB, with `DATABASE_PATH` and `REPOQUEST_DB_PATH` both pointed there and `fetch` stubbed. Neither `data/engcaiofonseca-live.sqlite` nor `data/repoquest.db` was opened: the `data/repoquest.db-wal` mtime stayed at 16:20:57 before and after.

## Measured

| Check | Result |
|---|---|
| Project suite: `env -u GITHUB_TOKEN -u DATABASE_PATH REPOQUEST_DB_PATH=<scratch> npx vitest run` | **exit 0, 27/27** |
| Same suite file with `DATABASE_PATH=<scratch stand-in>` set (as a dev shell would have it) | **6/14 sync tests FAIL**, and the stand-in DB received **16 fixture evidence rows for username `engcaiofonseca`**. See P2-1 |
| Scope probe (2 repos; 8Knot paused on budget, CollectOSS complete). Then global → 8Knot → CollectOSS → global, plus the CollectOSS SVG | 0 `api.github.com` requests while switching. DB table hash unchanged. Global is reversible (deep-equal). CollectOSS warnings `[]` (no 8Knot leak). No `realm-*` achievements in the repo view. Repo evidence only `chaoss/CollectOSS`. `evidenceIds` never reference another scope. Repo XP 1800 + 95 = global 1895. Global level 6 is derived, not a sum of levels. A docs-track merged PR unlocks `merge-initiate`. The SVG names the scope, shows the scope level and has no 8Knot text. **SCP-1/2/3/4/9/10/17 pass for this fixture** |
| B-7 probe: complete backfill (one user PR) → second sync with `MAX_REQUESTS=11` while 12 PRs are "updated", including PR #1 with a **new APPROVED review by the user** → third sync | s1 `complete` → s2 `partial` (pause) → s3 **`complete`, but the review was never imported**. See P2-2 |
| Sync route probes, called directly | `Origin: null` → **unhandled `TypeError: Invalid URL`**. `Origin=Host=attacker.test:3111` (the DNS-rebinding shape) **passes the check and makes a GitHub request**. JSON content type with no Origin is allowed (expected) |
| `getRepository` failure probe (first scope run, mock 500) | Coverage row and tracked id recorded as the **lowercased input `chaoss/collectoss`**, not canonical. See P2-4 |

## Re-verification of pass-1 findings (code at 16:27)

| # | Status | Evidence |
|---|---|---|
| B-1 DB path | **Fixed** | `db.ts:9-16` reads `DATABASE_PATH` first, then the legacy env var, then the legacy file, then `data/repoquest.db` |
| B-2 ignore rule | **Fixed** | `.gitignore` covers `data/`, `.repoquest/`, `*.sqlite*` |
| B-3 unlock date | **Fixed** | `progression.ts:250-254` uses `evidenceIds[target-1]` |
| B-4 classification | **Fixed for new imports** (title only, `github.ts:178`). The lead reports the upsert as landed (`repository.ts:65-71`, `ON CONFLICT DO UPDATE track`). I didn't measure it against the live data | — |
| B-5 rank repo gate | **Fixed** | `deriveRank` has no repo count. A single-repo S needs 12 unlocked from 13 attainable in a repo scope: reachable, but tight |
| B-6 issue order | **Fixed** | Issues backfill with `sort=created&direction=asc` (`github.ts:168`) |
| B-7 incremental | **Partially fixed. New defect P2-2** | Incremental mode exists (`sync.ts:149-152,200-215`), but its pause and failure checkpoints are mislabelled |
| B-8 CSRF | **Mostly fixed** | JSON content-type gate (415) and Origin≠Host gate (403). Remaining: P2-3 |
| B-9 per-repo failure | **Fixed, with a casing defect** | Per-repo `try/catch` (`sync.ts:408-428`). See P2-4 |
| B-10 rate limit / timeout | **Fixed** (code read) | 429 and 403+`retry-after` → `rate_limited`. `AbortSignal.timeout(15000)` (`github.ts:6,65,75-82`) |
| B-11 selection | **Fixed** | `sync_state.selected_repositories_json`. Snapshot filtered to the tracked set (`dashboard.ts:69-80`). The probe shows only tracked repos |
| B-12 concurrency | **Open** | No mutex or 409 in `sync.ts` or the route |
| B-13 lastSyncedAt | **Open** (not re-measured) | `sync.ts:~441` still keeps the previous value when any repo is partial |
| B-14 private repos | **Open** | No `private` check |
| B-15 SVG demo wording | **Open** | `share-svg.ts:45` still says "Demo / self-reported" |
| B-16 tests | **Improved** | 27 tests including scope, route and upsert. Still missing: incremental pause/resume, `Origin: null`, rebinding, concurrent sync |

## New findings

| # | Sev | Where | Finding | Reproduction | Fix (owner) |
|---|---|---|---|---|---|
| P2-1 | **Blocker** (data safety) | `src/lib/server/sync.test.ts:~213` sets only `REPOQUEST_DB_PATH`; `db.ts:10-11` gives `DATABASE_PATH` precedence; `src/app/api/sync/route.test.ts:3` imports the route (and `db.ts`) with no DB env at all | **Tests aren't isolated from the configured DB.** If `npm test` runs in a shell with `DATABASE_PATH` set (e.g. the dev server's `data/engcaiofonseca-live.sqlite`), the sync tests write fixture evidence under the real username into that file, and the cross-test sharing makes 6 tests fail. `route.test.ts` always opens the working-tree default `data/repoquest.db` | Measured: a stand-in `DATABASE_PATH` got 16 `engcaiofonseca` fixture rows, and 6/14 tests failed | In tests, set **`DATABASE_PATH`** (and delete the legacy var) to a `mkdtemp` path before importing. Give `route.test.ts` a temp DB too. Optionally make `db.ts` refuse a non-temp path when `VITEST` is set (backend) |
| P2-2 | **Major** (evidence loss) | `sync.ts:149-152` (incremental only when there's no checkpoint), `:325-345,350-362` (checkpoints always stamped `created_asc`) | **An incremental pass that pauses or fails writes its updated-desc page/index as a created-asc backfill checkpoint.** The next sync resumes the *backfill* from that offset, skips earlier created-asc items, and marks the repo `complete` with `coveredThrough = now`. Updated items in the skipped range are never fetched, and later incremental passes start after them | Measured: B-7 probe, s3 `complete` with the user's new review missing | Stamp checkpoints with the mode (`incremental` + `since`) and resume the same traversal. Or, when an incremental pass is interrupted, keep the previous `coveredThrough` and restart the incremental pass from page 1 (it's idempotent). Add a test (backend) |
| P2-3 | **Major** (security) | `src/app/api/sync/route.ts:27-34` | `new URL(origin)` sits outside any try, so `Origin: null` (sandboxed iframes, `file:`) throws and returns 500. The Origin==Host comparison lets DNS-rebinding requests through, because the attacker controls both headers. That spends the server token and switches the tracked profile and selection | Measured: `nullOrigin` threw. `rebind` made 1 GitHub request | Allowlist `Host` (`127.0.0.1:<port>`, `localhost:<port>`, plus a configured public host) on all `/api/*` routes, reject `Origin: null` with 403, and wrap the URL parse (backend) |
| P2-4 | **Major** | `sync.ts:419-428` | When `getRepository` fails, the fallback coverage and tracked id use the **schema-lowercased input slug** (`chaoss/collectoss`), not the canonical id. If a transient failure hits a tracked repo, the canonical `complete` coverage row and a new lowercase `failed` row both pass the lowercase selection filter, giving two realms and global coverage that disagrees with the repo view (PLAUSIBLE, duplication not measured) | Measured: the lowercase id was recorded | Resolve to the stored canonical id via `repositories` or `coverage` (case-insensitive) before writing, or keep the previous tracked canonical id (backend) |
| P2-5 | Minor | `progression.ts:390` + definitions | In the global view, `realm-triple` (3 repos) can't be reached with the 2 default tracked repos, so global shows an impossible locked badge | Code read | Hide breadth badges whose target exceeds `trackedRepositories.length`, or say "track a 3rd repository" (backend) |

## Final-review gates still open

1. P2-1 test isolation (Blocker) **before anyone runs `npm test` again with the dev environment**.
2. P2-2 and P2-3, each with a regression test.
3. P2-4, B-12 to B-15.
4. Read-only re-check of the live global / 8Knot / CollectOSS snapshots after the lead's import (lead-reported: global L13 A 10300 XP; 8Knot L13 A 9895; CollectOSS L3 D 405; 9895 + 405 = 10300 ✓ by arithmetic only).
5. Clean `npm ci` + typecheck + `next build` (needs `.next` free), Docker volume persistence, browser and a11y pass (SCP-12/13).

## Recommendation (pass 2)

**Not releasable yet.** Scope isolation is solid in my probes, and most pass-1 findings are fixed. The blockers are P2-1, which can contaminate the user's live DB, and P2-2, which loses evidence while reporting it complete.

## Pass 2 addendum: live read-only verification after the lead's backfill (16:28–16:29)

GET only, on `127.0.0.1:3111`. No sync.

| Check | Result |
|---|---|
| `/api/dashboard` global, `?repository=chaoss/8Knot`, `?repository=chaoss/CollectOSS` | 200 ×3. `scoringVersion v2`. `warnings: []` in every scope. Coverage `complete` for both repos. Single actor `engcaiofonseca` |
| Global | 10 445 XP, L13, rank **A**, 102 evidence items, 13/15 achievements (`realm-triple` locked and unreachable with 2 repos: P2-5) |
| 8Knot | 10 040 XP, L13, rank **A**, 98 evidence items (63 eng PRs + 2 doc PRs = **65 merged**, 31 reviews, 2 doc issues), no realm badges, 12/13 achievements |
| CollectOSS | 405 XP, L3, rank **C**, 4 evidence items (**4 merged PRs**). Matches the user's baseline, as does 8Knot |
| Partition | Repo evidence ids disjoint. Union = global (102). 10 040 + 405 = 10 445 ✓ |
| Scope leakage | 0 achievement `evidenceIds` outside the scope. 0 evidence links outside `github.com/<scope repo>/` |
| Classification upsert | The previously misclassified 8Knot PRs ("CI: measure test coverage" and others) are now engineering. Only README/authors-doc PRs are documentation, so **B-4 is fixed on live data** |
| `/api/share` ×3 | 200, `xmllint` OK. Lv/Rank/Total XP match each scope (13/A/10445, 13/A/10040, 3/C/405). Repo cards name only their repo |
| `?repository=chaoss/augur` / `?repository=../x` | **404** `repository_not_tracked` / **400** `invalid_scope_query` |
| Token patterns in 3 JSON + 3 SVG | 0 |

The P2-1, P2-2 and P2-3 sources are **unchanged as of 16:29** (`sync.test.ts` 16:25:44, `sync.ts` 16:17:20, `route.ts` 16:16:54).

### Verified complete

B-1, B-2, B-3, B-4 (live), B-5, B-6, B-9 (except P2-4 casing), B-10 (code read), B-11. Scope SCP-1/2/3/4/9/10/16/17 (probe, plus live for 1/2/3/4/16/17). SCP-6 is partial: rank A in one repo is reached live, and S is reachable by the rules but not exercised.

### Residual blockers and majors

- **P2-1 Blocker**: tests write to `DATABASE_PATH` when it is set.
- **P2-2 Major**: an interrupted incremental sync loses evidence while reporting `complete`.
- **P2-3 Major**: `Origin: null` causes a 500, and the DNS-rebinding shape is accepted.
- **P2-4 Major**: a non-canonical id is recorded on repo-fetch failure.
- B-12 (no sync lock).
- Minors: B-13, B-14, B-15, P2-5.

**Not run:** `next build`. There's no documented alternate `distDir`, and dev owns `.next`. Also not run: clean `npm ci`, Docker, browser and a11y.

---

# Pass 3: recheck of P2 fixes, Progression Guide and STACK.md (2026-11-20 16:36–16:40 GMT)

**Method:** I reran my pass-2 reproductions as reviewer-owned vitest probes, each with a fresh `mkdtemp` DB, both `DATABASE_PATH` and `REPOQUEST_DB_PATH` set to it, and `fetch` stubbed. I did no live sync, no live DB access, no restart and no build. I didn't repeat broad tests beyond one suite run for P2-1.

## Measured

| Item | Reproduction | Result |
|---|---|---|
| **P2-1** test isolation | `npx vitest run` with `DATABASE_PATH` and `REPOQUEST_DB_PATH` set to a scratch stand-in | **Fixed.** 34/34 pass. The stand-in dir stayed **empty**. The `data/*.sqlite*` and `data/repoquest.db*` mtimes were identical before and after |
| **P2-2** incremental pause/resume | Pass-2 probe: complete → incremental with budget 11 (a new user review on PR #1) → resume → repeat | **Fixed.** s3 `complete` **with the review imported**. The repeat sync (s4) leaves XP unchanged (190 → 190) |
| **P2-3** Origin/Host | Direct `POST` calls | **Fixed.** `Origin: null`, the rebinding shape `Origin=Host=attacker.test`, `Host: attacker.test` without an Origin, and a malformed Origin all give **403 with 0 GitHub requests**. Same-host `127.0.0.1` and `localhost` pass through to GitHub |
| **P2-4** canonical identity | Sync `chaoss/collectoss` OK → then repo fetch returns 502 | **Fixed.** A single row, `chaoss/CollectOSS:failed`. Tracked set `["chaoss/CollectOSS"]`. Evidence kept (1) |
| **B-12** overlap guard | Two concurrent `POST /api/sync` | **Fixed.** Statuses `[200, 409]` |
| B-14 private repo | Code read, `sync.ts:156-171` | **Fixed.** Private repos are rejected with a warning |
| B-15 SVG demo wording | `share-svg.ts:46` | **Fixed.** "Demo data (sample character)" |
| B-13 `lastSyncedAt` | `sync.ts:491` | **Open (Minor).** Still keeps the previous value when any repo is partial |
| `.dockerignore` | Read | Covers `data`, `.repoquest/`, `**/*.sqlite*`, `.env*`, so no local DB or env enters the image context |

## Progression Guide (`/about`)

- **No drift on the source:** `getProgressionGuide()` (`progression.ts:540-585`) interpolates `RANK_THRESHOLDS`, `XP_RULES`, `LEVEL_STEP`, `SCORING_VERSION`, `TITLE_RULES` and `GLOBAL_ONLY_ACHIEVEMENT_IDS`, the same constants `deriveRank`, `applyXp` and `deriveTitles` use. `src/app/about/page.tsx` renders only guide fields, and the XP table reads `guide.xp.evidenceRules`. ✓
- **Links:** the dashboard links to `/about${scopeQuery(scope)}` (`Dashboard.tsx:120,174`). `/about` "Back to dashboard" and the brand link carry `?repository=` back. A malformed repo shows a warning and falls back to global. `CurrentCharacter` is read-only and uses `fetchDashboard(scope)`. ✓ (code read; not browser-tested by me)

| # | Sev | Where | Finding |
|---|---|---|---|
| G-1 | Minor (accuracy) | `progression.ts:389-392` vs `displayedTitleSelection` | The guide says the displayed title is "the highest unlocked title by progression order". The code picks the **last unlocked entry in `TITLE_RULES` array order**, where `Realm Walker` (2 repos) comes after `Gate Sentinel` and `Integration Pathfinder`. The live global title has been "Realm Walker" while the user holds 10+ reviews and 10+ merged PRs. Either order `TITLE_RULES` by actual progression, or describe the rule truthfully ("the most recently listed title you've unlocked") |
| G-2 | Minor (accuracy) | `src/app/about/page.tsx:55` | "Level … only goes up as you earn XP" is untrue. Level can drop when a repository is removed from the tracked set, when you switch scope, or when a scoring-version reclassification lowers per-item XP (for example docs PR 95 vs engineering 120). Suggested copy: "Level is derived from current evidence XP" |
| G-3 | Minor (accuracy) | `page.tsx:56` | "Rank measures breadth of milestones, not volume." The C, A and S gates are partly counts (3 and 8 merged PRs, 10 docs, 10 reviews). Suggested copy: "milestones across tracks, not raw XP" |
| G-4 | Minor | `TITLE_RULES[].unlock` | The unlock text hard-codes 1, 10 and 2 next to the predicates instead of interpolating shared constants. It's co-located, so drift risk is low. A guide-consistency test asserting text and predicate parity would close it |

## `docs/STACK.md` (optional factual check)

Accurate against `package.json`, `.nvmrc`, `db.ts`, `.dockerignore` and the live counts (69 merged PRs = 65 + 4, 31 reviews, 2 issues = 102). Two notes:
- Line ~176 says "Earlier builds passed": **the reviewer never measured a production build.** Keep this attributed to whoever ran it.
- "Next.js reads `.env.local`" is correct for `next dev`/`next start`. Vitest does **not** load it, which is consistent with the P2-1 fix.

## Status

**Verified fixed:** B-1 to B-12, B-14, B-15; P2-1 to P2-4. Scope SCP-1/2/3/4/9/10/16/17 (probe plus live). Live 102-evidence partition, from pass 2.
**Residual:** no Blockers or Majors found in this pass's scope. Minors: B-13, P2-5 (unreachable global `realm-triple` with 2 repos, not re-checked), G-1 to G-4.
**Release gates still NOT RUN by the reviewer:** a clean `npm ci` and `next build` on the integrated tree (dev owns `.next`), Docker build/run plus volume persistence, and a browser/mobile/keyboard/screen-reader pass of `/` and `/about`.
**Recommendation:** code-level acceptance for the MVP is met, apart from the minors above. Release approval depends on the three unrun gates.

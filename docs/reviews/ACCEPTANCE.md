# RepoQuest — Acceptance Criteria and Review Plan

Owner: independent reviewer (Claude Opus 5.5). Scope: `docs/reviews/**` only.
Status: **acceptance design plus early reviews (contract pass 2, UI snapshot); see §6–§8.** The §2 criteria are *planned* unless §6–§8 report a measured result. The final review records each result as PASS / FAIL / NOT IMPLEMENTED / NOT RUN, with evidence (command, exit code, file:line).

Source of truth: `docs/FACTORY.md`, "Product rules" and "First-release acceptance" (items 1–9). Where this document is stricter than the brief, the criterion is marked **[reviewer proposal]** so the lead can accept or drop it.

## 0. How results will be recorded

| Field | Meaning |
|---|---|
| ID | Stable criterion ID (e.g. `ING-3`) referenced in findings |
| Severity if failed | **Blocker** (must fix before MVP claim), **Major** (fix before release; may ship only with documented limitation and lead sign-off), **Minor** (backlog) |
| Evidence | Exact command and exit code, test name, HTTP request/response excerpt, or `file:line` |
| Result | PASS · FAIL (measured) · NOT IMPLEMENTED · NOT RUN (and why) |

Rules for the reviewer:
- A check passes only on observed evidence. "The code looks like it would" counts as *PLAUSIBLE*, not PASS.
- A nonzero exit from install/typecheck/test/build is a FAIL to investigate and report. The reviewer does not fix it.
- Live-GitHub checks require a token. If none is available, the result is NOT RUN, and the fixture/mocked equivalent is reported separately.

---

## 1. User journeys

Each journey is an end-to-end walkthrough. Its criteria are in §2.

### J1 — First run, no token (demo)
1. Clone, `npm ci`, `npm run dev` (or `npm run build && npm start`), with no `.env`.
2. Open `/`. The dashboard renders a character header, level, rank, the three tracks, repository realms, achievement journal, quests and evidence list.
3. A persistent, unmissable label says this is **demo data** (not only a tooltip, and not only colour).
4. The sync action says live sync is unavailable because no token is configured. It does not fail silently, and it does not pretend to sync.
5. `GET /api/share` returns an SVG that is marked as demo.

### J2 — Configure token and do a first live sync
1. Put `GITHUB_TOKEN` in `.env` / `.env.local` (name per README) and restart.
2. Enter a GitHub username and keep the defaults `oss-aspen/8Knot` and `chaoss/CollectOSS`. Edit or add one repo.
3. Run sync. The UI shows progress or the result: items imported per repo, skipped or failed repos, partial status.
4. The dashboard switches to **live** labelling, with source = GitHub, username, last-synced timestamp and repo list.
5. Contribution evidence links to the real GitHub URLs. XP, level, rank and achievements derive from that evidence.

### J3 — Repeat sync (idempotency)
1. Run sync again immediately with the same inputs.
2. Evidence count, XP, level, rank and achievements are unchanged. No duplicate rows appear.
3. After a new contribution upstream (or a fixture delta), only the new evidence is added.

### J4 — Failure paths
- Invalid username or slug → 400 with a field-level message. Nothing is persisted.
- Nonexistent user or repo (404) → that repo is reported as failed. Other repos still import. The status is "partial".
- Bad or expired token (401) → a clear error. Existing data stays and keeps its **live** labelling with a stale timestamp. It is **not** replaced by demo data.
- Rate limited (403/429 with `x-ratelimit-remaining: 0` or `retry-after`) → the user sees a reset time. The partial import is either committed consistently or rolled back, never half-applied.
- Network failure or timeout → handled like the above, with no unhandled rejection and no 500 stack trace in the response.
- Empty history (a valid user with zero contributions in the selected repos) → an empty-state message, level 1 / rank E, no crash, no demo substitution.

### J5 — Restart persistence
1. After J2, stop the server and start it again (and recreate the Docker container with the volume kept).
2. The dashboard shows the same live snapshot without a resync.

### J6 — Share card
1. Download or open `/api/share`.
2. The SVG is well-formed XML. It renders in a browser. It shows name, level, rank, tracks and a source/demo marker.
3. It contains no token, no private repo names unless explicitly opted in, no email, and no raw evidence bodies.

### J7 — Keyboard / screen-reader user
1. Do J1 and J2 using only the keyboard, with VoiceOver or NVDA on.
2. Every control is reachable and labelled. Sync results and errors are announced. The demo/live state is in text.

### J8 — Docker
1. `docker compose up --build` with no token → J1 at the documented port.
2. With a token via `env_file` or environment → J2. Then `docker compose down && docker compose up` → J5, because the data volume persists.

---

## 2. Release criteria

### 2.1 Installation, typecheck, tests, build (FACTORY #1, #8)

| ID | Criterion | Check | Sev |
|---|---|---|---|
| INS-1 | Lockfile committed. A clean `npm ci` succeeds on the Node version stated in README / `engines` / `.nvmrc` | `rm -rf node_modules && npm ci; echo $?` | Blocker |
| INS-2 | `npm run typecheck` (or `tsc --noEmit`) exits 0 under `strict` | run; record exit | Blocker |
| INS-3 | `npm test` (Vitest) exits 0, makes no network calls, and needs no token | run with network off or `GITHUB_TOKEN` unset | Blocker |
| INS-4 | `npm run build` exits 0. `npm start` serves the production build | run both; curl `/` and `/api/dashboard` | Blocker |
| INS-5 | Lint, if a lint script exists, exits 0 | `npm run lint` | Minor |
| INS-6 | Native SQLite module (e.g. `better-sqlite3`) installs on macOS arm64 and in the Docker base image without manual steps, or README documents the prerequisites | observe during INS-1 and DOC-1 | Major |
| INS-7 | README local instructions work verbatim. Every documented command and env var exists | follow README literally | Blocker |
| INS-8 | README lists known limitations: rate limits, public data only, the rank is not a verified ability or a global ranking, single-user local data | read | Major |
| INS-9 | `.env.example` exists, lists all variables, and has no real values | read | Major |

### 2.2 Truthful demo / live mode (FACTORY #2, Product rules)

| ID | Criterion | Check | Sev |
|---|---|---|---|
| MODE-1 | The dashboard snapshot has an explicit, typed field (e.g. `source: "demo" \| "live"`, plus `syncedAt`, `username`) that the UI and share card both read. There is no inference from "data present" | contract review plus `curl /api/dashboard` | Blocker |
| MODE-2 | With no token and no stored data, the app shows demo data labelled in visible text on the dashboard and on the share card | J1 | Blocker |
| MODE-3 | A failed live sync **never** silently swaps in demo data. Previously stored live data stays, with an error or stale indicator. With no prior live data, the UI shows the error. If demo data appears at all, it stays demo-labelled and the error is shown | mocked 401/500/network failure, then `GET /api/dashboard` | Blocker |
| MODE-4 | Demo evidence never mixes with live evidence in one snapshot. Rows are tagged by source, or demo data is never written to the live store | fixture test plus DB inspection | Blocker |
| MODE-5 | Demo data uses obviously fictional identities or is marked "sample". It does not attribute invented contributions to real people under their real logins **[reviewer proposal]** | inspect fixtures | Major |
| MODE-6 | Sync is explicit: no automatic sync on page load or on a timer | read code; watch network on load | Major |
| MODE-7 | Rank and level copy never claims verified ability or a global ranking. Something like "local progression from public GitHub activity" appears near the rank | UI text review | Major |

### 2.3 Input validation (`POST /api/sync`)

| ID | Criterion | Check | Sev |
|---|---|---|---|
| VAL-1 | The username matches GitHub rules: 1–39 chars, alphanumeric or single hyphens, no leading or trailing hyphen. Anything else → 400 | cases: `""`, `"-a"`, `"a-"`, `"a--b"`, 40 chars, `"../x"`, `"a b"`, `"<script>"`, unicode homoglyph | Blocker |
| VAL-2 | Repo slugs match `owner/name`. Owner follows username rules. Name is `[A-Za-z0-9._-]{1,100}`, not `.` or `..`. Exactly one `/`. No URL, scheme, query or fragment | cases: `a/b/c`, `a/..`, `https://github.com/a/b`, `a/b?x=1`, `a/b#c`, `a%2Fb` | Blocker |
| VAL-3 | The repo list is non-empty, de-duplicated case-insensitively, and capped (e.g. ≤ 20) **[reviewer proposal on cap]** | send 1000 slugs and duplicates in different case | Major |
| VAL-4 | The body is JSON with the expected shape. Unknown or oversized bodies are rejected. Wrong content type or malformed JSON → 400, not 500 | `curl -d 'not json'`, array body, nested huge string | Major |
| VAL-5 | Validated values are passed to GitHub URL-encoded or as path segments. A user value can never change the host, path or query (no SSRF or path injection) | read the client URL construction | Blocker |
| VAL-6 | Error responses do not echo unescaped input into HTML. JSON responses are fine | inspect | Minor |
| VAL-7 | Validation lives in one shared module, so UI-side and server-side checks agree. The server is authoritative | read | Minor |
| VAL-8 | Sync is a state-changing POST. It rejects cross-origin requests (Origin/Host check, or a custom header the UI sends), so a page on another site cannot spend the user's token **[reviewer proposal]** | `curl -X POST -H 'Origin: https://evil.example'` | Major |

### 2.4 Actor and evidence attribution

| ID | Criterion | Check | Sev |
|---|---|---|---|
| ATT-1 | Only items **authored by the target user** count. For PRs, the PR author is compared with the user by stable GitHub user id, or by case-insensitive login if the id is missing. Mentions, assignees, or "involves" search results do not count | fixture: a PR by another user that the target commented on → no engineering XP | Blocker |
| ATT-2 | Reviews count only when the **reviewer** is the target user and the review is on someone else's PR. Self-reviews and reviews by others on the user's PR do not earn review XP | fixtures for each case | Blocker |
| ATT-3 | The documentation track uses a deterministic, documented rule (paths such as `docs/**`, `*.md`, `README*`, or labels). That rule is versioned with the scoring | read rule; fixture | Major |
| ATT-4 | Merged, closed-unmerged and open PRs are distinguished. Any XP for a non-merged PR is explicit and documented | fixtures | Major |
| ATT-5 | Bots (`[bot]` suffix, `type: "Bot"`) are never the scored actor, and their reviews and comments are ignored | fixture | Major |
| ATT-6 | Evidence rows store repo, GitHub node or numeric id, type, actor login/id, URL, timestamps and track. Derived XP is computed from these and stored separately or computed on read (FACTORY product rule) | schema review | Blocker |
| ATT-7 | Renamed or case-changed logins: reimporting `Foo` after `foo` does not create a second identity or duplicate evidence | test | Major |
| ATT-8 | Repo transfers and renames: the evidence key does not rely only on `owner/name` text, so a redirect does not duplicate items **[reviewer proposal]** | read key design | Minor |
| ATT-9 | Evidence from a repo the user did not select is never shown, even if the API returns it | test | Major |

### 2.5 Repeat-safe ingestion (FACTORY #5, #6)

| ID | Criterion | Check | Sev |
|---|---|---|---|
| ING-1 | Each evidence row has a stable natural key, for example `(source, repo_id or slug, kind, github_id)`, enforced by a DB UNIQUE constraint and not only by application code | schema | Blocker |
| ING-2 | Syncing the same fixture twice gives the same row count, XP, level, rank and achievement unlock timestamps. The test asserts equality of full snapshots, not only counts | Vitest "duplicate sync" test exists and passes | Blocker |
| ING-3 | An updated upstream item (e.g. a PR goes from open to merged) updates the existing row in place. It is not inserted twice, and XP follows the scoring rule | fixture delta test | Major |
| ING-4 | Each repo's import runs in a transaction. A failure mid-repo leaves no partial rows for that repo and the previous state is kept. Or: partial results are explicitly committed and flagged partial. Either way it is documented and tested | inject failure on page 2 | Blocker |
| ING-5 | Two concurrent sync requests cannot corrupt state or double-insert. A lock or "sync in progress" 409 is acceptable | fire two POSTs in parallel | Major |
| ING-6 | Incremental cursors (`since` or `updated_at`), if used, move forward only after a successful commit | read | Major |
| ING-7 | Achievement unlocks are idempotent: unique per (profile, achievement id). The first-unlocked timestamp does not change on resync | test | Major |

### 2.6 Scoring, levels, ranks, titles (FACTORY #4, Product rules)

| ID | Criterion | Check | Sev |
|---|---|---|---|
| SCO-1 | Scoring is a pure, deterministic function of evidence plus a `SCORING_VERSION` constant. The same input gives the same output, with no `Date.now()` or randomness inside | read; property or snapshot test | Blocker |
| SCO-2 | No primary signal uses lines changed, raw comment count or raw commit count. If counts appear at all, they are capped or diminishing and secondary | read scoring table | Blocker |
| SCO-3 | Level comes only from total XP via a documented curve. Tests cover the exact boundaries: XP = threshold−1, threshold, threshold+1, for level 1→2 and at least one higher level, plus 0 XP | test names and values | Blocker |
| SCO-4 | Rank E–S comes from **milestone breadth**, not raw XP. For example, a user with huge engineering XP and no docs or review milestones does not reach S. Tests cover each rank boundary, plus "XP-heavy but narrow" | tests | Blocker |
| SCO-5 | Titles map to specific accomplishments: each title names its unlocking achievement or condition | read definitions | Major |
| SCO-6 | About 15 (12–18) achievement definitions exist. Each has a stable id, a name, a description and a deterministic predicate over evidence. None depends on wall-clock time unless that is documented | count; read | Major |
| SCO-7 | Quests have deterministic progress (n/m) computed from evidence, and they reach 100% exactly at completion | test | Minor |
| SCO-8 | Changing scoring rules bumps `SCORING_VERSION`. Derived values are recomputed from stored evidence without refetching from GitHub | read; test if present | Major |
| SCO-9 | Edge cases: zero evidence → level 1 / rank E with empty tracks. Negative or NaN XP is impossible. Very large inputs (10k items) do not overflow or slow down noticeably | test | Major |
| SCO-10 | Three tracks exactly: engineering, documentation, review. Every evidence item maps to at most one track, or the split is documented | read | Major |

### 2.7 GitHub pagination and rate limits (FACTORY #5)

| ID | Criterion | Check | Sev |
|---|---|---|---|
| GH-1 | All list endpoints follow `Link: rel="next"` (or GraphQL `pageInfo.hasNextPage`/`endCursor`) to the end, or to a documented max-page or max-item cap. Hitting the cap is reported as partial | mocked 3-page response test | Blocker |
| GH-2 | The Search API's 1000-result ceiling, if search is used, is detected and reported as partial rather than as complete | read; test | Major |
| GH-3 | `x-ratelimit-remaining`, `x-ratelimit-reset`, `retry-after` and secondary-limit 403s are recognised. Sync stops cleanly and returns a structured `rate_limited` result with the reset time | mocked 403/429 test | Blocker |
| GH-4 | No unbounded retry loops. Retries, if any, are bounded with backoff and respect `retry-after` | read | Major |
| GH-5 | Requests carry `Accept: application/vnd.github+json`, `X-GitHub-Api-Version` and a generic User-Agent. The User-Agent contains no personal data **[reviewer proposal]** | read | Minor |
| GH-6 | Per-request timeout via AbortController. A hung connection does not hang the sync route forever | read | Major |
| GH-7 | Tests use recorded or mocked responses only. No live network in CI | INS-3 | Blocker |

### 2.8 Persistence

| ID | Criterion | Check | Sev |
|---|---|---|---|
| PER-1 | The SQLite file path is configurable (e.g. `DATABASE_PATH`) with a default under `data/` (already git-ignored). The directory is created if missing | read; run fresh | Major |
| PER-2 | Schema creation or migration is automatic and idempotent on startup. A second start on an existing DB does not error or lose data | start twice | Blocker |
| PER-3 | Data survives a process restart (J5) and a Docker container recreate with the volume kept (J8) | manual | Blocker |
| PER-4 | A single DB connection is reused across requests (not one open per request, with no leaks under the Next dev hot reload) | read | Minor |
| PER-5 | WAL or busy-timeout is configured, so concurrent read during sync does not throw `SQLITE_BUSY` | read; ING-5 | Minor |
| PER-6 | Next.js route handlers that touch SQLite run on the Node.js runtime (not Edge) and are dynamic (`export const dynamic = "force-dynamic"` or equivalent), so `/api/dashboard` is not frozen at build time | read; build output shows the route as dynamic | Blocker |
| PER-7 | SQL is parameterised everywhere, with no string-built SQL that includes user input | grep | Blocker |

### 2.9 Token isolation and secret safety (FACTORY #6, Technical direction)

| ID | Criterion | Check | Sev |
|---|---|---|---|
| SEC-1 | The token is read only from server env (`process.env.GITHUB_TOKEN`) in server-only modules. Those modules use the `server-only` import or equivalent. No `NEXT_PUBLIC_` variant exists | grep; build | Blocker |
| SEC-2 | The token never appears in the client bundle | `npm run build && grep -r "$GITHUB_TOKEN" .next/static` → no match. Also grep `ghp_` and `github_pat_` with a dummy token set at build time | Blocker |
| SEC-3 | The token is never stored in SQLite | `sqlite3 data/*.db .dump \| grep -c <token>` → 0 | Blocker |
| SEC-4 | The token is never logged, including in error paths: fetch errors that print request headers, or `console.log(config)` | run failing syncs with a dummy token and grep stdout/stderr | Blocker |
| SEC-5 | The token is never in any API response: dashboard, sync result, error body, share SVG. The dashboard may expose `tokenConfigured: boolean` only | curl all routes; grep | Blocker |
| SEC-6 | A test asserts secret-safe output: it sets a sentinel token, runs success and failure syncs, and asserts that the sentinel is absent from responses, logs (spy) and the DB | test exists and passes (FACTORY #6) | Blocker |
| SEC-7 | Docker: the token is not baked into the image (`ARG`/`ENV` in the Dockerfile, or a `.env` copied in). `.dockerignore` excludes `.env*`, `data/` and `node_modules` | `docker history --no-trunc`; read `.dockerignore` | Blocker |
| SEC-8 | Error messages pass through GitHub error *messages*, but never the request headers or the full upstream response objects | read | Major |
| SEC-9 | Response security headers: at minimum `X-Content-Type-Options: nosniff` on the SVG, and the SVG is served with `Content-Type: image/svg+xml` **[reviewer proposal for CSP]** | curl -I | Major |

### 2.10 Share card escaping and privacy (FACTORY #7)

| ID | Criterion | Check | Sev |
|---|---|---|---|
| SVG-1 | The output is well-formed XML with `xmlns="http://www.w3.org/2000/svg"` | `xmllint --noout` exits 0 for demo and live snapshots | Blocker |
| SVG-2 | All interpolated text (username, display name, repo names, titles, achievement names) is XML-escaped: `& < > " '`. Attribute values are escaped too | test with name `"<script>alert(1)</script>&\"'"`, repo `a/b]]>`. Assert no raw `<script`, and that the output still parses | Blocker |
| SVG-3 | No user-controlled value is put into `href`, `xlink:href`, `style`, `on*` attributes, `<foreignObject>`, or a `url()` reference. Avatars, if present, are not fetched remotely or embedded from a user-supplied URL **[reviewer proposal]** | read the template | Blocker |
| SVG-4 | Control characters (U+0000–U+001F except tab/LF/CR, and U+FFFE/U+FFFF) are stripped, because they make XML invalid | test with `\u0001` | Major |
| SVG-5 | Long or unicode names are truncated or fitted and still render (RTL, emoji, 39-char login) | visual check | Minor |
| SVG-6 | The card shows a source marker: "DEMO DATA" or "Source: GitHub public activity · @user · synced <date>" | read output | Blocker |
| SVG-7 | It is derived from the same snapshot function as `/api/dashboard`. The two cannot disagree on level, rank or source | read; compare | Major |
| SVG-8 | By default the card excludes: token, email, private repo names and items, evidence titles and bodies, and exact per-item timestamps. Only aggregates appear (level, rank, track levels, achievement count/titles) | read; grep output | Blocker |
| SVG-9 | Private-repo evidence (`repository.private === true`) is either not ingested or never surfaced on the share card **[reviewer proposal: not ingested in MVP]** | read | Major |
| SVG-10 | The card uses no copied franchise assets or fonts that need a licence. It uses system or bundled OFL fonts | read | Minor |
| SVG-11 | `Content-Disposition` gives a sane filename. Query parameters, if any, are validated like VAL-1 and VAL-2 | curl -I | Minor |

### 2.11 Accessibility (FACTORY #3)

Target: WCAG 2.2 AA for the dashboard.

| ID | Criterion | Check | Sev |
|---|---|---|---|
| A11Y-1 | Semantic landmarks (`header`, `main`, `nav` if any), a single `h1`, and a logical heading order | inspect DOM | Major |
| A11Y-2 | Every input has an associated `<label>`. Validation errors are tied to the input with `aria-describedby` and announced | keyboard + SR | Major |
| A11Y-3 | Sync progress and results are announced via an `aria-live="polite"` region. Errors use `role="alert"` | SR | Major |
| A11Y-4 | Text contrast ≥ 4.5:1 (≥ 3:1 for large text and UI components) in the dark theme, including the rank colours and the "demo" badge | axe or contrast checker | Major |
| A11Y-5 | Information is never conveyed by colour alone. Rank letter, track names and demo/live are all in text | inspect | Major |
| A11Y-6 | Progress bars use `<progress>` or `role="progressbar"` with `aria-valuenow`/`min`/`max` or text equivalents | inspect | Minor |
| A11Y-7 | Visible focus indicator on all interactive elements. No keyboard trap. Tab order matches visual order | keyboard | Major |
| A11Y-8 | `prefers-reduced-motion` disables non-essential animation (glows, level-up effects) | emulate | Minor |
| A11Y-9 | Responsive at 320px width: no horizontal scroll, and the character header reflows. Readable at 200% zoom | devtools | Major |
| A11Y-10 | The share SVG has `role="img"`, `<title>` and `<desc>` that summarise level, rank and source | read output | Minor |
| A11Y-11 | `<html lang>` is set, and the page has a meaningful `<title>` | inspect | Minor |
| A11Y-12 | An automated axe pass (e.g. `@axe-core/cli` or Playwright + axe) finds no serious or critical issues | run if tooling exists; otherwise NOT RUN | Major |

### 2.12 Docker and production build (FACTORY #1, #8)

| ID | Criterion | Check | Sev |
|---|---|---|---|
| DOC-1 | `docker compose up --build` succeeds from a clean checkout, including the native SQLite build | run; record exit | Blocker |
| DOC-2 | The image runs `next start` or a standalone server as a non-root user, on the documented port | `docker exec … id` | Major |
| DOC-3 | A named volume (or bind mount) holds the DB path. Recreating the container keeps the data (J8) | run | Blocker |
| DOC-4 | The token is provided at runtime only (`env_file: .env` or `environment:`). See SEC-7 | read | Blocker |
| DOC-5 | Multi-stage build: the dev dependencies and build cache are not in the final image **[reviewer proposal]** | `docker image ls` size; read | Minor |
| DOC-6 | A healthcheck or simple readiness path exists, or README says how to verify | read | Minor |
| DOC-7 | It works with no token (demo mode) and the container does not crash-loop | run | Blocker |

### 2.13 Dashboard content (FACTORY #3)

| ID | Criterion | Check | Sev |
|---|---|---|---|
| UI-1 | It renders a character header (name, level, rank, title), three tracks with progress, repository realms (one per selected repo, with per-repo stats), an achievement journal (locked and unlocked), quests and a contribution evidence list with links | J1, J2 | Blocker |
| UI-2 | Loading, empty, error and partial states are each distinct and tell the user what happened and what to do | J4 | Major |
| UI-3 | The repo list defaults to `oss-aspen/8Knot` and `chaoss/CollectOSS`, and the user can edit it | J2 | Major |
| UI-4 | Untrusted strings (PR titles, repo names) are rendered as text. No `dangerouslySetInnerHTML` on GitHub data | grep | Blocker |
| UI-5 | Evidence links point only to `https://github.com/...`. They are built from validated parts, not taken unvalidated from API `html_url` **[reviewer proposal]**, and they use `rel="noopener noreferrer"` if `target=_blank` | read | Major |

### 2.14 Historical contribution credit (FACTORY "Historical credit — required"; added 2026-11-20 at the lead's request)

Journey **J9 — Veteran contributor first connect**: a user with years of merged PRs, reviews and docs changes in `chaoss/CollectOSS` installs RepoQuest today, enters their login and syncs once. They start with a nonzero level and rank and the qualifying achievements, dated by when the work happened. They do not start at level 1 "because you just installed".

| ID | Criterion | Check | Sev |
|---|---|---|---|
| HIS-1 | First sync backfills all accessible history for the supported kinds, with no `since`/recent-days cutoff. The default request has no date filter | read client; mocked fixture with evidence from 2019 → counted | Blocker |
| HIS-2 | Substantial pre-install history gives a nonzero starting level and the qualifying achievements. Historical evidence uses the same scoring rules as new evidence: no "historical" multiplier and no separate code path | fixture "veteran" (e.g. 30 merged PRs, 20 reviews, 5 docs PRs dated 2020–2024) → expected level, rank and achievement ids asserted exactly | Blocker |
| HIS-3 | Full pagination. Search API results with `total_count > 1000` or `incomplete_results: true` are **not** reported as complete. Coverage becomes `partial`, with a limitation string, or the import uses a non-search path (e.g. per-repo `pulls?state=all` + reviews) that reaches the full set | mocked search returning `incomplete_results: true` → `backfillStatus !== "complete"`; ≥ 3-page mocked list → all items ingested | Blocker |
| HIS-4 | Resumable backfill. An interruption (rate limit on page k, network error, process kill) keeps a checkpoint. The next sync resumes from it and ends with exactly the same evidence set and XP as an uninterrupted import: no dropped and no duplicate items | test: interrupt on page 2 of 3, resume → snapshot deep-equals the uninterrupted run (ignoring `generatedAt`/`lastAttemptAt`) | Blocker |
| HIS-5 | A checkpoint advances only after the page's evidence has committed (same transaction, or commit-then-checkpoint). A crash between the two cannot skip a page | read; fault-inject between write and checkpoint | Major |
| HIS-6 | Repeat, resumed, restarted and historical→incremental sync never double-credit. `totalXp`, track XP, achievement `unlockedAt` and evidence count are unchanged after: a second full sync, a resume after completion, a server restart plus sync, and an incremental sync after backfill | 4 assertions in one test file | Blocker |
| HIS-7 | Actor isolation. Two contributors (A, B) in the same repo: A's profile contains none of B's PRs or reviews, and the reverse holds too. Switching the active username does not keep the previous user's evidence in the snapshot | fixture with A and B interleaved → per-user evidence ids disjoint | Blocker |
| HIS-8 | Repo isolation. Two repos (R1, R2): a repo-specific achievement or quest for R1 counts only R1 evidence. Coverage and checkpoints are keyed per (user, repo). Removing R2 from the selection removes its evidence from the snapshot (and does not leak into R1) | fixture | Blocker |
| HIS-9 | Original timestamps. `occurredAt` is the GitHub event time (merged_at / submitted_at / created_at per kind, documented), and it is stored separately from `importedAt`. `oldestEvidenceAt`/`newestEvidenceAt` are original dates | DB inspection; contract | Blocker |
| HIS-10 | No fabricated streaks or recency. Importing 2021 work today gives no "current streak", "active this week" or time-boxed achievement. Any time-based predicate uses `occurredAt` and a fixed or injected clock in tests | fixture of only old evidence → streak/recency achievements locked | Major |
| HIS-11 | Truthful coverage per repo: requested scope, `backfillStatus`, oldest/newest, `lastSuccessfulSyncAt`, `coveredThrough` and `limitations`. An empty repo or user gives `backfillStatus: "empty"` with null dates, never invented dates. Unsupported kinds (e.g. commits without PRs, discussions, private repos) are listed as limitations, not shown as zero contribution | snapshot inspection for empty, partial and complete fixtures | Blocker |
| HIS-12 | UI explains the initial historical import. While incomplete it shows "provisional/partial", and it never says "complete" when `backfillStatus` is not `complete`. Text such as "0 reviews" is not shown for a kind whose retrieval failed or is unsupported. It shows "not retrieved" instead | J9 visual plus a11y text check | Major |
| HIS-13 | A failed sync keeps earned progress: stored evidence and XP stay, `source` stays `live`, the coverage status shows `failed`/`partial` with a warning, and there is no demo fallback (MODE-3) | mocked 401/500 after a successful backfill → XP unchanged | Blocker |
| HIS-14 | The profile is derived from all accumulated evidence for (user, selected repos), not from the last page or the current session's fetch | read the snapshot builder; HIS-4 test covers it | Blocker |
| HIS-15 | README documents the supported categories, the retrieval method, API limits (search caps, rate-limit time for large histories) and that "all history" means "all accessible via the supported endpoints" | read | Major |

### 2.15 Global and per-repository character views (FACTORY "Global and per-repository character views — required"; added 2026-11-20)

Spec-only. The scope contract is in flight: `src/lib/contracts.ts` had no scope type when this was written. Every row is a planned check. Notation: `E` is all stored evidence. `T` is the tracked repository set. `derive(X)` is the single versioned progression function applied to evidence set `X`. `global = derive(E ∩ actor=U ∩ repo∈T)`, and `repo(R) = derive(E ∩ actor=U ∩ repo=R)` for `R ∈ T`.

Journey **J10 — 8Knot maintainer**: the user tracks chaoss/8Knot and chaoss/CollectOSS. They open the dashboard (global by default), switch to "Repository: chaoss/8Knot" and see an 8Knot-only character with its own level, rank, title, tracks, journal, quests, evidence, coverage and share card. They switch back to Global, which is unchanged. No sync happens, and the sync form keeps the same repositories.

| ID | Criterion | Check | Sev |
|---|---|---|---|
| SCP-1 | **Filter before derive.** Repository views call `derive` on the evidence already filtered to (actor, R). No global-derived field (level, title, rank, unlock date) is copied, rescaled or post-filtered into a repo view | Metamorphic test: `repo(R)` deep-equals `derive(evidence where repositoryId=R)` computed independently in the test (ignoring `generatedAt`) | Blocker |
| SCP-2 | **Global uses the tracked evidence union, not a sum of levels.** `global.totalXp = Σ repo(R).totalXp` (evidence is disjoint), but `global.level = levelFromXp(global.totalXp)`, which is generally ≠ `Σ repo levels` | Fixture: two repos with 120 XP each (each level 2 under the current curve). Global 240 XP → level 2, **not** 4. Assert per-track XP sums and evidence counts add up exactly | Blocker |
| SCP-3 | **Disjoint, complete partition.** Every evidence id in global appears in exactly one repo view. The union of repo-view ids equals the global ids. Untracked repos' stored evidence appears in neither (ties to B-11) | Set assertions over the snapshot ids. Fixture with an extra untracked repo holding evidence → excluded | Blocker |
| SCP-4 | **Cross-scope unlock is impossible.** An 8Knot item can't unlock, appear in `evidenceIds` of, or date a CollectOSS achievement, quest or title. Every `evidenceIds` set is a subset of the scope's evidence ids, and every evidence link points to `github.com/<scope repo>/` | Fixture: 15 merged PRs in 8Knot, 0 in CollectOSS → every `repo(CollectOSS)` achievement is locked with empty `evidenceIds` | Blocker |
| SCP-5 | **Scoped unlock dates are correct.** `unlockedAt` is the `occurredAt` of the target-th qualifying item *within that scope* (fixes B-3 per scope). For the same achievement, the global date ≤ each repo date | Fixture with interleaved dates across two repos. Assert exact dates for the global and each repo | Major |
| SCP-6 | **High rank is reachable in one repo.** With only R's evidence, rank S is reachable through depth and track milestones. No rank gate, quest or achievement in a repo view needs more than one repository (fixes B-5 for repos) | Fixture: deep single-repo history (e.g. 40 merged PRs, 15 docs, 15 reviews in 8Knot) → `repo(8Knot).rank === "S"`. Grep the repo ruleset for repo-count predicates → none | Blocker |
| SCP-7 | **Repo-count badges are global only.** `realm-dual`, `realm-triple`, the "Realm Walker" title and any other repository-breadth item exist only in global. They are absent from repo views, not shown as impossible locked entries. Repo views still have a meaningful set (about 12 or more) of attainable definitions | Snapshot inspection per scope. Definitions are tagged `scope: "global" \| "any"` | Major |
| SCP-8 | **One versioned ruleset.** Every scope reports the same `scoringVersion`, and per-item XP is identical in global and repo views for the same evidence id | Assert `xp` per id is equal across scopes | Major |
| SCP-9 | **Switching is read-only.** Requesting any scope makes no GitHub API request (local `GET /api/dashboard` and `/api/share` requests are expected and fine), never writes the DB and never changes `T`, coverage, checkpoints or `sync_state` | Test: a fetch spy records **0 requests to `api.github.com`** (local route calls are allowed). DB row counts plus a hash of the `evidence`, `coverage` and `sync_state` tables are identical before and after `global→R1→R2→global` × 3 | Blocker |
| SCP-10 | **Switching is reversible and doesn't double-award XP.** `global→R→global` returns the same snapshot (ignoring `generatedAt`). Repeated switching never changes `totalXp` in any scope | Same test as SCP-9, comparing snapshots | Blocker |
| SCP-11 | **Scope is separate from the sync form.** Changing the view selector doesn't edit the sync form's repository list or trigger a sync. Submitting a sync doesn't change the selected view, except that a removed repo falls back to global with a notice | UI test or manual check. Inspect `localStorage` keys for separate scope and form entries | Major |
| SCP-12 | **The whole dashboard follows scope.** Header (name, level, rank, title), tracks, realms or coverage panel, journal, quests, evidence list, warnings and the share preview/download all reflect the selected scope. A visible label names the scope ("Global: 2 tracked repositories" / "Repository: chaoss/8Knot") | Manual walkthrough plus a DOM check that no panel shows the other scope's numbers | Major |
| SCP-13 | **Selector accessibility.** A labelled control (a `radiogroup` with a `select` for the repository) is keyboard-operable. The change is announced via `aria-live`. The state is in text, not colour alone | Keyboard plus screen reader (A11Y-2/3/5) | Major |
| SCP-14 | **Local vs global coverage.** A repo view shows only R's coverage, warnings and limitations. Global is `complete` only if every tracked repo is `complete`/`empty`; any `partial`/`failed`/`in_progress` makes global provisional. Global oldest = min and newest = max over repos. Per-repo limitations are listed by repo | Fixture: R1 complete, R2 partial → `repo(R1)` has no provisional banner; global is provisional and names R2 | Blocker |
| SCP-15 | **Empty and not-imported scopes are truthful.** A tracked repo with complete coverage and no evidence shows the real zero state (level 1, rank E, empty journal and evidence with an explanation). A tracked repo never imported shows "not imported yet", not zero progress | Fixtures for `empty` and `not_started` | Major |
| SCP-16 | **Request contract.** The default `GET /api/dashboard` (no params) stays global. A repo scope uses one stable, typed parameter shape (e.g. `?scope=repository&repo=owner/name`) validated with the shared slug schema. The response echoes `scope: {kind, repositoryId}`. An untracked, unknown or malformed repo gives 400/404 with `ApiError`, **never** a silent fallback to global | curl matrix: none, `scope=global`, valid tracked repo, untracked repo, `repo=../x`, `repo=<script>`, mixed case `CHAOSS/8knot` (canonicalized) | Blocker |
| SCP-17 | **Scoped share card.** `/api/share` takes the same scope parameters. The SVG names its scope, and every number on it (level, rank, XP, title, track bars, evidence/repo counts) equals the same-scope dashboard snapshot. The download filename includes the scope. The repo slug is XML-escaped. Demo cards stay marked as demo. The default with no params stays global | Test: for each scope, parse the SVG text and compare with `GET /api/dashboard?<same scope>`. `xmllint --noout` for each | Blocker |
| SCP-18 | **A repo snapshot is independent of other repos.** Adding, removing or changing evidence in R2 doesn't change `repo(R1)` | Metamorphic test: inject CollectOSS items → `repo(8Knot)` deep-equals before (ignoring `generatedAt`) | Major |
| SCP-19 | **Actor isolation holds per scope.** Another contributor's evidence in R never appears in `repo(R)` or global (HIS-7 applied per scope) | Two-actor fixture checked across all scopes | Blocker |
| SCP-20 | **Demo mode supports both views**, or the switch is disabled with an explanation. Demo per-repo views are still labelled demo | Manual or snapshot check | Minor |

---

## 3. Contract review checklist (for `src/lib/contracts.ts`)

When the contract is published, check:

1. `DashboardSnapshot` has a discriminated `source: "demo" | "live"` and `syncedAt: string | null` (ISO). It has `tokenConfigured: boolean`, never the token itself (MODE-1, SEC-5).
2. The sync request type is `{ username: string; repos: string[] }`, with a runtime schema (zod or hand-rolled) exported next to the type so that validation and types cannot drift (VAL-7).
3. The sync result is a discriminated union with per-repo outcomes: `ok | partial | failed | rate_limited`, counts, and `resetAt` for rate limits (J4, GH-3).
4. Evidence has a stable id, a `kind` enum covering PR, review and docs as needed, `track: "engineering" | "documentation" | "review"`, actor id/login, repo, URL and timestamps. It has no derived XP mixed in, or XP is clearly a separate derived structure (ATT-6).
5. Progression exposes `scoringVersion`, total XP, level, next-level threshold, rank `"E"|"D"|"C"|"B"|"A"|"S"`, the rank basis (milestones met) and per-track values (SCO-*).
6. Achievement and quest definitions have stable string ids that are safe as DB keys (ING-7).
7. Repo identity: a slug plus an optional numeric id (ATT-8).
8. No `any`. Dates are typed consistently (ISO strings across the wire).
9. Share-card input type is the projection that excludes private and sensitive fields (SVG-8).
10. **Scope contract (added for §2.15):**
    - An exported `DashboardScope = { kind: "global" } | { kind: "repository"; repositoryId: string }`, with a Zod schema reusing the slug rule.
    - `DashboardSnapshot.scope` echoes the resolved scope, plus `trackedRepositories: string[]` (the set `T`), so the UI can build the selector without a sync.
    - The same query shape for `/api/dashboard` and `/api/share`. No params means global.
    - Achievement and quest definitions carry an applicability tag (global-only vs any scope).
    - Coverage in the global snapshot lists every tracked repo. Repo snapshots carry only their own.

---

## 4. Required test inventory (FACTORY #6)

The final review will check that these tests exist by name or intent, and that they pass:

- duplicate sync → identical snapshot (ING-2)
- PR open → merged update (ING-3)
- mid-import failure is atomic or flagged partial (ING-4)
- level boundaries at threshold−1, threshold and threshold+1 (SCO-3)
- rank breadth boundaries, including "XP-heavy but narrow" (SCO-4)
- attribution: someone else's PR, self-review, bot (ATT-1, ATT-2, ATT-5)
- pagination across ≥ 3 pages (GH-1)
- rate-limit response → structured result (GH-3)
- 401 / 404 / network failure → no demo substitution (MODE-3)
- secret sentinel absent from responses, logs and DB (SEC-6)
- SVG escaping and well-formedness with hostile input (SVG-1, SVG-2, SVG-4)
- input validation table (VAL-1, VAL-2)

---

## 5. Release recommendation rule

- **Ship MVP**: all Blockers PASS, every Major is PASS or has a documented limitation the lead accepts, and INS-1 to INS-4 are re-run by the reviewer on the integrated tree.
- **Do not ship**: any Blocker is FAIL or NOT IMPLEMENTED, or any planned check could not be run and has no substitute evidence.

## 6. Contract and tooling review (pass 2, 2026-11-20)

### 6.1 Retired: fixed since pass 1 (verified by re-reading the current files)

| Pass-1 id | Was | Now |
|---|---|---|
| E-1 | No `package-lock.json`; `Dockerfile:3` `npm ci` would fail | The lockfile exists. Docker build still NOT RUN |
| E-2 | No actor on evidence | `ContributionEvidence.actor {login,id}` (`contracts.ts:82`) |
| E-3 | No token-configured flag | `DashboardSnapshot.liveSyncAvailable` (`contracts.ts:124`) |
| E-5 | Zod schema only promised | `syncRequestSchema` exported, and `SyncRequest = z.infer` (`contracts.ts:143-153`) |
| E-6 | No rate-limit reset on a successful partial | `SyncResponse.retryAt`, plus per-repo `coverage.failureReason`/`retryAt` (`contracts.ts:73-75,164`) |
| E-7 | No field errors | `ApiError.error.fields` (`contracts.ts:173`) |
| E-12 | `.nvmrc` `24` vs engines `^24.15.0` | `.nvmrc` = `24.22.3` |

### 6.2 Still open (contract)

| # | Sev | Where | Finding |
|---|---|---|---|
| E-4 | Major (backend) | persistence, not yet written | `importedAt` must be stored separately from `occurredAt` (HIS-9). Not verifiable until `src/lib/server` exists |
| E-9 | Minor | `contracts.ts:95-106` | `Achievement` gained `evidenceIds` but still has no `repositoryId`, so repo-specific accomplishments can't be shown per realm |
| E-10 | Minor | `contracts.ts:22-33` | Rank breadth is exposed only as a prose `nextRankRequirement`, with no `milestonesMet[]`. SCO-4 must be tested at the domain layer |
| E-11 | Minor | `contracts.ts:13` | `issue` is a scored `EvidenceKind`. Document how issues are scored under the "no raw volume" rule (SCO-2) |
| E-14 | Minor | `package.json` | No lint script and no automated a11y tool. A11Y-12 will be NOT RUN |
| E-15 | Minor | `contracts.ts:149` | The schema lowercases slugs, so the canonical casing (`oss-aspen/8Knot`) is lost in storage and display unless the server takes the canonical name from GitHub. Measured: `"oss-aspen/8Knot"` → `"oss-aspen/8knot"` |
| E-16 | Info | `contracts.ts:140` | Repo names `.git`, `...` and `-` pass the schema (measured). That's harmless because GitHub returns 404, but they could be rejected cheaply |

Measured schema probe (`node` 26 type-stripping import of `contracts.ts`; script in the reviewer scratchpad). It **rejects** `""`, `-a`, `a-`, `a--b`, 40 chars, `../x`, `a b`, `<script>`, `a/b/c`, `a/..`, `a/.`, URLs, `?`, `#`, `%2F`, `a--x/b`, 11 repos, and unknown keys (`.strict()`). It **accepts and canonicalizes** `Foo`→`foo`, ` foo `→`foo`, `A/B`+`a/b`→`["a/b"]`. VAL-1/VAL-2 PASS at the schema level only. The route (VAL-4/VAL-5/VAL-8) is NOT IMPLEMENTED.

## 7. UI snapshot review (2026-11-20; UI coder still applying frontend-design, so this is NOT the final review)

Inputs: `src/app/{layout,page}.tsx`, `src/app/globals.css`, `src/components/*.tsx`, `src/lib/client/*.ts`, read in full. Rendered checks are NOT RUN: there is no `/api/*` route yet, so the page can only reach the load-error state. Criteria applied: §2, `frontend-design` SKILL.md and karpathy-guidelines.

### 7.1 Findings

| # | Sev | Where | Finding | Evidence / fix |
|---|---|---|---|---|
| U-1 | **Major** | `src/lib/client/format.ts:1-5`, `src/components/SyncPanel.tsx:3,12-13`, `src/lib/client/api.ts:27` | **Client validation drifts from the shared schema** (VAL-7). The UI accepts inputs the server rejects, so the user gets a server 400 instead of an inline error. `api.ts:27` also redeclares `SyncRequest` instead of importing it from contracts | Measured: `a-`, `a--b` (username) and `a/..`, `a/.`, `a--x/b`, `a-/b` (slug) → client `true`, server `false`. Fix: use `syncRequestSchema.safeParse` (browser-safe) for client validation, and map `issues` to fields |
| U-2 | Minor | `SyncPanel.tsx:38` vs `contracts.ts:150` | The UI caps repos at 8, the contract at 10 | Derive the cap from one constant |
| U-3 | Major (a11y) | `SyncPanel.tsx:35`, `:25`, `api.ts:5-11` | Per-repo error `<p className="err">` has no id or `aria-describedby`, and no inline error is announced (A11Y-2). `readError` drops `ApiError.error.fields`, so server field errors can't reach inputs | Give each repo error an id, link it, and pass `fields` through `ApiError` |
| U-4 | Major (truthfulness) | `Dashboard.tsx:48-51,80` | After a failed sync the UI keeps the old `data` and doesn't refetch `/api/dashboard`. The coverage `failed`/`partial` state and `retryAt` the server records (HIS-11/HIS-13) aren't shown until a manual reload. The banner says "Progress you already earned is kept" without that being verified | Call `load()` in the `catch` (keeping the error banner) |
| U-5 | Minor | `api.ts:47-49` | `URL.revokeObjectURL` runs synchronously after `a.click()`. Some browsers (Safari/Firefox) can cancel the download | Revoke in `setTimeout(…, 0)` or later |
| U-6 | Minor | `normalize.ts:5-7` | `safeUrl` allows any `http(s)` host (UI-5 asks for github.com only). That's safe against `javascript:`, which is tested, but it allows plain `http` and arbitrary hosts | Restrict to `https://github.com/` |
| U-7 | Minor (a11y) | `Dashboard.tsx:72,90-131` | While loading or on a load error there is no `h1` (A11Y-1). Several always-present banners use `role="status"`, so screen readers may re-announce static text on every re-render | Static `h1` (sr-only fallback); keep `role="status"` only on changing messages |
| U-8 | Minor (design, snapshot) | `Dashboard.tsx:93,105,108`, `Sections.tsx:23,119` | frontend-design "template chrome" tells: an all-caps `DEMO DATA`/`LIVE DATA` label, an eyebrow above the h1, and meta strings joined with ` · ` in several places. Keep the demo label prominent (MODE-2) but consider sentence case plus a distinct visual treatment | Advisory. The UI owner is mid-pass |
| U-9 | Info (positive) | `layout.tsx:12-14`, `globals.css:23,26-27,134-135` | `lang="en"`, skip link, `:focus-visible` outline, `.sr` utility, `prefers-reduced-motion` and `forced-colors` handling, `role="progressbar"` meters, and labelled inputs inside a `fieldset/legend`. No `dangerouslySetInnerHTML` (grep). The avatar is not rendered, which resolves the client side of E-8. Token copy is truthful. Demo label is visible text. No auto-sync on load (MODE-6 PASS on code read) | — |
| U-10 | Info | `Dashboard.tsx:105`, footer | The "Local rank · not a verified or global ranking" copy satisfies MODE-7 on code read | — |

### 7.2 Measured results this pass

| Check | Result |
|---|---|
| `npm run typecheck` (`next typegen && tsc --noEmit`) | **exit 0** |
| `npm test` (Vitest 5.1.1) | **exit 0**: 1 file, 4 tests (client helpers only) |
| Schema probe (above) | as reported |
| Client-vs-server validator diff | **6 drift cases** (U-1) |
| `npm ci`, `npm run build`, Docker, browser/a11y, all backend criteria | NOT RUN or NOT IMPLEMENTED (backend absent; build deferred to the integrated tree) |

### 7.3 Skills and tooling used

- **karpathy-guidelines** (installed plugin, loaded via the Skill tool): findings are limited to verifiable defects with concrete fixes, there are no speculative redesigns, and every claim cites a file:line or a measured command.
- **frontend-design** (read directly from the official plugin path): used for U-8 and the a11y quality floor (focus, reduced motion, responsive). Its screenshot/self-critique step is NOT RUN by the reviewer, since the UI can't render data without the API.
- **Code-review / testing guidance**: findings are ranked by severity; measured results are kept apart from planned checks; the required-test inventory is in §4. The `code-review` skill was not invoked, because it diffs against a commit and the whole implementation is uncommitted.
- **Code Mode / programmatic tool calling: NOT AVAILABLE** in this Claude session. The exposed tools are Agent, Artifact, AskUserQuestion, Bash, Edit, ListAgents, Read, ReportFindings, ScheduleWakeup, Skill, ToolSearch, Write, plus deferred MCP tools. A ToolSearch for "code mode programmatic tool calling execute code" returned no such tool. No `execute` tool exists. I used parallel tool calls in single turns instead, and installed or changed nothing.

## 8. Current status and open blockers

> **Update 2026-11-20 16:40 (pass 3):** P2-1 to P2-4, B-12, B-14 and B-15 verified fixed with probes. No open Blocker or Major in code review. Open: minors B-13, P2-5, G-1 to G-4. Unrun gates: clean install/build, Docker, browser/a11y. See BACKEND_REVIEW.md Pass 3.
>
> **Update 2026-11-20 16:28 (pass 2):** see BACKEND_REVIEW.md Pass 2. SCP-1/2/3/4/9/10/17 pass in a reviewer fixture probe. New: P2-1 (Blocker, tests can write to a configured live DB) and P2-2 (Major, evidence loss on incremental resume).
>
> **Update 2026-11-20 (scope views):** I added §2.15 SCP-1 to SCP-20 and contract checklist item 10. All of them are planned. The scope contract and implementation are in flight, so I ran no tests for this pass, and I made no DB or sync actions, per the lead's live-DB preservation instruction.
>
> **Remaining final-review gates:**
> 1. Re-verify BACKEND_REVIEW B-1 to B-16 against the fixed code, especially B-1 (DB path) and B-2 (ignore rule), given the live DB loss the lead is handling.
> 2. Review the scope contract against checklist item 10.
> 3. SCP Blockers: SCP-1/2/3/4/6/9/10/14/16/17/19. Each needs a named passing test or a reproduced curl.
> 4. A clean `npm ci`, typecheck, tests and `next build` on the integrated tree. This needs a window when dev doesn't own `.next`.
> 5. Docker build/run plus volume persistence (DOC-1/3/7, PER-3).
> 6. Browser desktop/mobile and keyboard/screen-reader pass (A11Y, SCP-12/13).
> 7. A live smoke check of the global vs 8Knot view against the user's baseline (65 / 4 merged PRs), read-only.
>
> **Update 2026-11-20 16:10:** the backend is implemented. See [BACKEND_REVIEW.md](BACKEND_REVIEW.md) for pass-1 findings (2 Blockers, 9 Major). UI findings U-1/U-3/U-4/U-5 are fixed. The table below is the pre-backend status and is kept for history.


| Area | Status |
|---|---|
| Backend (`src/lib/domain`, `src/lib/server`, `src/app/api`) | **NOT IMPLEMENTED**: the backend worker is blocked (provider HTTP 401 reported by lead) |
| Contract | Pass 2 done: 7 findings retired, 5 minor and 1 backend item open (§6.2) |
| UI | Snapshot reviewed (§7). Final UI review waits for the frontend-design pass and for rendering against real routes |
| Release criteria §2 | Only VAL-1/VAL-2 (schema level), MODE-6, MODE-7 and U-9 items are PASS on code read. Everything else is NOT RUN or NOT IMPLEMENTED |
| Release recommendation | **Do not ship yet**: Blocker criteria across ingestion, scoring, persistence, secrets and SVG have no implementation |
| Final integrated code review | **Pending** backend delivery and lead reassignment |

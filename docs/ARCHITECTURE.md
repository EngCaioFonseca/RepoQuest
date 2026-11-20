# RepoQuest architecture

## Scope and implementation status

RepoQuest is one Next.js App Router application with TypeScript, React, npm,
Vitest, Zod, and local SQLite. This document specifies the agreed boundaries
and invariants for the initial implementation. The foundation and contract are
implemented; UI/server integration and acceptance are separate release gates
tracked in [FACTORY.md](FACTORY.md).

Node 24 LTS (24.15+) is the deployment baseline; Node 26 is accepted for local
development. `node:sqlite` supplies `DatabaseSync` without a compiled npm addon
or external daemon. Node 24 documents this module as release-candidate, available
without an experimental flag. Server routes using SQLite must use the Node.js
runtime, never Edge. There is no ORM or separate worker service in this release.

## Module boundaries

- `src/lib/contracts.ts`: browser-safe JSON DTOs shared by UI, APIs, and tests.
  It also exports the Zod sync-input and dashboard/share scope-query schemas,
  with TypeScript request types inferred from them. It contains no database access, secrets, runtime
  environment reads, or provider client. All timestamps are ISO-8601 strings;
  nullable dates mean unknown or absent, not the Unix epoch.
- `src/app/page.tsx`, `layout.tsx`, `globals.css`, `src/components/`, and
  `src/lib/client/`: presentation, user-selected contributor/repositories,
  loading/error states, and download interactions.
- `src/lib/domain/`: deterministic scoring, levels, breadth-based ranks,
  achievements, titles, and quests. Pure functions receive evidence and explicit
  time when necessary; they do not fetch GitHub or read process environment.
- `src/lib/server/`: GitHub ingestion, credential handling, input schemas,
  normalized evidence persistence, import checkpoints, snapshot construction,
  and SVG serialization. Server modules must not be imported by client code.
- `src/app/api/`: thin HTTP adapters validating input, invoking the server
  services, and translating known failures to safe responses.

## HTTP contract

`GET /api/dashboard` returns `DashboardSnapshot`. A single active local profile
has explicit `source: "demo" | "live"`, `generatedAt`, `lastSyncedAt`, profile,
progression, three tracks, repositories, evidence, achievements, quests, and
warnings. `liveSyncAvailable` indicates configured server credentials without
exposing them. Exactly one track entry exists for each of engineering, documentation,
and review. `levelXp` is XP inside the current level and `nextLevelXp` is that
level's full cost, not a lifetime XP threshold.

### Global/repository scope interface

The scope contract is implemented in `contracts.ts`; scoped backend/UI behavior
still requires integration and acceptance verification. Both dashboard and share
use the same `dashboardScopeQuerySchema`:

- No query parameter means `{ kind: "global" }`.
- `?repository=chaoss%2F8Knot` means
  `{ kind: "repository", repositoryId: "chaoss/8Knot" }` after resolving canonical
  casing against the stored tracked repository set.
- Input is case-insensitive and schema-normalized to lowercase for lookup.
  Routes reject duplicate query keys before parsing; the schema rejects unknown
  keys, empty selectors, and malformed slugs. Invalid queries return 400.
  A valid but untracked slug returns 404 with `repository_not_tracked`.
  Scope lookup performs no GitHub requests and makes no persistence changes.

`DashboardSnapshot.scope` always identifies the evaluated view.
`trackedRepositories` always lists **all** tracked canonical slugs for the
selector; it is independent of the view. `repositories` contains all tracked
realms globally, or only the selected realm locally. An empty tracked repository
is a valid zero-progress view, not an untracked-repository error.

The snapshot module filters by contributor and tracked repositories, then by
view scope, **before** calling the one versioned progression engine. Its
interface exposes the complete scoped result, so callers never sum levels or
copy global titles into local characters. The profile identity remains the same,
but its title, progression, tracks, achievements, quests, evidence links and
unlock dates derive only from filtered evidence. Scope is passed as context to
omit global-only repository-breadth badges and quests in a repository view.
High ranks depend on depth and track milestones attainable in one repository,
never a minimum repository count.

Coverage notices, history-related warnings, and `lastSyncedAt` must use only the
included repositories; general server-configuration notices can appear in either
view. Partial 8Knot coverage must not make a complete CollectOSS character appear
partial. The SVG is built from the same scoped snapshot and visibly identifies
global tracked progress or the canonical repository.

The view selector is independent of the sync form and is not persisted as a
change to tracked repositories. `POST /api/sync` retains its existing shape and
returns a **global** snapshot. After a sync, UI displaying a repository refetches
its selected GET instead of rendering that global response as local. No extra
endpoint, database copy, migration, or reimport is needed to switch views.

`POST /api/sync` accepts `{ username, repositories }`. Validate JSON at runtime
using Zod: a valid GitHub username and 1–10 valid public `owner/name` slugs.
Canonicalize identities case-insensitively and deduplicate repository selections.
Reject malformed input before provider access. The token is read from the
server environment, not accepted in the request. Return `SyncResponse` with the
updated dashboard, imported and unchanged counts, partial flag, and warnings.
Partial rate-limited responses can include `retryAt` without losing that snapshot.
Known failures return a non-success HTTP status and `ApiError`; do not serialize
provider credentials, request headers, or raw exception objects.

`GET /api/share` accepts the identical optional `repository` query and produces
`image/svg+xml` from that same scoped snapshot. Use a
fixed composition and escape every dynamic XML text/attribute value. Include
demo/live provenance and local-game status. Do not embed private evidence,
credentials, scripts, or external resource loads. Sharing is a local export,
not a publishing service.

Dashboard/share responses must reflect current persisted state rather than
being frozen at build time or served from an unrelated user's cached snapshot.

## Evidence, history, and persistence

SQLite stores source evidence independently of the derived XP projection.
Stable provider IDs plus contributor and repository identity prevent duplicate
credit and cross-profile leakage. Public evidence includes the actor's GitHub
login and numeric ID; for reviews this is the reviewer, not the PR author.
The normalized persistence record also keeps `importedAt` separately from the
public original `occurredAt` timestamp. Bind SQL parameters rather than interpolating
input. Import batches should use transactions; database schema evolution belongs
to the persistence module. Checkpoints and source evidence must commit together
so interruption cannot skip a page.

The initial connection backfills **all accessible supported history**, with no
arbitrary recent-days window. It follows complete provider pagination and must
not equate a capped search result with complete history. Subsequent syncs resume
unfinished backfills or refresh existing evidence and fetch newly available work.
Use original contribution timestamps for chronology and unlock conditions;
record import timestamps separately. Old evidence follows the same scoring
rules as new evidence and cannot create a false current activity streak.

Every repository carries `RepositoryCoverage`, scoped to a contributor and
repository:

- Requested scope is `all_accessible_history`; `supportedKinds` says precisely
  which evidence categories were attempted.
- Backfill is `not_started`, `in_progress`, `partial`, `complete`, `empty`, or
  `failed`. An unavailable history is not a zero-contribution result.
- Oldest/newest evidence dates are null when no evidence was retrieved.
- Last attempt, last successful sync, and the complete-scan `coveredThrough`
  watermark are independent. Incomplete history has no complete watermark.
- `canResume` exposes resumability without leaking opaque provider cursors.
  `limitations` describes permission gaps, API caps, interrupted work, and
  unsupported history. Optional `failureReason` supplies machine-readable
  failure classification and `retryAt` supplies a per-repository reset time.

A failed sync preserves accumulated evidence and earned progress. Partial imports
can publish recovered progress only with explicit provisional coverage/warnings.
The snapshot derives from accumulated evidence for the selected identity and
repositories, never solely from the current batch. Empty successful live history
remains `source: "live"`.

The canonical database setting is `DATABASE_PATH` (fresh-install convention:
`./data/repoquest.db`; container: `/app/data/repoquest.db`).
**B-1 path compatibility is implemented in `src/lib/server/db.ts`.** Resolution
uses the first nonblank, whitespace-trimmed value of `DATABASE_PATH`, then legacy
`REPOQUEST_DB_PATH`, then an existing `.repoquest/repoquest.sqlite`, otherwise
`./data/repoquest.db`. Relative paths resolve from the process working directory.
The resolver selects a file without moving or resetting existing evidence;
an unconfigured installation preserves its legacy database rather than silently
switching to the new default. Explicit path changes do not migrate data.
Git and Docker exclude
`.repoquest/` plus SQLite main/WAL/SHM files, including nested SQLite paths.
Use one server instance per database. WAL and a bounded busy timeout are appropriate for local
read/write overlap; synchronous SQLite work should stay small and batched.
Backing up a live SQLite file with a plain file copy is not guaranteed consistent;
stop the process or use SQLite's backup facility. `DATABASE_PATH=:memory:` selects
an in-memory database that is discarded when the process exits.

### Cloud save

`src/lib/server/cloud-save.ts` optionally keeps a copy of player state outside
the machine. SQLite remains the working store and every domain/server module
keeps its synchronous access; the cloud copy is only a save slot, not a second
source of truth. `CLOUD_SAVE=gist` enables it; unset or `off` disables it.

The portable unit is a Zod-validated `PlayerSave` for one player: `profiles`
plus that player's `sync_state`, and their `repositories`, `coverage` (including
checkpoints), and `evidence` rows. Column names and ISO-8601 text values mirror
SQLite so a round trip is exact. Derived XP is never stored.

- `cloud-gist.ts` stores one `repoquest-save-<username>.json` file per player in
  a single secret Gist owned by the `GITHUB_TOKEN` user, found by listing that
  user's Gists. Saves read, merge (`mergeSaves`), and PATCH the file; overlapping
  saves are last-write-wins and repaired by the next save. Contents over the
  API's 1 MB truncation are read from `gist.githubusercontent.com` without the
  token.
- Merge rules: evidence and repositories are a union by stable ID, and a
  repository's coverage is only replaced by one whose `last_attempt_at` is not
  older, so another install's progress never moves backwards. The stored sync
  selection is kept when this install never synced the player.
- Restore runs at most once per process, before the first dashboard build or
  sync, and only when the local database has no player. It imports the most
  recent save in one SQLite transaction and rechecks emptiness inside it, so
  local state always wins. A failed restore is retried after a minute.
- Save runs after each sync (including partial ones, so checkpoints survive)
  and each profile preference change. Cloud failures never fail a sync or
  dashboard. `DashboardSnapshot.storage` reports `local: "memory" | "file"`,
  `cloudSave: "off" | "ready" | "error"`, the backend, a safe user-facing
  `cloudProblem`, the last save time, and whether this process restored from
  the cloud, without tokens, paths, or connection details. A failed save adds a
  warning to that sync response.

There is still no hosted service or authentication boundary: each player owns
their Gist and token.

## Progression and product meaning

Scoring is versioned and deterministic. Levels measure accumulated XP, ranks
E–S require milestone breadth, and titles represent specific accomplishments.
Engineering, documentation, and review are separate tracks. Approximately
15 achievement definitions form the initial journal. Quest `rewardXp` is suggested
effort, not an independently claimable XP currency: evidence drives credit.
Quests (`src/lib/domain/quests.ts`) are endless tiered questlines plus a monthly
bounty. The full history is replayed chronologically, so `questLog.completed`
carries each tier's real completion date, the level held at that moment, its
evidence, and a cosmetic relic. Relics and renown never feed XP, level or rank.
Achievements expose the actual qualifying `evidenceIds`; the UI must not guess
supporting contributions from a shared skill track.

Provider evidence should be attributable to the selected contributor. No primary
reward is based on line churn, raw comments, or raw commit counts. Repository
achievements count only that repository's evidence. Re-importing a historical
page, restarting the server, or switching sync phases cannot mint extra XP.
The UI and exported card must never imply independently verified professional
ability or a global competitive standing.

## Runtime and packaging

`npm ci` installs the committed lockfile. `npm run dev`, `build`, `start`,
`typecheck`, `test`, and `test:watch` are the supported entry points. TypeScript
is strict; typecheck generates Next route declarations before invoking `tsc`,
so it also works before a first build. The `@/` alias points at `src/` in
TypeScript and Vitest. Tests default
to Node, avoiding an unnecessary browser emulator for domain/server tests.

Next.js emits a standalone build. Docker builds in a Node 24 stage, copies only
runtime output/static assets into the final stage, and runs as `node`. Compose
binds port 3000 to loopback and attaches the named `repoquest-data` volume.
`GITHUB_TOKEN` is injected only at runtime; environment files, local agent
provider configuration (`.opencode/`), and local data are excluded from the
image build context. There is no public hosting/authentication
boundary in this local-first release.

## Verification gates

Foundation checks: dependency installation, strict typecheck, executable Vitest
configuration, built-in SQLite round-trip, and production build when application
entry points exist. Missing concurrently implemented modules must be reported
as unavailable integration, not hidden behind stubs or false-green test flags.

Domain/server tests must cover scoring thresholds, duplicate imports, original
timestamps, historic/incremental equivalence, contributor/repository isolation,
pagination resume, failures/rate limits, partial/empty coverage, persistence,
secret-safe responses, and valid escaped SVG. Scope tests must verify disjoint
repository evidence, reversible switching without writes, local achievement
dates/evidence, ranks attainable in one repository, and matching dashboard/SVG
scope. UI acceptance covers responsive
layout, labelled demo mode, all three tracks, historical/provisional progress,
repository coverage, sync failures, and sharing. The lead performs final
integration; independent review records concrete evidence before release.

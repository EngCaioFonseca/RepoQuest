# RepoQuest

A local-first, open-source contribution RPG. Grow a character through useful
repository work: levels, E–S ranks, titles, achievements, three skill tracks, and
a shareable character card.

RepoQuest takes inspiration from the sense of progression in *Solo Leveling*,
with an original interface, terminology, and artwork. It is an independent
project, unaffiliated with that franchise, GitHub, or the example repositories.
Your local rank is a game mechanic, not a verified assessment of developer
ability or a global leaderboard.

**Status: initial beta.** The dashboard, historical GitHub imports, global and
repository progression, Progression Guide, and SVG sharing are implemented.
Clean Node.js installation, production build, standalone smoke checks, and
database persistence across restart have passed. Desktop/mobile keyboard checks
have also passed. Container image builds, non-root runtime, and volume persistence
were verified with Podman and standalone Docker Compose on Linux ARM64.
Native Docker Engine verification and a full accessibility audit remain
outstanding; see [verification results](docs/reviews/PACKAGING_GATE.md).

## Features

- Credit accessible supported contributions from before installation.
- Switch between global and repository-specific characters.
- Earn XP, levels, E–S ranks, titles, achievements, and quests from real evidence.
- Understand rank requirements and title meanings in the `/about` Progression Guide.
- Export scoped SVG character cards and keep evidence in local SQLite storage.

For the technologies, architecture, and development workflow, read the
[full-stack guide](docs/STACK.md).

## Run locally

Use **Node.js 24 LTS, version 24.15 or newer**, and npm 11 or newer. Node 26 is
also accepted. SQLite uses the runtime's built-in `node:sqlite`; no database
server, native addon compilation, paid service, or AI provider is needed.
Node 24 currently labels this SQLite API release-candidate.

```sh
nvm install
nvm use
npm ci
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>. The development and local production commands bind
to loopback. A fresh installation should show an explicitly labelled demo
without a token; demo progress is never represented as real GitHub activity.

```sh
npm run typecheck
npm test
npm run build
npm start
```

`npm run test:watch` runs Vitest interactively. `npm test` intentionally fails
when no tests exist rather than reporting a false pass.

## Connect public repository history

1. Put a GitHub token in `GITHUB_TOKEN` in `.env.local`, then restart the server.
   Use the minimum read permissions needed for the public repositories.
2. Enter the contributor's GitHub username and the desired `owner/repo` slugs.
   Editable examples are `chaoss/8Knot` and `chaoss/CollectOSS`.
3. Request sync. First connection must recover accessible prior work, not begin
   scoring from the installation date. Subsequent requests resume incomplete
   imports or refresh already imported evidence.

Supported evidence includes authored merged pull requests, authored closed
documentation-focused issues, and submitted `APPROVED` or `CHANGES_REQUESTED`
pull-request reviews. Documentation is a specialization of qualifying evidence
rather than a fourth API category. Engineering, documentation, and review use the same scoring rules
for old and new work. Raw commit counts, lines changed, and comment spam are not
primary XP signals. Specific scoring and provider support are implemented in
`src/lib/domain/` and `src/lib/server/`, respectively.

Each repository exposes history coverage, original oldest/newest evidence dates,
last successful sync, resumability, and limitations. Partial, failed, empty, and
complete histories are distinct. Imported history must not manufacture a current
activity streak. Repeated syncs must not award the same contribution twice.

**Configuration**

- `GITHUB_TOKEN`: optional for demo; server-only credential for live GitHub
  access. Never name it `NEXT_PUBLIC_GITHUB_TOKEN`, put it in a client request,
  store it in SQLite, or include it in exported cards.
- `DATABASE_PATH`: SQLite file path, default convention
  `./data/repoquest.db`. The containing directory must be writable.

**Database path compatibility is implemented.** The server uses the first
nonblank value of `DATABASE_PATH`, then the legacy `REPOQUEST_DB_PATH` variable,
trimming surrounding whitespace. With neither set, it reuses an existing
`.repoquest/repoquest.sqlite`; otherwise it uses `./data/repoquest.db`.
Relative paths resolve from the server's working directory. Choosing another
path does not move or migrate existing evidence.
Local `.repoquest/` contents and `.sqlite`, `.sqlite-wal`, and `.sqlite-shm`
files are excluded from Git and Docker build contexts.

Next.js reads `.env.local` automatically. Docker Compose reads `.env` for
interpolation; it does not automatically read `.env.local`.

## Docker

Requires Docker with Compose. The image builds a standalone Next.js server,
runs as the non-root `node` user, and stores SQLite under `/app/data`.
Image build, non-root startup, and volume persistence across container recreation
have been verified using Podman with standalone Docker Compose on Linux ARM64.
Native Docker Engine has not been separately tested.

```sh
cp .env.example .env
# Optionally set GITHUB_TOKEN in .env for live imports.
docker compose up --build -d
docker compose logs -f repoquest
```

Open <http://localhost:3000>. Compose exposes the port only on `127.0.0.1`.
The named `repoquest-data` volume survives container rebuilds and
`docker compose down`. `docker compose down --volumes` deletes local progress.
Secrets are supplied at runtime and `.env*` files are excluded from image builds.

For backups, stop the app before copying the entire data directory/volume,
including any SQLite WAL files, or use a SQLite-aware online backup tool.
Restore into a writable data directory before restarting. A host bind mount
instead of the named volume must be writable by the image's `node` user.

## API and sharing

The source of truth is [`src/lib/contracts.ts`](src/lib/contracts.ts).

- `GET /api/dashboard`: active `DashboardSnapshot`, including `source`
  (`demo` or `live`), profile, progression, repository coverage, evidence,
  tracks, achievements, quests, and warnings; defaults to the global view.
- `POST /api/sync`: JSON `{ "username": "octocat", "repositories":
  ["chaoss/8Knot"] }`; runtime-validated with Zod. Returns the updated
  dashboard, import/unchanged counts, partial status, and warnings.
- `GET /api/share`: `image/svg+xml` character card from the active snapshot,
  explicitly marked demo/live and global/repository scope. Intended for download and manual sharing;
  this does not publish a profile or create a hosted public URL.

**Global and repository views:**
global means the contributor's currently tracked repositories, not all of GitHub.
Add `?repository=chaoss%2F8Knot` to **either** dashboard or share to select the
complete 8Knot character; `?repository=chaoss%2FCollectOSS` selects CollectOSS.
Omit the selector for global. Both routes must use the same selected scope.

Each scope has independently derived level, rank, XP, title/unlocked titles,
achievements, quests, engineering/documentation/review tracks, evidence, and
coverage notices. The response identifies `scope` and includes the full
`trackedRepositories` slug list for switching views; its `repositories` list
contains only the realms included in that view. Repository-count badges are
global-only, and high local ranks cannot require work in multiple repositories.

Changing views is read-only: it does not fetch GitHub, change tracked repositories,
or award XP. The sync form still controls what is tracked. Sync responses retain
a global dashboard for compatibility; a repository view refetches its scoped
dashboard after syncing. Invalid or duplicate selectors return 400; an untracked
repository returns 404 (`repository_not_tracked`), rather than switching views
silently or importing it.

Errors use `{ "error": { "code": "...", "message": "...", "retryAt": "..." } }`
with `retryAt` optional. Failed live imports must retain previous earned
progress and show the error, never silently substitute demo data.

## Limits and contribution

- One local application instance and a local database; no multi-user hosting,
  authentication service, cloud sync, or verified competitive ranking.
- Public GitHub evidence only. Deleted/inaccessible contributions and unsupported
  categories cannot be reconstructed. Pagination, API caps, permissions, and
  rate limits must be reflected in coverage; "complete" applies only to the
  explicitly supported accessible categories.
- GitHub network access is needed for sync. The local demo and persisted
  dashboard should remain usable without it.
- Node production packaging and live historical imports have been verified.
  Podman/Compose container acceptance has passed; native Docker Engine testing
  and a full accessibility audit remain outstanding.

See [architecture](docs/ARCHITECTURE.md) for boundaries and invariants, and the
[factory brief](docs/FACTORY.md) for current acceptance criteria. Contributions
should keep scoring deterministic, retain evidence provenance, and include
focused tests for changed behavior.

## License and attribution

[MIT](LICENSE), copyright 2026 RepoQuest contributors. Dependencies retain their
own licenses. Repository names and GitHub identities remain their owners'
property; imported evidence links back to its original public source. No
franchise artwork, text, logos, or proprietary code is included.

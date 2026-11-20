# RepoQuest: Full Stack and Development Guide

**Code snapshot:** November 20, 2026 · **Application version:** 0.1.0 · **License:** MIT

This document explains the technologies actually present in the repository, what each does, and how they work together. Versions come from `package.json` and `package-lock.json`; implementation details come from the source files linked below. The application is still undergoing final review.

## At a glance

RepoQuest is a **local-first, full-stack TypeScript web application**. One Next.js application serves the interface and API, imports contribution evidence from GitHub, saves it in a local SQLite database, and calculates RPG-style progression.

The core stack is:

- **Frontend:** React **19.3.1**, Next.js **16.4.6**, TypeScript **5.9.3**, and custom CSS.
- **Backend:** Next.js App Router route handlers running on **Node.js**.
- **Database:** SQLite through Node's built-in **`node:sqlite`** module.
- **Validation:** Zod **4.6.7**, with shared TypeScript API contracts.
- **External data:** GitHub REST API through native server-side `fetch`.
- **Tests:** Vitest **5.1.1** and TypeScript checks.
- **Hosting:** a local Node process, or a multi-stage Docker image with Docker Compose.
- **Development coordination:** Orca with four model-specific workers and a lead agent.

The target runtime is **Node 24 LTS**. `.nvmrc` selects **24.22.3**; the package also accepts Node versions matching `^24.15.0 || >=26.0.0`. It requires **npm 11 or later**.

The AI workers help develop RepoQuest. Running the application and calculating scores do not require an AI model or an AI-provider subscription.

## Frontend and user experience

**React** builds the interactive character sheet: level, rank, title, skill tracks, achievement journal, quests, contribution evidence, repository coverage, and sync controls.

**Next.js App Router** provides the page structure:

- `/` — the character dashboard.
- `/about` — the Progression Guide, including rank requirements, title meanings, XP rules, and current scoped progression.

The dashboard has a **Global / Repository** selector. Global combines the currently tracked repositories; a repository view uses only that repository's contribution evidence. View selection is stored separately from the sync form, and repository context can be carried in the URL.

Styling is **handwritten CSS with reusable design tokens** in `src/app/globals.css`. The current visual direction uses ink/slate surfaces, verdigris accents, warm text, serif display headings, and system-font body text. The component design includes responsive layouts, visible focus states, skip navigation, labelled controls, and reduced-motion handling.

Client modules handle local API requests, shared validation, scope selection, formatting, and coverage messages. React state manages interaction and loading/error states. The frontend explicitly distinguishes live data, demo data, and incomplete historical imports.

**Main files:** `src/app/`, `src/components/`, and `src/lib/client/`.

## Backend and application logic

The backend lives inside the same Next.js project. Route handlers receive HTTP requests and call application modules; there is no separately deployed backend service.

The main boundaries are:

- **`src/lib/contracts.ts`:** API types and shared Zod schemas.
- **`src/lib/server/github.ts`:** GitHub requests, pagination, authentication, classification, and provider-error handling.
- **`src/lib/server/sync.ts`:** contribution import, checkpoints, and sync coordination.
- **`src/lib/server/repository.ts`:** database reads, writes, and transactions.
- **`src/lib/server/dashboard.ts`:** assembling the requested character view.
- **`src/lib/server/scope.ts`:** resolving global versus tracked-repository scope.
- **`src/lib/domain/progression.ts`:** deterministic XP, level, rank, title, achievement, and quest calculations.
- **`src/lib/domain/share-svg.ts`:** character-card SVG generation.

The **`server-only` 0.0.1** package marks modules that must not enter the browser bundle. GitHub credentials remain in the Node process environment.

**Zod** validates and normalizes usernames, repository selections, and dashboard scope. TypeScript runs in strict mode; the `@/` import alias points to `src/`.

## Database and persistence

RepoQuest uses **SQLite**, a database stored in a local file, accessed directly through Node's `DatabaseSync` API. Queries are SQL statements in the repository layer.

The schema contains:

- **`profiles`:** contributor identity and display information.
- **`repositories`:** canonical GitHub repository metadata.
- **`evidence`:** contribution identity, actor, repository, type, classification, source URL, original event date, and import date.
- **`coverage`:** per-contributor/per-repository history coverage, failures, and resumable checkpoints.
- **`sync_state`:** the active profile, selected repository set, timestamps, and sync warnings.

SQLite uses **write-ahead logging (WAL)**. Evidence and corresponding checkpoint updates are persisted together in transactions, so a resumable checkpoint should describe the evidence actually saved.

The database path is resolved in this order:

1. Nonblank `DATABASE_PATH`.
2. Legacy `REPOQUEST_DB_PATH`.
3. An existing `.repoquest/repoquest.sqlite`.
4. `data/repoquest.db` for a fresh installation.

Relative paths resolve against the application working directory. Local database files and sidecars are excluded from Git and Docker build contexts.

For the current personalized preview, the server uses a separate recovered working database at `data/engcaiofonseca-live.sqlite`. Recovery backups remain separate from that working copy.

## GitHub integration and historical imports

GitHub is the external source of contribution evidence. The server uses the **GitHub REST API**, authenticated with `GITHUB_TOKEN`; the browser calls RepoQuest's local API rather than receiving that token.

The current supported evidence categories are:

- Merged pull requests authored by the selected contributor.
- Submitted `APPROVED` or `CHANGES_REQUESTED` pull-request reviews by that contributor.
- Closed documentation-focused issues authored by that contributor.

Documentation classification is rule-based, not an AI judgment. Raw commit counts, lines changed, and ordinary comment volume are not the primary scoring inputs.

On first connection, RepoQuest scans accessible supported history rather than starting from installation day. Canonical repository names are resolved from GitHub metadata; for example, the former `oss-aspen/8Knot` address resolves to `chaoss/8Knot`.

Imports use pagination, stable contribution IDs, request budgets, and persisted resume checkpoints. Reimport updates evidence metadata without creating a second copy or replacing its original import date. Backfill and incremental traversal state are tracked separately.

The current implementation also includes request timeouts, rate-limit handling, per-repository error reporting, and an overlap guard for sync requests. These behaviors have automated coverage and are part of the final review.

**“Complete” means the configured supported contribution categories were scanned.** It does not mean every possible GitHub activity, deleted resource, or inaccessible event is represented.

The local preview uses the existing authenticated GitHub CLI account to supply the server credential at launch. **GitHub CLI is a development convenience**, not an application dependency for installations configured directly with `GITHUB_TOKEN`.

## Progression and repository scopes

Progression is a **pure, deterministic TypeScript rules engine**, currently labelled scoring version **v2**. Stored evidence is the input; character statistics are derived from it.

Its concepts are:

- **XP:** points assigned to qualifying evidence.
- **Level:** accumulated XP interpreted through an increasing level curve.
- **Rank:** E–S milestone progression based on contribution depth and track breadth.
- **Titles:** named accomplishments with explicit unlock conditions.
- **Achievements and quests:** progress against defined contribution milestones.

Global and repository views use the same engine. The server filters the contributor's evidence to the requested scope **before** deriving the character. Global levels are not the sum of repository levels, and changing views does not award XP or trigger a GitHub import.

Repository-count achievements are global-only. High repository ranks are attainable through work within one repository.

The `/about` page reads **`getProgressionGuide()` from the progression module**. This exposes the scoring version, rank requirements, title meanings, XP rules, level formula, and displayed-title policy to the interface. Keeping the guide beside the calculation rules makes changes easier to reconcile and test.

## API and data flow

The application exposes three main API routes:

- **`GET /api/dashboard`** — the active contributor's global character snapshot.
- **`POST /api/sync`** — validate a username and repository list, import/resume GitHub history, and return a global snapshot with import/coverage information.
- **`GET /api/share`** — an SVG character card generated from the current stored evidence.

Dashboard and share requests accept an optional repository selector:

```text
/api/dashboard?repository=chaoss%2F8Knot
/api/share?repository=chaoss%2F8Knot
```

Omitting the selector means Global. An untracked repository is rejected rather than silently returning a different scope.

The import flow is:

```text
Sync form
  -> POST /api/sync
  -> Zod validation
  -> GitHub REST requests
  -> normalized evidence + coverage/checkpoints
  -> SQLite transaction
  -> scoped progression calculation
  -> React dashboard
```

Changing views reads existing local evidence. Exporting a card returns an **SVG file**; public profile hosting and independent verification of a user's score are separate future features.

## Testing and verification

**Vitest** runs unit and integration tests in a Node environment. GitHub responses are mocked in automated tests so pagination, failure, retry, actor attribution, and scoring scenarios can be reproduced without making real imports.

Test areas include:

- XP/rank boundaries, achievement dates, and guide consistency.
- Global versus repository isolation.
- Repeat imports, metadata updates, and historical checkpoint migration.
- Partial failures and incremental resume behavior.
- Runtime input validation and sync-route request checks.
- Temporary database isolation and inherited-environment regression cases.

**TypeScript** checks API/component contracts. `npm run typecheck` generates Next route types and runs `tsc --noEmit`.

**Orca's embedded browser** is used for manual desktop/mobile rendering checks, navigation, scope switching, and live-profile inspection. These checks complement automated tests; they are not a claim of a complete automated accessibility audit.

The UI worker completed a bounded Chromium keyboard/layout pass at **1280px and 390px** on the dashboard, repository view, and guide. It verified labelled controls, visible focus, skip navigation, keyboard scope switching, mobile menu state, and no horizontal overflow. Achievement evidence lists now use a native expander after the first three links to reduce tab stops. Screen-reader testing, axe/Lighthouse, full contrast verification, forced-colors/reduced-motion emulation, and 200% zoom remain unrun.

The backend reported **34 passing tests and a passing typecheck** before the final guide corrections; targeted progression tests and typecheck also passed after those corrections. The independent review's third pass confirmed the earlier blocker and major fixes, including test database isolation, incremental resume, and request guards.

The packaging check exposed a SQLite initialization race across parallel Next.js build workers. A connection-timeout fix passed initial checks but proved insufficient in the published container build. The corrected implementation opens SQLite and initializes its schema only on the first runtime `database()` call, rather than during route-module import. **22 targeted database/sync tests and typecheck passed**, covering locked imports, lazy runtime initialization, preserved data, and concurrent startup/migration.

The corrected disposable snapshot passed **clean `npm ci`, a production build while an external database write lock was held, and a fresh-path build that created no database artifacts**. An actual no-cache container image build also passed using **Podman with standalone Docker Compose on Linux ARM64**, followed by UID 1000/no-token runtime, global/scoped demo, guide, SVG, and named-volume persistence checks across distinct container recreation. Exact commands, source hashes, and the preserved pre-fix failure are in [PACKAGING_GATE.md](reviews/PACKAGING_GATE.md). Earlier claims that Compose was unavailable were incomplete: the Docker CLI plugin was absent, but standalone Compose and Podman were available. Native Docker Engine remains untested.

## Packaging and local hosting

**npm** manages dependencies; the committed `package-lock.json` makes `npm ci` reproducible.

Next.js is configured with **`output: "standalone"`**, producing a deployable server bundle. The development server uses Next's default tooling, observed as **Turbopack** in the local preview.

The **Dockerfile** has three stages:

1. Install dependencies with `npm ci`.
2. Build the application.
3. Run the standalone server as the non-root `node` user.

It uses `node:24-bookworm-slim`, serves container port **3000**, and stores the database under `/app/data`.

**Docker Compose** binds the application to `127.0.0.1:3000`, passes the server token through the environment, and mounts the named `repoquest-data` volume for persistence.

The current development preview is at **http://127.0.0.1:3111**. The application is designed around a local/self-hosted instance with an active contributor profile, not a hosted multi-tenant account system.

## AI-assisted development factory

Orca coordinates the development work and exposes worker chats. The lead assigns bounded tasks, routes findings, integrates changes, and verifies the live application.

Current roles:

- **Lead:** GPT-6 Astra Pro through OpenCode.
- **Systems architect:** GPT-6 Astra through OpenCode.
- **UI coder:** Claude Sonnet 5.5 through Claude.
- **Backend coder:** GPT-5.3 Codex through OpenCode.
- **Independent reviewer:** Claude Opus 5.5 through Claude.

The backend was initially assigned to GLM 5.3, then explicitly reassigned to GPT-5.3 Codex after provider-access failures. The current runtime application does not depend on either provider.

Relevant development skills include:

- **`frontend-design`:** visual direction, typography, hierarchy, responsiveness, and design critique.
- **Karpathy guidelines:** focused changes, explicit assumptions, simplicity, and evidence-based verification.
- **`codebase-design`:** module boundaries and shared interfaces.
- **Code-review/testing guidance:** actionable findings and independent acceptance checks.
- **Orca orchestration/browser skills:** worker coordination and real browser verification.

OpenCode exposes Code Mode in its sessions. The Claude workers checked their actual tool availability and reported that Code Mode/programmatic tool calling was not exposed there; they used normal tools and parallel calls.

Worker assignments, product requirements, and ownership are recorded in [FACTORY.md](FACTORY.md). Review findings are under `docs/reviews/`.

## Configuration and day-to-day commands

Main configuration:

- `GITHUB_TOKEN`: server-side credential for live GitHub imports.
- `DATABASE_PATH`: preferred SQLite file location.
- `REPOQUEST_DB_PATH`: compatibility alias.
- `REPOQUEST_MAX_REQUESTS_PER_SYNC`: importer request budget; currently defaults to **220** per repository pass.

For a fresh local development setup:

```sh
nvm install
nvm use
npm ci
cp .env.example .env.local
npm run dev
```

Configure the token and database location in your local environment file before live import. Next.js reads `.env.local`; it is ignored by Git. A no-token installation can display the clearly labelled demo.

Useful checks and production commands:

```sh
npm run typecheck
npm test
npm run build
npm start
```

Run production builds separately from a running development session that uses the same `.next` directory. Automated tests must isolate their databases rather than use a live preview database.

Container startup:

```sh
docker compose up --build
```

Compose reads its environment separately from Next's `.env.local`; provide `GITHUB_TOKEN` through your shell or Compose's `.env` configuration.

## Implementation status and source references

**Verified with the real profile:** GitHub history for `engcaiofonseca` has been imported into the personalized preview. Both selected repositories reported complete supported-history coverage, with **102 evidence records**: 69 merged PRs, 31 reviews, and 2 issues. The global and per-repository evidence partitions and share cards were checked against the live API.

**Review status:** the independent third pass verified the sync-hardening and test-isolation fixes and found no remaining blockers or majors in its code-review scope. Workers completed the minor guide corrections and bounded keyboard/mobile checks described above. The published build-time SQLite lock failure was reproduced and fixed with lazy runtime initialization; controlled Node builds and actual Podman/Compose container build/runtime/persistence checks passed. Native Docker Engine and the explicitly unrun accessibility checks remain outstanding.

Primary sources:

- [Dependency manifest](../package.json) and [lockfile](../package-lock.json)
- [Node version](../.nvmrc), [TypeScript configuration](../tsconfig.json), [Next configuration](../next.config.ts), [Vitest configuration](../vitest.config.ts)
- [Shared contracts](../src/lib/contracts.ts)
- [Progression engine and guide](../src/lib/domain/progression.ts)
- [Database setup](../src/lib/server/db.ts), [repository access](../src/lib/server/repository.ts), [GitHub adapter](../src/lib/server/github.ts), [sync orchestration](../src/lib/server/sync.ts)
- [Dashboard](../src/components/Dashboard.tsx), [styles](../src/app/globals.css), [Progression Guide page](../src/app/about/page.tsx)
- [Dockerfile](../Dockerfile), [Compose configuration](../compose.yaml), [environment example](../.env.example)
- [Architecture](ARCHITECTURE.md), [factory brief](FACTORY.md), [review findings](reviews/BACKEND_REVIEW.md)

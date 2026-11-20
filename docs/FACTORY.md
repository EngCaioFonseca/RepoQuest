# RepoQuest software factory

## Goal

Deliver the first working local-first contribution RPG in this independent repository. The human requested four visible worker agents and a lead coordinator:

- Lead: the originating OpenCode session; owns integration, work allocation, and final verification.
- Systems architect: GPT-6 Astra; owns architecture, shared contracts, project tooling and packaging.
- UI coder: Claude Sonnet 5.5; owns the dashboard and sharing UI.
- Backend coder: GLM 5.3; owns contribution ingestion, persistence and progression.
- Independent reviewer: Claude Opus 5.5; owns acceptance review and findings, not implementation.

## Working arrangement

Workers share a checkout with strict ownership; do not edit another worker's files, stage all files, commit, reset, stash, or switch branches. Report through Orca orchestration, ask the lead when blocked, and finish each assignment with worker_done. Do not launch additional agents. The lead will send follow-up assignments as dependencies land. No polling or waiting loops.

File ownership:

- Architect: root configuration/package files and lockfile, Docker files, `src/lib/contracts.ts`, `docs/ARCHITECTURE.md`, README, LICENSE.
- UI coder: `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/components/**`, `src/lib/client/**`, `public/**`, UI-specific tests.
- Backend coder: `src/lib/domain/**`, `src/lib/server/**`, `src/app/api/**`, backend-specific tests and fixtures.
- Reviewer: `docs/reviews/**` only.
- Lead: this brief and integration tracking; request implementation fixes from the owning worker.

## Initial technical direction

One Next.js App Router TypeScript application, npm, SQLite, Vitest, original CSS styling. The architect owns dependency installation and the lockfile. Prefer simple modules over a monorepo or plugin framework. No paid service or LLM is needed to run the product. Keep the token on the server only, outside the database and logs.

The architect publishes the shared typed contract first and reports its path promptly. UI and backend may start their isolated modules immediately; reconcile against that contract before completion.

Tentative route boundaries for the architect to finalize:

- `GET /api/dashboard`: snapshot containing profile, repositories, contribution evidence, progression, achievements and quests, plus explicit demo/live status.
- `POST /api/sync`: validated GitHub username and selected owner/repo slugs; incremental or repeat-safe import.
- `GET /api/share`: SVG character card derived from the same dashboard snapshot, with explicit source/demo marking.

## Product rules

- Three tracks: engineering, documentation, review.
- Level measures accumulated XP; E–S rank uses milestone breadth; titles represent specific accomplishments.
- Evidence is stored separately from derived XP. Stable identities make reimport idempotent; scoring is deterministic and versioned.
- Do not reward lines changed, raw comment volume, or raw commit count as primary signals.
- Never present a local rank as verified developer ability or a global competitive ranking.
- Demo data must be clearly labelled and never silently replace a failed real sync.
- Use oss-aspen/8Knot and chaoss/CollectOSS as editable initial repository examples.
- GitHub failures, rate limits, empty histories and partial results need clear handling.
- Shared cards must exclude credentials and private contribution details by default.

## First-release acceptance

1. Fresh install, typecheck, tests and production build succeed.
2. Dashboard works without a GitHub token in clearly labelled demo mode.
3. Responsive character header, level/rank, three tracks, repository realms, achievement journal, quests and contribution evidence.
4. Approximately 15 deterministic achievement definitions; no need for complex combat or a world map.
5. Explicit real GitHub sync using server-side configuration with pagination and repeat-safe ingestion.
6. Persistence survives process restart. Tests cover duplicate sync, scoring boundaries, import failures and secret-safe output.
7. Exported SVG is valid, escapes untrusted values, and includes source/demo identification.
8. README contains truthful local and Docker instructions, configuration and known limitations.
9. Independent reviewer reports concrete findings with severity, evidence and release recommendation. Lead routes fixes before claiming the MVP complete.

## Delivery phases

1. Parallel foundation, UI, progression/ingestion implementation, and acceptance design.
2. Contract reconciliation and integration.
3. Independent review, owner-driven fixes, verification and local preview.

The local Git repository is the initial deliverable. Public hosting, GitHub publishing, verified public profiles and multiplayer infrastructure are later decisions.

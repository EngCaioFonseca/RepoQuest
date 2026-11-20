# RepoQuest software factory

## Goal

Deliver the first working local-first contribution RPG in this independent repository. The human requested four visible worker agents and a lead coordinator:

- Lead: the originating OpenCode session; owns integration, work allocation, and final verification.
- Systems architect: GPT-6 Astra; owns architecture, shared contracts, project tooling and packaging.
- UI coder: Claude Sonnet 5.5; owns the dashboard and sharing UI.
- Backend coder: GPT-5.3 Codex (reassigned by the human from GLM 5.3); owns contribution ingestion, persistence and progression.
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

### Skill-guided development

The human requires workers to use relevant installed skills for development.

- All implementation/review workers: read and apply `karpathy-skills` (available under `~/.agents/skills/karpathy-skills/SKILL.md`): minimal scope, clear assumptions, surgical changes and verifiable outcomes.
- Architect: use installed `codebase-design` when refining module boundaries and contracts.
- UI: use the local official `frontend-design` skill at `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/frontend-design/skills/frontend-design/SKILL.md`. Read it directly if it is not exposed through the skill tool. This is the selected fit for the actual application UI, not a generic mockup skill. Apply its brief-led visual direction, compact design tokens, typography, deliberate hierarchy, accessibility and screenshot/self-critique workflow. Preserve the requested original progression-RPG identity and truthful data states.
- UI browser verification: use `orca-cli` and its browser reference to inspect the local application on desktop and mobile; distinguish fixture-backed rendering checks from real API integration.
- Reviewer: use the installed code-review/testing guidance for correctness and meaningful verification, and read frontend-design when reviewing the UI against its brief.
- Claude workers: inspect the tools actually exposed in their session. Use Code Mode/programmatic tool calling for suitable independent tool batches if available and follow its own runtime instructions. Do not assume OpenCode's `execute` exists in Claude, invent an unavailable tool, or claim a capability is enabled merely because it was requested. No installed skill named Code Mode was found in the lead's initial skill inventory; report actual capability availability.
- In completion reports, name the skills actually read/applied, the relevant checks run and remaining limitations. Skill guidance does not expand file ownership or authorize extra worker agents.

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
- Use chaoss/8Knot and chaoss/CollectOSS as editable initial repository examples. GitHub redirects the former oss-aspen/8Knot slug to chaoss/8Knot; canonicalize identities before storing or scoring evidence.
- The requested live preview is for GitHub contributor engcaiofonseca (canonical login EngCaioFonseca). Populate it from actual GitHub history, not fixtures; independent search baseline at setup was 65 merged PRs in chaoss/8Knot and 4 in chaoss/CollectOSS, not a complete contribution metric.
- GitHub failures, rate limits, empty histories and partial results need clear handling.
- Shared cards must exclude credentials and private contribution details by default.

## Historical credit — required

The human explicitly requires contributors to receive credit for work done in each selected repository before connecting RepoQuest. They must not start from zero simply because they installed the app today.

- First connection backfills all accessible historical evidence for supported contribution categories in that repository, with no arbitrary recent-days cutoff. Attribute evidence to the selected GitHub contributor, not everyone in the repository.
- Historical evidence uses the same scoring, achievement and rank rules as new evidence. Include qualifying prior PRs, reviews and documentation contributions; document supported categories and retrieval limits rather than claiming literally all past activity is recoverable.
- Record original contribution timestamps, separate from import timestamps. Repository-specific accomplishments must use that repository's evidence; importing old work must not fabricate a current activity streak.
- Paginate fully. Avoid treating capped search results as complete history. Checkpoint long imports so interrupted, rate-limited or partial backfills resume without dropping evidence or awarding duplicates.
- Track coverage per repository: requested scope, backfill state, oldest/newest retrieved contribution timestamps, last successful sync and any gaps or permission/API limitations. An empty repository has explicit empty coverage, not invented dates.
- UI must explain initial historical import, display recovered progress and provisional/partial status while incomplete, and preserve previously earned progress when a sync fails. Never label partial history complete or present unavailable evidence as zero contribution.
- Reconnecting, restarting, resuming and switching between historical and incremental sync must not double-credit work. Derive the final profile from accumulated evidence, not only the last fetched page or current app session.
- Explicit acceptance cases: substantial history predating installation yields a nonzero starting level and qualifying achievements; multiple pages and interruptions recover full supported history; repeated import leaves XP unchanged; two contributors and two repositories cannot leak credit across identities/scopes.

## Global and per-repository character views — required

The human requires two complete character views, not just per-repository contribution counts:

- **Global**: level, rank, XP, title/unlocked titles, achievements, quests, skill tracks and evidence across the contributor's currently tracked repositories.
- **Repository**: all the same character information, derived independently using only that contributor's evidence in the selected canonical repository. Initial choices are chaoss/8Knot and chaoss/CollectOSS.
- The human primarily maintains 8Knot and must be able to see the full depth of that work as an 8Knot-specific character. Global means tracked repositories, not a claim to have imported all of GitHub.
- Use one versioned progression ruleset on the chosen evidence scope. Filter evidence before deriving level/rank/titles/achievements/quests. Do not copy the global level or title into repository views, sum levels, or award XP again when switching views.
- High ranks must be attainable within a single repository based on contribution depth and track milestones. Repository-count badges belong to global progression; don't leave impossible multi-repository achievements or quests as local rank gates.
- A clear Global / Repository switch with a labelled repository selector drives the entire dashboard, including the character header, evidence, achievement journal, coverage notices and share card.
- Switching the visualization is read-only: no GitHub reimport and no changes to the tracked repository set. Keep scope selection independent from the sync form.
- A share card identifies its global/repository scope and uses that exact scope's progression.
- Local partial-history warnings reflect that repository; global completeness reflects all included repositories. For a repository with no evidence, show actual zero-progress/empty state.
- Keep default dashboard requests global for compatibility. Architect owns a small explicit typed scope contract and stable request shape; backend, UI and reviewer reconcile to it.
- Required verification: global total and each repo total derive from the correct disjoint evidence; switching is reversible and does not change stored evidence/XP; achievement dates and evidence links remain within scope; an 8Knot contribution cannot unlock a CollectOSS achievement; isolated repo ranks are not capped by repository count; share-card scope matches the visible dashboard.

## Progression Guide / About page — required

The human wants another page explaining the ranking and title system so contributors know why they hold a rank, how to evolve and what each title means.

- Provide a discoverable `/about` progression guide linked from the dashboard/navigation and relevant rank/title UI.
- Explain E–S ranks, precise advancement requirements, the difference between XP levels/ranks/titles, all unlockable titles and their meanings, how the displayed title is selected, achievements, and global versus repository scope.
- Show the XP rules/level curve and historical-credit behavior clearly. Explain supported evidence and documentation classification limitations without claiming that the game measures objective developer skill.
- Where useful show the current scoped profile/rank/title and actual next-rank requirement. Preserve repository context when navigating to the guide and back; gracefully support unavailable or demo data.
- Explanations and threshold metadata must come from the same versioned source as progression calculation; do not hand-copy a second, drifting ruleset into JSX.
- Keep the original visual identity, responsive/accessibility standards and appropriate installed skill usage.
- UI worker additionally owns `src/app/about/**`; backend owns pure progression metadata/guide exports and scoring tests. The architect's root/contracts ownership otherwise remains unchanged.

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
10. First connection credits historical contributions and reports per-repository coverage truthfully; historical backfill acceptance cases above pass.
11. Global and per-repository complete character views, scoped sharing and the scope-isolation checks above pass.

## Delivery phases

1. Parallel foundation, UI, progression/ingestion implementation, and acceptance design.
2. Contract reconciliation and integration.
3. Independent review, owner-driven fixes, verification and local preview.

The local Git repository is the initial deliverable. Public hosting, GitHub publishing, verified public profiles and multiplayer infrastructure are later decisions.

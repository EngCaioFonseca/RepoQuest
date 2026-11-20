# Issue #1: contributor classes. Independent review

Branch `feat/1-contributor-classes` (uncommitted working tree). Snapshot 2026-11-20 17:29–17:40 GMT, covering domain and the integrated UI as reported landed by the lead.
Reviewer: Claude Opus 5.5. Skills: karpathy-guidelines (verifiable, minimal claims); code-review/testing practice; domain-modeling vocabulary (class = role vote, specialty = topic hint).
Safety: I made no edits outside this file. No sync, DB write, build or restart. Probes ran as a standalone Node script importing the pure `src/lib/domain/classes.ts`. Live checks were **GET-only** on `127.0.0.1:3111`.

Labels: **M** = measured (probe or live GET); **R** = code read.

## Verified OK

| Area | Evidence |
|---|---|
| Scope before derive | **R** `progression.ts:516` calls `deriveCharacterClass(evidence)` on the evidence `dashboard.ts` already filtered to scope. **M (live)**: global, 8Knot and CollectOSS class `mix`/`specialties`/`basis` ids are all contained in that scope's evidence (0 out-of-scope ids). The views differ: global Warrior hybrid (62/31/7/2), 8Knot Warrior hybrid (61/31/4/2), CollectOSS Scribe hybrid (3/1) |
| No XP/rank regression | **R** the only progression diff is the import plus one field. `SCORING_VERSION` stays v2. **M (live)**: 10445/L13/A, 10040/L13/A, 405/L3/C, unchanged from pre-feature verification |
| Share parity | **M (live)**: each scope's SVG contains `• <class name> •` equal to that scope's `characterClass.name`. The name goes through `esc()` (`share-svg.ts:49`) |
| Review of a fix stays Guardian | **M**: a review titled "Review on PR #9: fix crash" votes guardian. **R** the review check comes first (`classes.ts:124`) |
| Eligibility | **M**: open or closed-unmerged PRs and closed engineering-track issues give 0 votes (Adventurer). Only merged PRs, submitted reviews and closed doc-track issues vote |
| Empty / insufficient / tie | **M**: empty → Adventurer provisional. 1 vote → Adventurer provisional. 2 warrior + 2 guardian → Adventurer **ambiguous** |
| Determinism | **M**: reversed input gives an identical result. An invalid `occurredAt` doesn't crash |
| Author attribution | **R** the classifier trusts the already actor-filtered evidence. **M (live)**: all evidence actors are the user (pass 2). No new attribution path |
| Docs precedence | **M**: "Fix broken link in README" → Scribe. Documentation beats Healer, consistent with the guide's precedence statement |
| UI evidence safety | **R** `normalize.ts normalizeClass` links only ids present in the scoped snapshot, with `safeUrl`. Missing ids count as `unlinked`. The mix bar has `role="img"` with a text `aria-label`. Demo and partial-history notices are present (`ClassSection.tsx:61-65`). The `/about#classes` link preserves `?repository=` |

## Findings

| # | Sev | Where | Finding | Evidence | Suggested fix |
|---|---|---|---|---|---|
| C-1 | **Major** (accuracy) | `src/lib/domain/classes.ts:85` `BUG_SIGNAL` | **Healer misses ordinary bug-fix titles.** A bare "fix" only matches when followed by bug/crash/etc., so conventional-commit `fix:`, "Fix X mismatch", "Fixes #123", "Resolve crash…" all vote **Warrior**. That understates the class the issue is about | **M probe**: `fix: handle null user in login`, `Fix login redirect loop`, `Fixes #123` and `Resolve crash when repo list is empty` → warrior. **M live 8Knot**: `fix: start db-init in podman e2e…`, `Fix GROUP BY mismatch in affiliation_query` and `Fixing DB connection tests…` → warrior. Healer = 2/98 | Count a leading `fix(\(.*\))?:`/`fix `/`fixes #N`, plus `resolve(s|d)? (crash|bug|error)`, as Healer, while excluding `fix typo`/`fix docs` (already caught by Scribe precedence). Add the live titles above as fixtures |
| C-2 | **Major** (spec: no AI-tool inference) | `classes.ts:87` `MAGE_SIGNAL` `\bai\b`; specialty `ai` `classes.ts:93` | **Tool usage is inferred as a Mage role.** Titles that disclose AI *assistance* vote Mage and earn the AI/LLM specialty. That contradicts the limit text "No inference is made about tool usage" (`classes.ts:246`) and the UI notice "not … the tools you used" (`ClassSection.tsx:62`) | **M probe**: `Refactor parser (AI-assisted)` and `Add chart with help from Copilot AI` → mage + ai | Exclude assistance phrases (`ai[- ]assisted`, `with (help from )?(copilot|claude|chatgpt|ai)`, `generated (by|with)`, `co-authored`) before topic matching. Require AI to be the *subject* (`ai (agent|model|feature|search)`, `llm`, `rag`, `embedding`). Add negative fixtures |
| C-3 | **Major** (false positives) | `classes.ts:87`, `:93` | Common non-AI and non-architecture phrases vote **Mage** or the AI specialty | **M probe**: `Improve type inference for props` → mage/ai. `Prompt user before deleting repository` → mage/ai. `Cross-platform path handling` → mage. `Platform-specific build fix` → mage. `Update data model for issues` → ai specialty | Drop bare `inference`, `prompt`, `platform` and specialty `model`, or qualify them (`model (training\|inference\|serving)`, `llm prompt`, `prompt engineering`). Keep `pipeline` only with `ml\|data\|ci/cd infra`, or accept it explicitly in the guide |
| C-4 | Minor | `classes.ts:91-95` specialties | Specialty false positives: `next` → frontend ("Show next page button"), `client` → frontend ("GitHub API client retries" gets backend **and** frontend), `scale` → systems ("Scale chart axis labels"), `fix` → qa (any fix, including a README link fix) | **M probe** | `next\.js\|nextjs` only; `client-side\|ui client`; `scal(ing\|ability)`; drop bare `fix` from qa |
| C-5 | Minor (guide accuracy) | `classes.ts:176-181` vs guide `stateRules` (`:318`) | **"hybrid" fires on any second class with one vote**, so 50 warrior + 1 scribe → `hybrid`. The guide says "minority class signals are still meaningful". Real profiles can essentially never be `specialized` | **M probe**: 50:1 → warrior/hybrid. Live: every scope is hybrid | Hybrid only when the runner-up share ≥ a stated threshold (e.g. 25%), else specialized. Put the threshold in the guide |
| C-6 | Minor | `classes.ts:166-173`, `ClassSection.tsx:85-89` | The `general` specialty has `evidenceIds: []`, so the UI renders "General Engineering, **0 contributions**". The `specialties.length === 0` branch can't be reached | **R** | Return `[]` for no signal and let the existing empty copy show, or have `general` cite the engineering evidence |
| C-7 | Minor (pre-existing pattern, now also class) | `src/lib/server/dashboard.ts` demo branch | In **demo repository scope**, the snapshot is derived from all demo evidence and *then* filtered, so the demo repo view's class (and level/rank) reflect global demo data (derive-then-filter) | **R** | Call `deriveProgression` on the scope-filtered demo evidence |
| C-8 | Nit | `classes.ts:193-200` | Dedupe keeps the first record after sorting by date then id. Duplicate ids with the same date but **different content** keep input order, so the result isn't deterministic. That can't happen with the DB primary key, so it's input-hygiene only | **M probe**: `[healer, warrior]` vs `[warrior]` depending on order | Add a final tiebreak (e.g. title) or reject conflicting duplicates |
| C-9 | Nit | `classes.ts:130` | `!/\brepair docs?\b/` can never fire, because doc titles return Scribe earlier | **R** | Remove it |

## Guide accuracy (`getClassGuide`, `/about#classes`)

- Precedence, dedupe, qualification, tie, insufficient-evidence and scope rule texts match the code. The guide comes from the same module as the classifier (`ClassSection.tsx:9`, `about/page.tsx:23`), so there's no hand-copied drift.
- The **inaccurate** statements are covered by C-2 (the tool-usage disclaimer is false today) and C-5 (the hybrid meaning).
- The Healer summary ("Frequently resolves bugs…") overstates detection while C-1 stands.

## Not covered or reduced confidence

- **Browser rendering:** I didn't render the integrated UI. The lead reports desktop and 390px are OK. I did no a11y run.
- **Integrated UI tests:** not rerun. Lead-reported results: UI 7/7, backend 22/22, typecheck.
- **Demo-mode class:** read only (C-7).
- **Mage on live data:** live data has **0 Mage votes**, so I couldn't measure the true-positive rate on real data.

## Recommendation

Fix C-1, C-2 and C-3 before merging issue #1. They decide the headline class and contradict the feature's own disclaimer. C-4 to C-9 can follow. Scope isolation, eligibility, ties, share parity and XP/rank stability are verified.

## Policy update (lead, after this review): Mage becomes self-reported

The user superseded automatic keyword Mage. Mage now comes from a persisted per-user self-report: an AI-tool usage enum `unspecified | none | occasional | frequent | ai_first` plus an "AI engineer" boolean. It's shown as an appended "earned title · Mage". AI/systems keywords become specialties only, and those engineering items vote Warrior.

Effect on my findings:
- **C-2:** the *class* part is superseded, since keywords no longer award Mage. The specialty part remains: "AI-assisted" / "help from Copilot AI" must not produce the AI/LLM specialty, which would be tool-usage inference again.
- **C-3:** the *class* part is superseded. The specialty false positives remain Minor: `inference`, `prompt`, `model` → AI; `platform`/`pipeline` → systems if kept.
- **C-1** (Healer misses ordinary fixes) and **C-4 to C-9** are unaffected.

### Acceptance for the new preference seam (planned; not yet reviewed)

| ID | Criterion | Check |
|---|---|---|
| PREF-1 | Writing preferences is a POST/PUT with the JSON content-type gate and the same Origin/Host allowlist as `/api/sync`. Zod `.strict()` enum plus boolean. Unknown values → 400 | Route probe: bad enum, extra key, `Origin: null`, rebinding host → 4xx with no DB write |
| PREF-2 | Preferences are keyed by the canonical contributor login. Switching or syncing another user never shows or changes someone else's preferences | Two-user temp-DB probe |
| PREF-3 | The same preference-derived class/title appears in global and every repository scope. Evidence-derived mix and specialties stay scoped | Snapshot comparison across 3 scopes |
| PREF-4 | Preferences change no XP, level, rank, achievements or evidence. `scoringVersion` is unchanged | Hash progression before and after toggling |
| PREF-5 | The UI, `/about` and the share card label Mage as **self-reported**, visually distinct from evidence-derived classes. `unspecified` never shows Mage | Read the SVG text and the UI copy |
| PREF-6 | No DB access at import or build time: preference storage uses the deferred SQLite initialization | Read `db.ts`, and import the route module with no DB env set |
| PREF-7 | The default state for existing users is `unspecified` / `false`. A missing row or migration on an existing DB is non-destructive | Temp-DB copy-of-schema probe |

---

# Pass 2: self-reported Mage preferences and C-fix recheck (2026-11-20 17:36–17:45 GMT)

Method: I reran the pure-domain probe and added a vitest probe (`pref.test.ts`, reviewer scratchpad) with a fresh `mkdtemp` DB. Both `DATABASE_PATH` and `REPOQUEST_DB_PATH` were set before import and `fetch` was stubbed. I made no live PATCH or sync, no live DB access and no build. UI integration wasn't reviewed (the lead says it's still finishing).

## PREF results

| ID | Result | Evidence |
|---|---|---|
| PREF-1 input/CSRF | **PASS (M)** | `PATCH /api/profile`: text/plain → 415. `Origin: null`, rebinding host, no Host and cross-origin → 403. An extra top-level key, an extra `preference.mageActive`, a bad enum, a missing field and malformed JSON → 400. A stale username → 409. Before any sync → 409. None of the rejected calls changed any scope snapshot. `/api/sync` uses the same `request-guard.ts` |
| PREF-2 contributor isolation | **PASS (M)** | Prefs set for `u` → sync `v` → `v` shows the default (no Mage) → sync `u` again → `u` Mage is restored. A resync of `u` keeps the prefs (`saveProfile` upsert doesn't touch the preference columns) |
| PREF-3 scope parity | **PASS (M)** | `displayTitle` = scoped earned title + " · Mage" in global and both repo scopes. Each scope keeps its own earned title ("Realm Walker" global, "Merge Initiate" per repo) |
| PREF-4 no progression change | **PASS (M)** | XP, level, rank, earned title and class are identical before and after enabling Mage in all 3 scopes |
| PREF-5 self-reported labelling | **FAIL in share (M)** | The SVG line reads `Realm Walker · Mage • Adventurer • Rank E • Lv 3`. There's **no "self-reported" text anywhere in the card**, so it puts a self-declared role next to the evidence-derived class with nothing to tell them apart. The guide copy does say self-reported (`classes.ts:354,380`). UI labelling isn't reviewed yet |
| PREF-6 no build-time DB init | **PASS (R)** | `db.ts` lazily opens in `database()`. Migrations run inside `initializeDatabase()` |
| PREF-7 safe default/migration | **PASS (R+M)** | `ALTER TABLE profiles ADD COLUMN … DEFAULT 0 / 'unspecified'`. A new user defaults to unspecified/false/no Mage. Opting out (`false`/`none`) removes Mage (M) |

## C-fix recheck (M, pure-domain probe)

| # | Status | Evidence |
|---|---|---|
| C-1 Healer forms | **Partially fixed** | `Fix login redirect loop`, `Fixes #123` and `Resolve crash…` → healer. **`fix: handle null user in login` still → warrior.** Root cause: `BUG_SIGNAL` (`classes.ts:89`) ends with `\b`, and after `fix:` the next character is a space, so there's no word boundary between `:` and the space. Conventional-commit fixes (live 8Knot: `fix: start db-init in podman e2e…`) still miss Healer. Fix: move the alternatives that end on `[:\s]` out of the trailing `\b` group, e.g. `^fix(\(.+\))?:` or `\bfix(?:es\|ed\|ing)?(?:\([^)]+\))?(?=[:\s])`, and add the live title as a fixture |
| C-2 AI-assistance specialty | **Fixed** | `(AI-assisted)` and `help from Copilot AI` → warrior with no AI specialty |
| C-3 false positives | **Fixed** | Type inference, prompt user, cross-platform, data model, platform-specific → warrior with no AI or systems specialty. `RAG retrieval` → AI specialty, `CI pipeline` → systems (acceptable) |
| C-4 specialty context | **Fixed** | `next page` and `Scale chart` give no specialty. `API client` → backend only. A README link fix gives no QA |
| C-5 25% hybrid | **Fixed** | 50:1 → `specialized`. 2:1 (33%) → `hybrid` |
| C-6 empty specialties | **Fixed** | No-signal titles return `[]` |
| C-7 demo scoped derive | **Fixed (R)** | `buildDemoDashboard(scope)` derives on scope |
| C-8 dedupe | **Nit, open** | The mix classes now match for both orders, but the full output still differs between input orders when duplicate ids conflict (unreachable with the DB primary key) |
| C-9 dead `repair docs` | **Open (nit)** | `classes.ts:134` |

## New

| # | Sev | Where | Finding |
|---|---|---|---|
| P-1 | **Major** | `src/lib/domain/share-svg.ts:49` | PREF-5 above. Render e.g. `Realm Walker · Mage (self-reported)`, or a separate "Self-reported: AI engineer / frequent AI tools" line, and assert it in a share test |
| P-2 | Minor (product) | `classes.ts:323` | `aiToolUsage: "occasional"` alone activates Mage (M). Confirm with the user that occasional tool use should confer the title, since the policy said "amount of AI engineering tools". If not, raise the threshold to `frequent`/`ai_first` |
| P-3 | Minor (MODE-5) | `src/lib/domain/demo.ts:24` | Demo data uses the real login `engcaiofonseca` for invented contributions. The demo is labelled, but a downloaded demo card says `@engcaiofonseca` with fake numbers. Use an obviously fictional login (e.g. `demo-adventurer`) |

## Pass 2 status

No Blocker. Before merge: fix **P-1** (share self-reported label) and **C-1** (`fix:` prefix). Minors: P-2, P-3, C-8, C-9. Still pending: the integrated UI review (preference form copy and self-reported labelling, normalize/format alignment) once the lead says the UI is done.

---

# Pass 3: integrated UI review (2026-11-20 17:38–17:42 GMT, code read only)

Scope: `src/components/ProfilePanel.tsx`, `Dashboard.tsx` (load/refresh/savePrefs), `src/lib/client/{api,normalize,types}.ts`, `ClassSection.tsx`, `CurrentCharacter.tsx`, `/about` Mage table. **No live PATCH or writes, no browser run, no retest.** The PREF backend results from pass 2 still stand.

**Product decision recorded (lead):** any non-`unspecified`, non-`none` usage (occasional, frequent or ai_first) **or** `isAiEngineer` grants Mage, labelled self-reported. **P-2 is closed as intended.**

## Verified (R)

- **Save flow:** `savePrefs` (`Dashboard.tsx:~108`) PATCHes with the active `view.profile.username`. The server rejects a stale identity with 409 (verified in pass 2). It then calls `refresh()` for `scopeRef.current`, the *current* scope, not the one at click time.
- **Stale responses:** `load` and `refresh` share one `reqId`, so only the latest response is applied. A scope switch clears `data`, and `view` renders only when `scopeMatches(scope, data)`. A slow refresh after a save can't paint an old scope.
- **State mapping:** `normalize.ts` maps `title = displayTitle || title` and `earnedTitle = profile.title`. `preference` defaults safely to unspecified/false/not editable when the field is absent. `ProfilePanel` resyncs its draft when the server values or username change. Dirty tracking, Reset, a disabled Save while saving or clean, and `editable = preference.editable && mode === "live"` (so demo is read-only with an explanation) are all correct.
- **Errors:** field error `preference.aiToolUsage` is wired with `aria-invalid`/`aria-describedby`. Errors use `role="alert"` and saves use `role="status"`. When a save succeeds but the refetch fails, the user sees an explicit warning instead of a silent stale view.
- **Labelling:** the hero shows `displayTitle` plus a "Mage: self-reported" chip when it differs from the earned title. The preview chip reads "Mage is self-reported". `ClassSection` says Mage isn't part of the vote mix. The `/about` table comes from `isMageActive` and `AI_TOOL_USAGE_VALUES`, so it can't drift. Copy says nothing is inferred and that XP, rank and class are unchanged, which matches the PREF-4 measurement.

## Findings

| # | Sev | Where | Finding | Fix |
|---|---|---|---|---|
| U-1 | Minor (PREF-5 consistency) | `src/components/CurrentCharacter.tsx:30` (`/about` "Where you stand") | Renders `view.title` (e.g. "Realm Walker · Mage") with **no self-reported marker**, unlike the dashboard hero | Reuse the hero's chip when `title !== earnedTitle` |
| U-2 | Minor (truthfulness) | `ProfilePanel.tsx:57` | Every failed save says "Your previous settings are unchanged". On a network error or timeout (`call()` → `ApiError status 0`), the PATCH may have committed on the server | For status 0, say "may not have been saved; reload to check", or refetch before claiming "unchanged" |
| U-3 | Nit | `ProfilePanel.tsx:16` | A background refresh (for example after a sync) whose server values differ overwrites an unsaved draft without notice. That's acceptable, but worth a one-line comment or keeping the draft when dirty | — |

## Final status for issue #1 (as of 17:42)

- **Verified:** scope isolation, eligibility, ties, determinism, share class parity, XP/rank stability (pass 1). PREF-1/2/3/4/6/7 (pass 2, measured). C-2 to C-7 fixed (pass 2, measured). UI save, stale-response and scope mapping (pass 3, read).
- **Open, with fixes assigned to backend by the lead and not yet re-verified:** **C-1** (`fix:` conventional prefix, `classes.ts:89` trailing `\b`), **P-1** (share SVG lacks the self-reported label, `share-svg.ts:49`; PREF-5), **P-3** (demo uses the real login).
- **Open minors:** U-1, U-2, C-8, C-9.
- **Not run by the reviewer:** browser/mobile/a11y rendering, `next build`.
- **Recommendation:** mergeable once the C-1 and P-1 fixes land, with a fixture for `fix: start db-init…` and a share test asserting "self-reported". U-1 should be fixed in the same pass for labelling consistency.

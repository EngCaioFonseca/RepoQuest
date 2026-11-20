# RepoQuest code standards

Rules for anyone — human or agent — changing this codebase. They were set by the
issue #10 cleanup (KISS, SRP, DRY) and are checked in review. `docs/ARCHITECTURE.md`
owns the product contract and invariants; this file owns how code is written.
If the two disagree, ARCHITECTURE.md wins and this file is updated.

## Before you change anything

1. Read `AGENTS.md` (Next.js here differs from your training data — read
   `node_modules/next/dist/docs/` before touching a Next API), `docs/ARCHITECTURE.md`,
   and the module you are about to edit.
2. Search for an existing helper before writing one (see "Where things live").
3. Run `npm test` and `npm run typecheck` to get a green baseline.

## Module boundaries

| Layer | Path | May import | Must not |
| --- | --- | --- | --- |
| Contract | `src/lib/contracts.ts` | `zod` | DB, env, network, server code |
| Domain | `src/lib/domain/` | contracts, other domain | `process.env`, SQLite, `fetch`, server code |
| Server | `src/lib/server/` | contracts, domain, server | client code |
| API routes | `src/app/api/` | contracts, server | business logic of their own |
| Client/UI | `src/components/`, `src/lib/client/`, pages | contracts, client, domain (pure) | `@/lib/server/*` |

- Every production file in `src/lib/server/` starts with `import "server-only";`.
  Server tests add `vi.mock("server-only", () => ({}));`.
- Domain functions are pure and deterministic: they take evidence and explicit
  time as arguments. Derived XP is always recomputed from evidence, never stored.
- A pure helper that both client/domain and server need belongs in contracts or
  domain, not in a server module.

## Where things live (reuse, don't re-declare)

| Need | Use |
| --- | --- |
| Default repositories, track list | `DEFAULT_REPOSITORIES`, `SKILL_TRACKS` in `contracts.ts` (never re-type `["engineering","documentation","review"]`) |
| Parse + validate a JSON request body | `parseJsonBody(request, schema, message)` in `server/api-error.ts` |
| Error response | `errorJson(code, message, status, extra?)` in `server/api-error.ts` |
| A known, user-safe failure | subclass `KnownApiError` (`ScopeError`, `ProfilePreferenceError`) |
| Dashboard/share scope from a query | `parseScopeFromRequest` in `server/scope.ts` |
| Request trust / content-type guard | `rejectIfUntrustedLocalRequest`, `rejectIfNonJson` in `server/request-guard.ts` |
| GitHub REST base URL, user agent, auth headers | `server/github-api.ts` (each caller keeps its own timeout) |
| Coverage for a never-imported repository | `emptyCoverage(username, repositoryId, limitations?)` in `server/repository.ts` |
| Mage preference input type | `MagePreferenceInput` in `domain/classes.ts` |
| Global-only achievements | `GLOBAL_ONLY_ACHIEVEMENT_IDS` / `withoutGlobalOnly` in `domain/progression.ts` |

When you write the same literal, type, SQL string, or object shape a second
time, extract it. Name it after what it means, not where it is used.

## API route shape

Every handler in `src/app/api/*/route.ts` follows the same order and nothing more:

```ts
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const untrusted = rejectIfUntrustedLocalRequest(request);
  if (untrusted) return untrusted;
  const nonJson = rejectIfNonJson(request, "Sync");          // mutations only
  if (nonJson) return nonJson;

  const input = await parseJsonBody(request, schema, "Invalid … payload.");
  if ("response" in input) return input.response;

  try {
    return Response.json(await oneServerService(input.data));  // one call
  } catch (error) {
    if (error instanceof SomeKnownError) return errorJson(code, error.message, status);
    return errorJson("sync_failed", "Unexpected sync failure.", 500); // safe generic message
  }
}
```

- Validation lives in Zod schemas in `contracts.ts`; routes never hand-roll it.
- Never serialize tokens, request headers, or raw `Error` objects.
- `GET` routes never call GitHub and never write to SQLite.

## Persistence

- Access SQLite only through `database()` in `server/db.ts`; bind every value with `?`.
- One SQL string per statement — keep it as a named module constant
  (e.g. `UPSERT_EVIDENCE_SQL`) instead of copying it.
- Map DB rows through one typed row type and one mapper (`CoverageRow` → `toCoverage`
  in `server/repository.ts`).
- Evidence, coverage and checkpoints commit together inside one
  `BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK`. Upserts never overwrite `imported_at`.
- Schema changes belong in `server/db.ts`.

## Writing functions and modules

- **SRP:** a module has one reason to change. Split only when the split gives a
  clearer responsibility *and* a smaller interface — not to reduce line count.
- **KISS:** prefer a plain function to a class, a named local helper to repeated
  inline blocks (see `pauseForRequestLimit`, `resumeCheckpoint` in `sync.ts`), and
  one predicate to a predicate plus its negation.
- Collapse branches that do the same thing.
- Delete dead code and unused imports as you go; `tsc` will not flag unused locals here.
- Canonicalize GitHub identities: logins to lowercase, repository slugs matched
  case-insensitively, stored as canonical `owner/name`.
- Escape every dynamic value in SVG output (`esc()`), and only render
  `https://github.com/` links through `safeUrl()`.

## Tests

- Vitest, colocated as `*.test.ts` next to the module.
- Every extracted shared helper gets its own test (e.g. `api-error.test.ts`).
- Server tests: fresh temp `DATABASE_PATH` per test, `vi.resetModules()`,
  `fetch` stubbed with `vi.stubGlobal`, mocks restored in `afterEach`.
- When you collapse or move a branch, add a test that pins the branch's outcome
  (e.g. empty-repository sync asserts `backfillStatus === "empty"`).

## Change discipline

- Refactors are behavior-preserving: HTTP status/codes/messages, DTO shapes,
  SQLite schema, scoring and SVG output stay identical. A behavior change is a
  separate, explicitly requested change.
- Minimal diffs: do not reformat lines you did not change.
- No new dependencies without the maintainer's approval.
- Small commits, one theme each: short imperative subject, `git commit -s`.
- Done means `npm test`, `npm run typecheck` and `npm run build` all pass.

## Known follow-ups (not yet done)

- Split `server/cloud-save.ts` (save format/merge vs. lifecycle).
- Separate rules from guide content in `domain/progression.ts`.
- Break up `components/Dashboard.tsx` and `client/normalize.ts#normalizeDashboard`.
- Shorten `sync.ts#syncRepository`.
- Share one coverage initializer between `domain/demo.ts` and `emptyCoverage`.
- Factor the repeated `ALTER TABLE … ADD COLUMN` blocks in `server/db.ts`.

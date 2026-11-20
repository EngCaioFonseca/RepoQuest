# Issue #1 isolated integration gate

## Status: quiz snapshot passes; expanded mastery acceptance pending

The completed snapshot contains evidence-derived contributor classes and the
persisted, self-reported Mage preference/quiz. Clean installation, the full test
suite, and the production build passed. The user subsequently requested earned
S-rank specialty Monarchs; that expansion is not present in this snapshot and
final acceptance is deferred until the lead announces its readiness.

No live preview, live database, GitHub sync, commit, or push was performed.
Container plumbing is unchanged from the measured Podman/Compose gate in
`PACKAGING_GATE.md`, so no redundant image build was run.

Skills applied: previously loaded `karpathy-skills`, `codebase-design`, and Orca
orchestration guidance. The `orca-cli` browser guide was loaded for potential
hydrated checks; the lead is now performing the browser portion on the isolated
server rather than the capped UI worker.

## Snapshot and isolation

- Branch: `feat/1-contributor-classes`.
- Base HEAD: `f62055c95a730ebc0a42f065a208b77b0681e69a`.
- Current tracked and untracked files were copied, including new class tests,
  quiz/preference routes, profile UI, and guide changes.
- Completed snapshot: **2026-11-20 17:46:16.423345–17:46:16.450792 UTC**,
  **67 files**.
- Disposable root (`GATE`):
  `/private/var/folders/18/h5j8yr7143s1k99dktd_kyz00000gn/T/opencode/repoquest-issue1-gate-zg14v6dy`.
- Manifest: `$GATE/snapshot-manifest.json`, SHA-256
  `a3417d4c82768418b5f352e35811bf9c1da3f2de1a50e8418fa805e4d55f37b5`.
- A superseded pre-quiz snapshot is retained as `$GATE/pre-quiz-manifest.json`.

Excluded source-copy inputs: credentials and `.env*` except `.env.example`,
`node_modules`, `.next`, root `data`, `.repoquest`, database files and sidecars,
`.factory`, `.git`, `.opencode`, and TypeScript incremental output.

Install/test/build children unset `GITHUB_TOKEN` and `REPOQUEST_DB_PATH`, use a
database path under `GATE`, and set `TMPDIR=$GATE/test-tmp`. Tests thus cannot
inherit the personalized preview's database or credential settings.
`run-gate.py` records each command, UTC timestamps, exit code, and complete output.

## Completed commands and results

The driver ran:

```sh
python3 "$GATE/run-gate.py" install tests build
```

Each child used Node **24.22.3** and npm **11.20.0**, invoked as
`npx --yes --package=node@24.22.3 --package=npm@11.20.0`.

1. **`npm ci`: PASS**, exit 0, **17:46:18–17:46:23 UTC**.
   Added 62 packages, audited 63, zero reported vulnerabilities.
   A non-fatal npm warning concerned the optional `fsevents` install script.
2. **`npm test`: PASS**, exit 0, **17:46:23–17:46:26 UTC**.
   **8 test files, 72 tests passed**. This is the one complete suite run for
   this completed quiz snapshot, not the sum of overlapping worker test runs.
3. **`npm run build`: PASS**, exit 0, **17:46:26–17:46:32 UTC**.
   Next 16.4.6 compiled, typechecked, and collected page data using nine workers.
   Output: static `/` and `/_not-found`; dynamic `/about`, `/api/dashboard`,
   `/api/profile`, `/api/share`, and `/api/sync`.

The build used the initially absent
`DATABASE_PATH=$GATE/build-must-not-create/repoquest.sqlite`.
After it completed, the configured database parent, copied source `data/`, and
copied source `.repoquest/` were all still absent. Lazy initialization is retained.

Raw evidence: `install.log`, `tests.log`, `build.log`, and their corresponding
`*-result.json` files under `GATE`.

### Earlier interrupted launch

An install/tests driver launched against the superseded 17:31 snapshot was
interrupted by the harness when a user scope update arrived. No output or
step-result file was produced, and a single state check found no remaining
install/Vitest process. No pass or full-suite run is claimed for that attempt.
No production build was started until the final quiz-ready notice.

## Isolated runtime prepared for the lead

Standalone assets were assembled from the completed build, then:

```sh
env -u GITHUB_TOKEN -u REPOQUEST_DB_PATH \
  npx --yes --package=node@24.22.3 node "$GATE/server.mjs" start
```

- URL: **http://127.0.0.1:59831**.
- Owned process: **73812**; started **17:47:32.414 UTC** on Node 24.22.3.
- Database: `$GATE/runtime/profile-gate.sqlite`.
- Database was absent at server readiness.
- First `/api/dashboard` returned 200, `source: demo`, fictional
  `demo-adventurer`, and default null-quiz, inactive-Mage, noneditable preferences.
  Response saved as `$GATE/initial-demo.json`.

After that request initialized the schema, `fixture.mjs` inserted only synthetic
records in this isolated database:

- Active username **`gate-contributor`**, display name **Packaging Gate Fixture**.
- Secondary fictional profile **`gate-other`** for actor-isolation probes.
- Tracked repositories **`chaoss/8Knot`** and **`chaoss/CollectOSS`**.
- Four synthetic merged PRs: two engineering `fix:` entries and two docs entries.

The fixture uses the application's `source: live` branch solely to enable
profile editing; it is **not an actual GitHub import or personalized preview**.
No token is configured and no sync is performed.

The lead received the URL, fixture identity, repository slugs, path, and PID for
real Save/Reset/cross-scope/error/mobile checks. The server is intentionally kept
running pending the lead's completion notice; only this owned server will be
stopped at cleanup.

## Bounded independent UI/client review of the quiz snapshot

Code-read scope: `ProfilePanel`, `CurrentCharacter`, `/about`,
dashboard save/refresh flow, client preference transport and normalization, and
the shared class/quiz guide interface. This is not a browser/a11y certification.

- `ProfilePanel` consumes the shared guide's questions/options and the strict
  Zod request schema. The three required practice axes are separate from usage.
  Partial answers cannot be submitted; clearing the quiz sends explicit null.
- Default null quiz produces generic Mage only when the independent opt-in
  predicate is active; usage frequency alone does not select an advanced path.
- The draft preview uses the same `deriveMagePath`/`deriveDisplayTitle` functions.
  The guide renders each path's shared requirement string rather than hand-copied
  thresholds.
- Save is bound to the active username, and successful updates refetch the
  currently selected scope. Latest-request guarding prevents an old scope
  response replacing the current character.
- Reset restores saved values. Demo is noneditable. Save errors say the save
  was not confirmed, without falsely promising the server did not persist it.
- `CurrentCharacter` marks Mage and its path self-reported; the evidence-derived
  class and earned progression remain separate. Client normalization keeps
  `displayTitle`, earned title, preference, quiz and path distinct.
- Field-level errors, labelled radio groups, disabled/saving controls, and
  live status regions are present. Mobile layout and real save interactions
  remain the lead's browser checks.

No new critical code-read finding was identified in this bounded pass.
An external dashboard refresh can replace an unsaved draft with newly loaded
server values; this is the already documented minor UI behavior, not a new
packaging blocker.

## Remaining gate work

The expanded earned-Monarch source snapshot is not yet ready. After the lead's
notice, refresh only the disposable snapshot and run checks justified by that
new delta. Final runtime acceptance must cover all five self-reported paths,
old-request quiz preservation, explicit null clearing, actor isolation, restart
persistence, scope/share parity, unchanged XP, and the distinction from earned
S-rank specialty Monarchs. Include the lead's actual browser results, then stop
the owned fixture server after browser completion. No final `worker_done` or
release claim has been sent for this pending gate.

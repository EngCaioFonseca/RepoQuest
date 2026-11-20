# Issue #1 browser verification

## Mage quiz snapshot

The lead tested the isolated production server at `127.0.0.1:59831`, seeded by the
packaging worker with fictional contributor `gate-contributor`. No live profile
preferences or GitHub data were changed. This snapshot predates the final earned
Monarch UI; its packaging provenance is recorded in `ISSUE_1_PACKAGING.md`.

Measured through browser controls:

- Starting the optional quiz leaves answers blank and Save disabled.
- Selecting AI engineer and answering Multi-agent / Integrating / Manual checks
  previews Orchestrator from the shared rules.
- Save completes, displays `Saved.`, disables Save again, and updates the hero to
  `Realm Walker · Mage — Orchestrator` with the self-reported marker.
- Navigating to the 8Knot repository preserves saved answers and the Orchestrator
  designation while displaying that scope's own earned title, class, and XP.
- Changing an answer and using Reset restores the saved answer and disables Save.
- Clear quiz answers followed by Save removes the subclass and preserves the
  generic self-reported Mage designation.
- At 390px, the profile and scoped dashboard have no horizontal overflow.
- A one-page simulated PATCH network failure displays “Save was not confirmed”
  and instructs the user to refresh; it does not claim the stored settings are
  unchanged. The temporary fetch override was removed afterward.

Screen-reader and axe testing were not performed. Final earned-Monarch checks
are recorded separately once the integrated snapshot is available.

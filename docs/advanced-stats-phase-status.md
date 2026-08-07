# Advanced Stats — Phase & Merge Status

Branch: `agent/advanced-stats-foundation`

This file is the durable implementation checkpoint when chat context is reset.

## Merge readiness vocabulary

Every completed phase must end with one explicit branch status:

- **NOT READY** — required Advanced Stats implementation or validation is still missing.
- **TECHNICALLY READY — WAITING FOR PRIOR BRANCHES** — Advanced Stats itself has passed its final technical gate, but branches that the user wants merged first are still ahead of it in merge order.
- **READY TO MERGE** — Advanced Stats has passed its final technical gate, prerequisite/prior branches are already incorporated into `master`, the branch has been refreshed against current `master`, conflicts/regressions have been resolved, and final checks pass.

A phase being complete does **not** imply the branch is ready to merge.

Before declaring **READY TO MERGE**, always:

1. fetch/reinspect current `master`;
2. confirm the user-designated earlier branches have landed;
3. rebase/merge current `master` into this branch as appropriate;
4. resolve any overlap with systems added by those branches;
5. run the full backend/frontend validation suite;
6. inspect the final diff for unrelated changes;
7. only then explicitly tell the user the branch is ready to merge.

## Current status

- Phase 0 — branch + plan: **COMPLETE**
- Phase 1 — database + backend domain foundation: **COMPLETE**
- Phase 2 — tracking ownership + lifecycle API: **NOT STARTED**
- Phase 3 — battle ingestion + army parsing + deduplication: **NOT STARTED**
- Phase 4 — scheduled collection: **NOT STARTED**
- Phase 5 — read APIs + derived stats: **NOT STARTED**
- Phase 6 — frontend + navigation + i18n: **NOT STARTED**
- Phase 7 — Advanced Achievements integration: **BLOCKED until that work exists on master / is intentionally incorporated**
- Phase 8 — hardening + staged rollout: **NOT STARTED**

### Branch merge status

**NOT READY**

Reasons:

1. Advanced Stats still needs phases 2–8.
2. The user explicitly wants other feature branches to merge before this branch.
3. Before final merge readiness, this branch must be refreshed against the then-current `master` and overlap with those earlier branches must be revalidated.

## Phase 1 result

Implemented:

- `database/migrations/20260807_001_advanced_stats_foundation.sql`
  - `advanced_stats_tracking`
  - `advanced_stats_battles`
  - `advanced_stats_battle_units`
  - `advanced_stats_unit_totals`
  - `advanced_stats_army_totals`
  - `advanced_stats_daily`
  - `advanced_stats_tracking_gaps`
- backend-only RLS posture with anon/authenticated table access revoked;
- tracking/user uniqueness and battle fingerprint uniqueness;
- cascading child deletion;
- future worker lease fields (`locked_until`, `locked_by`);
- parser/processing version and recovery fields;
- no closed enum/check constraint for upstream `battle_type`;
- `AdvancedStatsTrackingStatus`;
- `AdvancedStatsUnitCategory`;
- `AdvancedStatsBattleProcessingStatus`;
- `AdvancedStatsModels`;
- `AdvancedStatsRepository` read/existence boundary;
- deterministic SHA-256 `BattleFingerprint`;
- JUnit coverage for deterministic fingerprints, identity changes and domain validation.

Validation performed:

- Java 21 isolated compilation of the new domain/fingerprint classes: **PASS**;
- Java 21 isolated syntax/integration compilation of the repository against the existing public `SUPABASE_Client` contract: **PASS**;
- deterministic fingerprint + validation execution harness: **PASS**;
- inspected migration against the repository migration checker rules: non-empty, no unbalanced dollar blocks, no embedded service-role value, filename orders after the required baseline migrations;
- final branch diff inspected: Phase 1 changes add only Advanced Stats migration/docs/backend/tests and do not alter existing routes/UI/auth behavior.

Environment note:

- this connector session does not expose a full repository checkout/Maven executable and no GitHub Actions run is attached to this branch head, so a literal full `mvn test` + `npm run check` invocation was not available here;
- no existing production code path was modified in Phase 1, and the newly added Java foundation was compiled separately as above;
- the full repository suite remains a mandatory final gate before any **READY TO MERGE** declaration.

## Next phase

Phase 2 — tracking ownership + lifecycle API.

Do not start battle polling yet. Phase 2 should first make start/status/pause/resume/stop/delete ownership-safe and idempotent using already verified linked Clash accounts.

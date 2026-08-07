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
- Phase 2 — tracking ownership + lifecycle API: **COMPLETE**
- Phase 3 — battle ingestion + army parsing + deduplication: **NOT STARTED**
- Phase 4 — scheduled collection: **NOT STARTED**
- Phase 5 — read APIs + derived stats: **NOT STARTED**
- Phase 6 — frontend + navigation + i18n: **NOT STARTED**
- Phase 7 — Advanced Achievements integration: **BLOCKED until that work exists on master / is intentionally incorporated**
- Phase 8 — hardening + staged rollout: **NOT STARTED**

### Branch merge status

**NOT READY**

Reasons:

1. Advanced Stats still needs phases 3–8.
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
- initial `AdvancedStatsRepository` read/existence boundary;
- deterministic SHA-256 `BattleFingerprint`;
- JUnit coverage for deterministic fingerprints, identity changes and domain validation.

Validation performed:

- Java 21 isolated compilation of the new domain/fingerprint classes: **PASS**;
- Java 21 isolated syntax/integration compilation of the repository against the existing public `SUPABASE_Client` contract: **PASS**;
- deterministic fingerprint + validation execution harness: **PASS**;
- inspected migration against the repository migration checker rules;
- Phase 1 diff contained no existing route/UI/auth behavior changes.

## Phase 2 result

Implemented:

- `AdvancedStatsAccountOwnership`
  - reads the authenticated profile's existing `users.accounts`;
  - accepts existing account tag shapes used by ClashPanel (`tag`, `playerTag`, `accountTag`, `clashTag`, nested base/account);
  - normalizes tags through the existing `CacheKeys` implementation;
  - returns 403 before any lifecycle action when the requested player is not linked;
  - does not request or re-verify a Clash token because account linking already performed that verification.
- `AdvancedStatsLifecycleService`
  - ownership-first orchestration;
  - idempotent start/status/pause/resume/stop/delete semantics;
  - pause/stop record a potential collection gap;
  - resume preserves the gap until a successful future collector can determine whether it was fully recoverable;
  - stop preserves collected statistics;
  - delete remains a separate destructive operation.
- `AdvancedStatsRepository` lifecycle writes
  - start uses an identity-only upsert against `(user_id, player_tag)` so repeated start requests do not reset existing lifecycle state;
  - lifecycle updates remain scoped by both user id and normalized player tag;
  - pause/stop clear any future worker lease and scheduled poll;
  - resume moves the tracker to `INITIALIZING`, resets failure count and makes it due for future collection;
  - delete removes only the owner's tracking row, relying on existing database cascades for child data.
- authenticated backend routes in `SUPABASE_AdvancedStats`:
  - `/AdvancedStatsTrackingStart`
  - `/AdvancedStatsTrackingGet`
  - `/AdvancedStatsTrackingPause`
  - `/AdvancedStatsTrackingResume`
  - `/AdvancedStatsTrackingStop`
  - `/AdvancedStatsDataDelete`
- `Main.java` registers the lifecycle route group.
- lifecycle API responses distinguish:
  - no tracking: `DISABLED`;
  - retained-but-stopped tracking: `STOPPED` with `trackingExists=true`;
  - active/configured lifecycle states;
  - potential tracking gaps.

Tests added:

- linked-account matching across current/legacy account shapes;
- rejection of different/invalid account tags;
- ownership failure before store access;
- lifecycle start behavior;
- pause idempotency;
- stopped -> pause conflict;
- resume idempotency;
- gap preservation on resume;
- stop without deleting history;
- stop/delete idempotency when no tracking exists;
- 404 for pause when tracking was never enabled;
- API response semantics for DISABLED / STOPPED / ACTIVE states.

### Phase 2 route-constant note

During the backend-only phases the six Advanced Stats route constants intentionally live in `SUPABASE_AdvancedStats` rather than expanding the broad shared `Config.java` surface early.

Before frontend integration in Phase 6, mirror these routes into the Java/frontend shared endpoint configuration and let `scripts/check-endpoints.mjs` validate them end-to-end. This does not change the runtime behavior of Phase 2 and avoids exposing unused frontend route constants before the UI exists.

### Phase 2 validation note

- inspected `Main.java` diff: only three lifecycle registration lines were added;
- existing auth/token verification code was not rewritten;
- existing `/PlayerBattleLog` route was not changed;
- no frontend code was changed;
- branch remains based on the same `master` revision and was 0 commits behind at the Phase 2 checkpoint;
- Java/JUnit coverage was added for the pure ownership/lifecycle/response logic;
- this connector session does not expose the repository checkout/Maven runner or pull-request workflow runs for this branch, so the full `mvn test` + `npm run check` suite remains a mandatory later gate and must be rerun before any merge-ready declaration.

## Next phase

Phase 3 — battle ingestion + army parsing + deduplication.

Phase 3 must make one newly observed attack the atomic write unit. It must not add the scheduler yet; first prove deterministic parsing, database deduplication and aggregate correctness with fixtures/retries.

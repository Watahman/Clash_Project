# Advanced Stats — Phase & Merge Status

Branch: `agent/advanced-stats-foundation`
Draft PR: `#8` (`WIP: Add Advanced Stats tracking`)

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
- Phase 3 — battle ingestion + army parsing + deduplication: **COMPLETE**
- Phase 4 — scheduled collection: **NOT STARTED**
- Phase 5 — read APIs + derived stats: **NOT STARTED**
- Phase 6 — frontend + navigation + i18n: **NOT STARTED**
- Phase 7 — Advanced Achievements integration: **BLOCKED until that work exists on master / is intentionally incorporated**
- Phase 8 — hardening + staged rollout: **NOT STARTED**

### Branch merge status

**NOT READY**

Reasons:

1. Advanced Stats still needs phases 4–8.
2. The user explicitly wants other feature branches to merge before this branch.
3. Before final merge readiness, this branch must be refreshed against the then-current `master` and overlap with those earlier branches must be revalidated.
4. Draft PR #8 exists only for CI visibility and must remain draft until the final merge gate is reached.

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
- lifecycle API responses distinguish DISABLED / STOPPED / configured states and known potential gaps.

Tests cover ownership matching/rejection, lifecycle idempotency/state transitions, gap preservation, stop-vs-delete behavior and response-state semantics.

### Phase 2 route-constant note

During the backend-only phases the six Advanced Stats route constants intentionally live in `SUPABASE_AdvancedStats` rather than expanding the broad shared `Config.java` surface early.

Before frontend integration in Phase 6, mirror these routes into the Java/frontend shared endpoint configuration and let `scripts/check-endpoints.mjs` validate them end-to-end.

## Phase 3 result

Implemented:

- `AdvancedStatsBattleLogSource`
  - reuses the existing `API_Utils` Clash request path, API-key rotation and `CachePolicy.PLAYER_BATTLE_LOG`;
  - fetches `/players/{encodedTag}/battlelog` internally;
  - does not call ClashPanel's public `/PlayerBattleLog` endpoint over HTTP.
- `AdvancedStatsBattleLogParser`
  - accepts current array/wrapped battle-log response shapes;
  - retains attack/defense, opponent, Town Hall, stars, destruction, army code and resource information;
  - supports an upstream timestamp when supplied without inventing one when absent;
  - stores `observedAt` as the fallback observation time;
  - retains both looted and available Gold/Elixir/Dark Elixir.
- stronger `BattleFingerprint`
  - excludes poll observation time so repeated polling remains stable;
  - includes an upstream timestamp when present;
  - otherwise uses stable battle content including opponent, TH, stars, destruction, army, looted resources and available resources;
  - database uniqueness on `(tracking_id, battle_fingerprint)` remains the final concurrency-safe authority.
- `ArmyShareCodeParser`
  - understands `u`, `s`, `i`, `d`, `h` sections;
  - normalizes troops, Super Troops, siege machines, spells, Clan Castle units, heroes, pets and equipment;
  - recognizes current unit metadata used by the implementation, including current Super Troops and newer units such as Ruin Witch, Sky Wagon and Angry Spell;
  - keeps stable unit keys independent from normal-army vs Clan-Castle context;
  - retains unknown IDs as `unknown_<absolute-id>`;
  - rejects malformed non-empty payloads rather than partially counting them;
  - accepts raw army payloads and valid full share links, but rejects a link without an `army` parameter;
  - produces deterministic normalized army JSON + SHA-256 army hash.
- `AdvancedStatsBattleProcessor`
  - one attack is the atomic processing unit;
  - defenses are ignored for attacking-army usage;
  - missing army code may still store battle performance without army counters;
  - malformed army payload records a `PARSER_ERROR` battle with zero aggregate mutation;
  - parser version is stored for future repair/reprocessing.
- `AdvancedStatsBattleIngestionService`
  - converts one fetched log into deterministic outcome counts;
  - passes the bootstrap-import flag through to persistence;
  - repeated-log idempotency is covered end-to-end with an in-memory duplicate guard.
- transactional database ingestion:
  - `20260807_002_advanced_stats_battle_ingestion.sql`
    - `save_advanced_stats_battle_v1`
    - `record_advanced_stats_parser_error_v1`
  - `20260807_003_advanced_stats_identity_hardening.sql`
    - persists available-loot identity fields;
    - exposes V2 service-role wrappers used by the repository.
- one successful database RPC transaction performs:
  1. new-battle insertion/deduplication;
  2. battle-unit storage;
  3. lifetime unit aggregate upserts;
  4. normalized army aggregate upsert;
  5. daily aggregate upsert;
  6. battle PROCESSED transition;
  7. `battles_processed` increment.
- a duplicate exits before aggregate mutation.
- an existing `PARSER_ERROR` row may be reprocessed by a fixed/new parser because it never contributed aggregates before successful processing.

Phase 3 focused coverage includes:

- current battle-log decoding;
- optional/compact timestamp handling;
- looted + available resource parsing;
- poll-time-independent fingerprints;
- extra timestamp-less fingerprint discrimination via available loot;
- full army composition parsing;
- Super Troop classification;
- stable keys across home/Clan Castle context;
- unknown-ID retention;
- malformed payload rejection;
- missing-army behavior;
- defense ignoring;
- player/tracking mismatch rejection;
- repeated raw battle-log ingestion: first pass inserts, second pass duplicates without a second aggregate write;
- migration transaction/dedup contract;
- repository V2 RPC contract;
- internal battle-log path encoding.

### Phase 3 upstream-data limitation

The current player battle log does not guarantee a durable battle ID or battle timestamp for every entry. If two genuinely different attacks are identical across every stable source field available to ClashPanel, the API does not provide enough information to prove they are separate. The content fingerprint is therefore best-effort, not mathematically perfect identity.

When no upstream timestamp is present, bootstrap/recent history uses the first ClashPanel observation time for its daily bucket. Later UI must not present that as a guaranteed exact historical attack timestamp.

See `docs/advanced-stats-phase3-api-notes.md` for the durable details.

### Phase 3 validation

Draft PR #8 was opened specifically to exercise the repository's normal CI without making the branch merge-ready.

CI run `31184702624` / run #390 on head `b87d48ca992473b864d85a415cf414516f290a21`:

- secret scan: **PASS**;
- `npm ci`: **PASS**;
- migration checker: **PASS**;
- endpoint checker: **PASS**;
- filename-casing checker: **PASS**;
- frontend test suite: **PASS**;
- frontend production build: **PASS**;
- static-output check: **PASS**;
- `mvn --batch-mode test`: **PASS**;
- `mvn --batch-mode package -DskipTests`: **PASS**;
- overall GitHub Actions CI: **SUCCESS**.

The Phase 3 diff was reviewed and remains scoped to Advanced Stats plus the three-line `Main.java` lifecycle registration introduced in Phase 2.

## Next phase

Phase 4 — scheduled collection.

Phase 4 should add the protected scheduler/worker entry point, due-row claiming/lease behavior, bounded polling, backoff/recovery and tracking-gap completion rules. It must reuse the Phase 3 source/parser/processor pipeline rather than creating a second ingestion path.

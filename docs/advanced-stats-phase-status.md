# Advanced Stats — Phase & Merge Status

Branch: `agent/advanced-stats-foundation`  
Draft PR: `#8` (`WIP: Add Advanced Stats tracking`)

This file is the durable implementation checkpoint when chat context is reset.

## Merge readiness vocabulary

- **NOT READY** — required Advanced Stats work or validation is still missing.
- **TECHNICALLY READY — WAITING FOR PRIOR BRANCHES** — Advanced Stats itself passed its final technical gate, but user-prioritized branches must merge first.
- **READY TO MERGE** — prior branches are on current `master`, this branch has been refreshed against that `master`, conflicts/regressions are resolved, and the final full validation passes.

A completed phase does not imply merge readiness.

Before declaring **READY TO MERGE**:

1. fetch/reinspect current `master`;
2. confirm the user-designated earlier branches have landed;
3. refresh this branch against current `master`;
4. resolve overlap with systems added by those branches;
5. run the complete backend/frontend validation suite;
6. inspect the final diff for unrelated changes;
7. complete the staged live Advanced Stats rollout checks;
8. only then explicitly tell the user the branch is ready to merge.

## Current phase status

- Phase 0 — branch + plan: **COMPLETE**
- Phase 1 — database + backend domain foundation: **COMPLETE**
- Phase 2 — tracking ownership + lifecycle API: **COMPLETE**
- Phase 3 — battle ingestion + army parsing + deduplication: **COMPLETE**
- Phase 4 — scheduled collection: **COMPLETE**
- Phase 5 — read APIs + derived stats: **COMPLETE**
- Phase 6 — frontend + navigation + i18n: **NOT STARTED**
- Phase 7 — Advanced Achievements integration: **BLOCKED until that work exists on master / is intentionally incorporated**
- Phase 8 — hardening + staged rollout: **NOT STARTED**

## Branch merge status

**NOT READY**

Reasons:

1. Advanced Stats still needs phases 6–8.
2. The user explicitly wants other feature branches merged before this branch.
3. This branch must later be refreshed against the then-current `master` and revalidated after those earlier branches land.
4. Draft PR #8 is CI/review visibility only and must remain draft.
5. Live Cloud Scheduler/Cloud Run collection remains intentionally disabled until staged rollout in Phase 8.

---

# Phase 1 — durable foundation

Implemented:

- `database/migrations/20260807_001_advanced_stats_foundation.sql`;
- backend-only RLS/service-role storage posture;
- one tracking row per `(user_id, player_tag)`;
- battle fingerprint uniqueness and cascade deletion;
- tracking, battle, unit, army, daily and gap tables;
- lease/parser/recovery fields needed by later phases;
- Advanced Stats domain enums/models;
- repository boundary;
- deterministic SHA-256 battle fingerprints;
- focused Java tests.

Phase 1 exposed no collection/UI behavior.

---

# Phase 2 — ownership-safe lifecycle

Implemented:

- existing verified linked Clash accounts are the ownership source;
- no duplicate Clash-token verification system;
- `AdvancedStatsLifecycleService`;
- idempotent start/status/pause/resume/stop/delete;
- stop preserves history; delete removes it;
- pause/stop create a potential gap;
- resume preserves that gap until collection recovery;
- explicit `USER_PAUSED` gap reason;
- authenticated lifecycle routes in `SUPABASE_AdvancedStats`;
- ownership/lifecycle/response tests.

Lifecycle routes remain backend-local until frontend integration in Phase 6.

---

# Phase 3 — battle ingestion

Implemented:

- internal player battle-log source reusing existing `API_Utils`, key rotation and cache;
- battle-log parser;
- content-based battle fingerprinting;
- `armyShareCode` parser for troops, Super Troops, spells, siege, Clan Castle, heroes, pets and equipment;
- unknown-ID retention;
- malformed payload -> `PARSER_ERROR`, never partial counters;
- missing army code may still store battle performance;
- transactional battle + unit + army + daily aggregation;
- duplicate exit before aggregate mutation;
- parser-error reprocessing support;
- repeated-log idempotency tests.

Migrations:

- `20260807_002_advanced_stats_battle_ingestion.sql`;
- `20260807_003_advanced_stats_identity_hardening.sql`.

### Upstream limitation

The player battle log does not guarantee a durable battle ID/timestamp for every entry. Timestamp-less identity is therefore best-effort using stable battle content. `observed_at` is excluded from the fingerprint and used only as the fallback time when the upstream timestamp is absent.

See `docs/advanced-stats-phase3-api-notes.md`.

---

# Phase 4 — scheduled collection

Implemented:

- `database/migrations/20260807_004_advanced_stats_scheduled_collection.sql`;
- atomic due-row claiming with `FOR UPDATE SKIP LOCKED`;
- DB leases via `locked_by` / `locked_until`;
- expired-lease `WORKER_OUTAGE` gap handling;
- `AdvancedStatsScheduledCollector`;
- `AdvancedStatsCollectorRepository`;
- bounded sequential batches;
- active/idle poll cadence;
- exponential 429/API/network/unknown backoff;
- `DEGRADED` after repeated failures;
- recovery closes durable gaps and resets `data_complete_since` after known uncertainty;
- protected `POST /InternalAdvancedStatsPoll`;
- dedicated scheduler secret;
- collection feature flag defaults to disabled;
- initial structured batch/failure logging.

Conservative defaults:

```text
batch size:              25
lease:                   600 seconds
new battle:              15 minutes
no new battle:           30 minutes
rate-limit backoff:      starts at 30 minutes
API/network backoff:     starts at 10 minutes
unknown failure backoff: starts at 15 minutes
max backoff:             4 hours
degraded threshold:      3 failures
```

Deployment/runbook:

`docs/advanced-stats-scheduler-runbook.md`

Live Cloud Scheduler -> Cloud Run validation remains intentionally deferred to Phase 8 because collection is disabled by default.

---

# Phase 5 — read APIs + derived statistics

Implemented:

## Database/read model

Migrations:

- `database/migrations/20260807_005_advanced_stats_read_models.sql`;
- `database/migrations/20260807_006_advanced_stats_exact_trends.sql`.

Phase 5 adds per-battle:

- `army_hash`;
- `normalized_army_json`.

`save_advanced_stats_battle_v3` persists that identity so army rankings can be calculated for 7/30/90-day windows rather than only from lifetime aggregate rows.

Read RPCs:

- `read_advanced_stats_overview_v1`;
- `read_advanced_stats_units_v1`;
- `read_advanced_stats_armies_v1`;
- `read_advanced_stats_battles_v1`;
- `read_advanced_stats_trends_v1`.

All read RPCs remain backend/service-role only. Execute is revoked from `public`, `anon` and `authenticated`.

Only:

```text
is_attack = true
processing_status = PROCESSED
```

contributes to the read models.

## Canonical period model

`AdvancedStatsPeriod` supports:

```text
7d
30d
90d
all
```

Missing/blank defaults to `all`.

The same exact UTC lower boundary is used for overview, units, armies, battles and trends. Trend points filter individual battles before UTC daily bucketing, so the first day may be partial but cannot include data outside the requested window.

## Ownership-safe read service

Added:

- `AdvancedStatsReadRepository`;
- `AdvancedStatsReadService`.

The read service reuses the exact Phase 2 verified-account ownership contract. The caller never supplies a tracking UUID; the backend resolves the owner's tracking row after linked-account verification.

`STOPPED` history remains readable. Delete is the only lifecycle operation that removes read data.

## Authenticated read routes

Added to `SUPABASE_AdvancedStats`:

```text
POST /AdvancedStatsOverview
POST /AdvancedStatsUnits
POST /AdvancedStatsArmies
POST /AdvancedStatsBattles
POST /AdvancedStatsTrends
```

The backend provides graph/render-ready domain data. The browser does not recalculate core statistics and these endpoints do not make extra Clash API requests.

## MVP derived statistics

Overview provides:

- attacks;
- average stars;
- average destruction;
- 3-star rate;
- Gold/Elixir/Dark Elixir tracked loot;
- favorite troop/Super Troop;
- favorite spell;
- favorite siege machine;
- favorite army and its average performance.

Units provide:

- stable key/name/category;
- total quantity;
- battles containing the unit;
- usage rate;
- first/last seen.

Armies provide:

- normalized army;
- battle count;
- average stars/destruction;
- first/last seen.

Trends provide exact-period UTC daily points.

## Battle-history pagination

Battle history uses opaque cursor pagination rather than offsets.

Stable ordering:

```text
(effective battle timestamp DESC, battle UUID DESC)
```

The API returns an opaque URL-safe Base64 `nextCursor`. The frontend must pass it back unchanged.

Battle response items expose history-safe parsed fields, including `timestampSource=BATTLE|OBSERVED`, army identity and parsed units. Raw API credentials/payload secrets are never returned.

## Phase 5 tests

Coverage includes:

- 7/30/90/all period parsing/boundaries;
- invalid periods/categories;
- owner tracking-id resolution;
- ownership failure before stats lookup;
- history remains readable when tracking is `STOPPED`;
- missing tracking -> `ADVANCED_STATS_NOT_ENABLED`;
- army/battle limit caps;
- cursor encode/decode and next-page forwarding;
- invalid cursor rejection before DB query;
- V3 ingestion RPC requirement;
- per-battle army identity migration contract;
- five read RPCs present;
- exact trends period boundary;
- service-role-only read RPC permissions.

## Phase 5 API documentation

`docs/advanced-stats-read-api.md`

## Phase 5 CI

Code/docs head before status update: `583bb7f95d4a3ecf05fecee269df92c92203797f`  
GitHub Actions run: `31188112086` / run #464

Results:

- secret scan: **PASS**;
- `npm ci`: **PASS**;
- migration checker: **PASS**;
- endpoint checker: **PASS**;
- casing checker: **PASS**;
- frontend tests: **PASS**;
- frontend production build: **PASS**;
- static-output check: **PASS**;
- `mvn --batch-mode test`: **PASS**;
- `mvn --batch-mode package -DskipTests`: **PASS**;
- overall CI: **SUCCESS**.

### Phase 5 route-constant note

The five read routes and six lifecycle routes are still backend-local intentionally. Phase 6 must mirror the complete Advanced Stats API surface into shared frontend endpoint configuration and let `scripts/check-endpoints.mjs` enforce that browser/backend contract.

---

# Next phase

Phase 6 — frontend + navigation + i18n.

Phase 6 should build the actual Advanced Stats user experience on top of the Phase 2 lifecycle and Phase 5 read APIs. It must not move domain calculations into the browser and must preserve the explicit wording that "lifetime" means tracked lifetime since Advanced Stats was enabled.

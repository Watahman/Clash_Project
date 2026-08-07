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
- Phase 6 — frontend + navigation + i18n: **COMPLETE**
- Phase 7 — Advanced Achievements integration: **BLOCKED until that work exists on master / is intentionally incorporated**
- Phase 8 — hardening + staged rollout: **NOT STARTED**

## Branch merge status

**NOT READY**

Reasons:

1. Advanced Stats still needs Phase 7 integration/reconciliation and Phase 8 hardening/staged live rollout.
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

The same exact UTC lower boundary is used for overview, units, armies, battles and trends. Trend points filter individual battles before UTC daily bucketing.

## Ownership-safe read service

Added:

- `AdvancedStatsReadRepository`;
- `AdvancedStatsReadService`.

The read service reuses the Phase 2 verified-account ownership contract. The caller never supplies a tracking UUID; the backend resolves the owner's tracking row after linked-account verification.

`STOPPED` history remains readable. Delete is the only lifecycle operation that removes read data.

## Authenticated read routes

```text
POST /AdvancedStatsOverview
POST /AdvancedStatsUnits
POST /AdvancedStatsArmies
POST /AdvancedStatsBattles
POST /AdvancedStatsTrends
```

The backend provides graph/render-ready domain data. The browser does not recalculate core statistics and these endpoints do not make extra Clash API requests.

## Battle-history pagination

Stable opaque cursor ordering:

```text
(effective battle timestamp DESC, battle UUID DESC)
```

Battle response items distinguish `timestampSource=BATTLE|OBSERVED`.

API documentation:

`docs/advanced-stats-read-api.md`

## Phase 5 CI

GitHub Actions run #464: **SUCCESS**.

Backend tests/package, frontend tests/build/static checks, migration/endpoint/casing checks and secret scan all passed.

---

# Phase 6 — frontend + navigation + i18n

Implemented:

## Private workspace route

Added:

```text
/app/advanced-stats
```

The Cloudflare worker serves it from:

```text
/subpages/advanced-stats
```

and applies the existing private-app header:

```text
X-Robots-Tag: noindex, nofollow
```

Legacy `.html` access redirects to the clean app route.

## Workspace navigation

Added `advanced-stats-navigation.js`:

- inserts an `Advanced Stats` item in a compact `Stats` section after Dashboard;
- marks `/app/advanced-stats` active;
- updates the workspace breadcrumb;
- prefetches the private page on hover/focus;
- installs only inside `workspace-app` pages.

This is intentionally isolated rather than rewriting the existing workspace shell. Phase 7/current-master reconciliation can combine its placement with Advanced Achievements if that branch lands first.

## Shared endpoint contract

The six lifecycle and five read routes are now mirrored in:

- `src/Java/Config.java`;
- `src/assets/js/Data/config.js`.

`SUPABASE_AdvancedStats` registers all browser-facing routes through `conf._EXT_ADVANCED_STATS_*`, allowing `scripts/check-endpoints.mjs` to enforce exact backend/frontend path parity.

No scheduler secret or internal collector route is exposed to the browser.

## Frontend API client

Added:

`src/assets/js/Supabase/Supabase-AdvancedStats.js`

It uses the existing authenticated `databaseRequestWithBody` path and exposes only lifecycle/read operations. The browser never calls the Clash API directly.

## Advanced Stats page

Added:

- `src/subpages/advanced-stats.html`;
- `src/assets/css/advanced-stats.css`;
- `src/assets/js/pages/advanced-stats-bootstrap.js`;
- `src/assets/js/pages/advanced-stats.js`.

The page supports:

- linked-account selection;
- no-linked-account guidance;
- start tracking;
- initializing state;
- active/paused/degraded/stopped/error states;
- refresh/pause/resume/stop/delete actions;
- stop preserving historical data;
- typed confirmation for destructive delete;
- explicit gap/completeness warnings;
- 7d / 30d / 90d / all tracked-time filters;
- attack KPI overview;
- favorite troop/spell/siege/army;
- unit-category filtering;
- favorite army composition cards;
- daily performance trend visualization;
- cursor-paginated battle timeline;
- exact battle time versus first-observed-time labeling;
- bootstrap-import labeling;
- responsive desktop/mobile layouts.

The frontend renders backend-derived statistics rather than duplicating domain calculations.

## Auth/session initialization

The page has a small bootstrap module that:

1. waits for the existing `syncAuthSession()` flow;
2. loads the existing profile overlay;
3. only then initializes the Advanced Stats page.

This avoids a race where the page could read `getCurrentUserId()` while the workspace shell was still refreshing the session.

## Linked-account compatibility

The UI consumes the existing `SupabaseUserIdCheck` profile response and supports the same account-tag shapes as backend ownership checks (`tag`, `playerTag`, `accountTag`, `clashTag`, including nested account/base objects).

Tracking remains impossible for an arbitrary unlinked player tag because backend ownership remains authoritative.

## Wording/data integrity

UI copy explicitly states:

- this is **tracked lifetime** / **all tracked time**, not reconstructed historical lifetime;
- ClashPanel cannot reconstruct complete history before tracking starts;
- troop/unit “usage” means presence in the recorded army composition, not proof that every unit was deployed;
- an `OBSERVED` timestamp means first seen by ClashPanel when the upstream exact battle timestamp was unavailable;
- known gaps are shown instead of silently claiming complete data.

`STOPPED`, `PAUSED` and `DEGRADED` states keep existing history visible.

## i18n

Added a dedicated Advanced Stats locale module with complete English/Dutch key parity. Other existing workspace languages fall back to English for these new feature-specific strings until dedicated translations are added later.

## Phase 6 tests

Added frontend coverage for:

- private/noindex page structure;
- required lifecycle controls;
- all four period filters;
- units/armies/trends/timeline surfaces;
- explicit button types;
- stop versus destructive delete separation;
- clean worker route + noindex header;
- workspace navigation route;
- complete EN/NL locale key parity;
- non-misleading tracked-lifetime wording;
- non-misleading army-composition wording.

The normal repository endpoint checker also validates all 11 Advanced Stats browser routes against registered Java handlers.

## Phase 6 CI

Final code head before this status update:

`75c56383bc2db22f1b7b8148a1abced360755d1d`

GitHub Actions run `31190535645` / run #506:

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

### Phase 6 rollout note

The UI is implemented on this WIP branch, but real scheduled collection is still deliberately disabled by default. A user could start tracking only in an environment where this branch is deployed, but the collector will not begin live periodic tracking until Phase 8 explicitly configures and enables it.

---

# Next phase

Phase 7 — Advanced Achievements integration/reconciliation.

This phase must not blindly merge the old Advanced Achievements branch. First inspect whatever version has actually landed on the then-current `master`, then reconcile navigation and ensure Advanced Achievements consumes the shared Advanced Stats processed-data/event path rather than introducing duplicate battle-log polling/parsing.

If the prerequisite Advanced Achievements work has still not landed, Phase 7 remains blocked and the branch must stay **NOT READY**.

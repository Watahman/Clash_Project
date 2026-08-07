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
3. refresh this branch against current `master`;
4. resolve overlap with systems added by those branches;
5. run the full backend/frontend validation suite;
6. inspect the final diff for unrelated changes;
7. only then explicitly tell the user the branch is ready to merge.

## Current phase status

- Phase 0 — branch + plan: **COMPLETE**
- Phase 1 — database + backend domain foundation: **COMPLETE**
- Phase 2 — tracking ownership + lifecycle API: **COMPLETE**
- Phase 3 — battle ingestion + army parsing + deduplication: **COMPLETE**
- Phase 4 — scheduled collection: **COMPLETE**
- Phase 5 — read APIs + derived stats: **NOT STARTED**
- Phase 6 — frontend + navigation + i18n: **NOT STARTED**
- Phase 7 — Advanced Achievements integration: **BLOCKED until that work exists on master / is intentionally incorporated**
- Phase 8 — hardening + staged rollout: **NOT STARTED**

### Branch merge status

**NOT READY**

Reasons:

1. Advanced Stats still needs phases 5–8.
2. The user explicitly wants other feature branches to merge before this branch.
3. Before final merge readiness, this branch must be refreshed against the then-current `master` and overlap with those earlier branches must be revalidated.
4. Draft PR #8 exists only for CI visibility and must remain draft until the final merge gate is reached.
5. Live Cloud Scheduler/Cloud Run collection remains intentionally disabled until staged rollout in Phase 8.

---

# Phase 1 result — durable foundation

Implemented:

- `database/migrations/20260807_001_advanced_stats_foundation.sql`;
- backend-only RLS posture;
- one tracking row per `(user_id, player_tag)`;
- battle fingerprint uniqueness;
- cascade deletion;
- future worker lease fields;
- tracking/unit/processing enums and domain models;
- repository read boundary;
- deterministic SHA-256 battle fingerprinting;
- focused domain/fingerprint tests.

Phase 1 did not expose collection or frontend functionality.

---

# Phase 2 result — ownership-safe lifecycle

Implemented:

- `AdvancedStatsAccountOwnership` using existing verified linked Clash accounts;
- `AdvancedStatsLifecycleService`;
- idempotent start/status/pause/resume/stop/delete semantics;
- ownership checks before lifecycle storage access;
- stop preserves collected data;
- delete remains a separate destructive operation;
- pause/stop create a potential tracking gap;
- resume preserves that gap until collection closes it;
- authenticated lifecycle routes in `SUPABASE_AdvancedStats`;
- lifecycle route registration in `Main.java`;
- lifecycle/ownership/response tests.

Phase 4 later added explicit `gap_reason=USER_PAUSED` persistence to pause/stop so historical gaps are not mislabeled as unknown.

### Phase 2 route-constant note

The lifecycle routes remain backend-local during backend-only phases. Before frontend integration in Phase 6, mirror the routes into the shared Java/frontend endpoint config and let `scripts/check-endpoints.mjs` validate them end-to-end.

---

# Phase 3 result — battle ingestion

Implemented:

- `AdvancedStatsBattleLogSource` reusing existing Clash API client/key rotation/cache;
- `AdvancedStatsBattleLogParser`;
- stronger content-based `BattleFingerprint`;
- `ArmyShareCodeParser` for troops, Super Troops, spells, siege, Clan Castle, heroes, pets and equipment;
- unknown unit-ID retention;
- malformed army codes become `PARSER_ERROR` instead of partial counters;
- missing army code can still store attack performance;
- `AdvancedStatsBattleProcessor`;
- `AdvancedStatsBattleIngestionService`;
- transactional battle + unit + army + daily aggregation RPCs;
- duplicate exit before aggregate mutation;
- parser-error reprocessing support;
- extensive parser/fingerprint/duplicate/transaction tests.

Migrations:

- `20260807_002_advanced_stats_battle_ingestion.sql`;
- `20260807_003_advanced_stats_identity_hardening.sql`.

### Phase 3 upstream-data limitation

The current player battle log does not guarantee a durable battle ID or timestamp for every entry. Timestamp-less identity is therefore best-effort using stable battle content. Two genuinely different attacks that are identical across every field supplied by the upstream API cannot be mathematically distinguished.

Poll observation time and mutable current-player/opponent metadata are excluded from the fingerprint so normal polling, Town Hall upgrades and opponent renames do not create fake new battles.

See `docs/advanced-stats-phase3-api-notes.md` for details.

### Phase 3 CI

Full repository CI passed, including Maven tests/package, frontend tests/build/static checks, migrations/endpoints/casing and secret scan.

---

# Phase 4 result — scheduled collection

Purpose: collect future attacks without depending on a user's browser or an in-process Java timer.

## Database scheduling primitives

Added:

`database/migrations/20260807_004_advanced_stats_scheduled_collection.sql`

It provides:

- `gap_reason` on `advanced_stats_tracking`;
- `claim_advanced_stats_trackers_v1`;
- `complete_advanced_stats_poll_v1`;
- `fail_advanced_stats_poll_v1`.

Claims are database-atomic:

```text
next_poll_at due
+ eligible tracking status
+ expired/no lease
+ FOR UPDATE SKIP LOCKED
+ bounded batch
```

Claimed rows receive:

- `locked_by`;
- `locked_until`;
- `last_poll_at`.

An expired non-null lease is treated as a possible `WORKER_OUTAGE` rather than silently ignored.

RPC execution is service-role only; anon/authenticated/public execution is revoked.

## Collector orchestration

Added:

- `AdvancedStatsScheduledCollector`;
- `AdvancedStatsCollectorRepository`.

One collector pass:

1. creates a unique worker ID;
2. atomically claims due trackers;
3. fetches the battle log through the existing `AdvancedStatsBattleLogSource`;
4. reuses the Phase 3 ingestion pipeline;
5. completes the tracker lease on success;
6. computes the next `next_poll_at`;
7. records failure/backoff when the fetch/process fails;
8. continues through the bounded batch instead of one tracker killing the whole pass.

No second parser or ingestion implementation was created.

## Default scheduling policy

Conservative defaults:

```text
batch size:              25 trackers
lease:                   600 seconds
new battle found:        next poll in 15 minutes
no new battle:           next poll in 30 minutes
rate-limit backoff:      starts at 30 minutes
API/network backoff:     starts at 10 minutes
unknown failure backoff: starts at 15 minutes
maximum backoff:         4 hours
degraded threshold:      3 consecutive failures
```

Failure backoff grows exponentially and is capped.

The smaller batch + longer lease is deliberate because tracker fetches are processed sequentially and an upstream request can be slow.

## Failure and recovery semantics

Failure classification:

- Clash 429 -> `RATE_LIMIT`;
- Clash 5xx / 401 / 403 -> `API_OUTAGE` for collection health;
- timeout/network I/O -> `API_OUTAGE`;
- unrelated/database/unclassified failure -> `UNKNOWN`.

A single failure does not set `ERROR`.

At the configured consecutive-failure threshold:

- tracker becomes `DEGRADED`;
- an uncertainty gap is opened conservatively from the last successful poll/tracking start;
- later success closes the gap into `advanced_stats_tracking_gaps`;
- `consecutive_failures` resets to zero;
- status returns to `ACTIVE`;
- `data_complete_since` restarts at recovery time after a known gap.

User pause/stop gaps are explicitly labeled `USER_PAUSED` and follow the same durable gap-history mechanism after resume succeeds.

## Protected Cloud Scheduler trigger

Added:

- `AdvancedStatsCollectorConfig`;
- `AdvancedStatsInternalPoll`;
- route registration in `Main.java`.

Internal route:

```text
POST /InternalAdvancedStatsPoll
```

Security behavior:

- collector defaults to disabled;
- disabled endpoint returns 404;
- enabling without a scheduler secret returns 503;
- enabled requests require `X-ClashPanel-Scheduler-Secret`;
- scheduler secret comparison is constant-time;
- no secret is exposed to frontend/runtime config;
- the route is not a normal authenticated user endpoint.

Default rollout flag:

```text
ADVANCED_STATS_COLLECTION_ENABLED=false
```

Therefore merging/deploying the WIP backend cannot accidentally start collection by itself.

## Operational visibility

Each batch logs:

```text
advanced_stats_poll_batch
```

and returns counters for:

- claimed trackers;
- succeeded/failed trackers;
- inserted battles;
- duplicate battles;
- parser errors;
- rate-limited trackers;
- lease finalization failures;
- overall batch health.

Per-tracker/finalization failures have separate log prefixes.

Deployment instructions and environment variables are documented in:

`docs/advanced-stats-scheduler-runbook.md`

## Phase 4 focused tests

Coverage includes:

- database migration requires `FOR UPDATE SKIP LOCKED`;
- expired leases are represented as worker-outage uncertainty;
- service-role-only collector RPC contract;
- active vs idle next-poll cadence;
- bootstrap completion behavior;
- Clash 429 classification/backoff;
- repeated exponential backoff;
- network/API outage classification;
- database 429 is not mislabeled as a Clash rate limit;
- max-backoff cap;
- failure-finalization visibility;
- empty claim is a healthy no-op;
- collector config defaults to disabled;
- internal endpoint requires dedicated scheduler secret;
- lifecycle pause/stop retain explicit gap reasons.

## Phase 4 CI

CI run `31186491626` / run #430 on code head `ecfcf204320b2811ac8903836fb4a5706a585630`:

- secret scan: **PASS**;
- `npm ci`: **PASS**;
- migration checker: **PASS**;
- endpoint checker: **PASS**;
- filename-casing checker: **PASS**;
- frontend tests: **PASS**;
- frontend production build: **PASS**;
- static-output check: **PASS**;
- `mvn --batch-mode test`: **PASS**;
- `mvn --batch-mode package -DskipTests`: **PASS**;
- overall GitHub Actions CI: **SUCCESS**.

### Live-infrastructure validation note

The code path is deliberately disabled until Phase 8. This environment does not have the user's Google Cloud credentials/Cloud Scheduler control plane, so a real Cloud Scheduler -> Cloud Run developer-account cycle was **not** activated from this implementation session.

Before Advanced Stats can pass its final technical/merge gate, Phase 8 must perform the runbook's staged live validation:

1. deploy with collection disabled;
2. configure the scheduler secret;
3. create the Scheduler job;
4. enable one developer-owned tracker;
5. enable collection;
6. observe multiple real scheduled cycles;
7. confirm retries/duplicates/leases/gaps in the production-like database/logs.

This deferred live check does not make Phase 4 code incomplete, but it remains a mandatory final rollout gate.

---

# Next phase

Phase 5 — read APIs + derived statistics.

Phase 5 should expose backend-owned, graph-ready responses for overview, units, armies, battle history and trends. It must read the aggregates/history created by Phases 3–4 and must not make the frontend recalculate domain statistics or trigger extra Clash API requests.

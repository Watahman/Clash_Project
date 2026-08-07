# Advanced Stats — Phase 8 staged rollout gate

This checklist is mandatory before `agent/advanced-stats-foundation` may be called merge-ready.

## Safety switches

New enrollment and background collection are independent server-side controls.

```text
ADVANCED_STATS_PUBLIC_ENROLLMENT_ENABLED=false
ADVANCED_STATS_ROLLOUT_USER_IDS=<comma-separated developer user UUIDs>
ADVANCED_STATS_COLLECTION_ENABLED=false
ADVANCED_STATS_SCHEDULER_SECRET=<strong Secret Manager value>
```

Safe default with all variables absent:

- no account may start new Advanced Stats tracking;
- the scheduled collector is disabled;
- existing tracking lifecycle data can still be read, paused, stopped or deleted;
- no scheduler secret is accepted.

For the first live stage, keep public enrollment disabled and put only the developer account UUID in `ADVANCED_STATS_ROLLOUT_USER_IDS`.

Do not put user UUID allowlists or scheduler secrets in frontend files or public runtime config.

## Completed pre-live validation

Completed on the active production Supabase project on 2026-08-07:

- Advanced Achievements foundation migration applied;
- all eight Advanced Stats migrations applied in order;
- all 9 required Achievement/Advanced Stats tables verified;
- RLS verified on all 9 tables;
- direct CRUD denied to `anon` and `authenticated`;
- required CRUD available to `service_role`;
- all 17 required backend RPC signatures verified;
- backend-only RPC execute denied to `anon` and `authenticated`;
- required RPC execute available to `service_role`;
- browser roles cannot create objects in schema `public`;
- all 9 required migration names verified in Supabase migration history;
- direct PostgreSQL role tests confirmed real `permission denied` behavior for browser roles;
- migration SQL passed a replay/idempotency pattern audit.

Rollback-only synthetic production DB tests additionally verified:

- battle ingestion and duplicate idempotency;
- daily/unit/army aggregates and `battles_processed`;
- Advanced Stats -> Achievement reconciliation;
- exclusive tracker leases;
- expired lease reclaim + `WORKER_OUTAGE` gap;
- RATE_LIMIT failures -> `DEGRADED` -> successful recovery;
- all-time/7d/30d read models;
- favorite unit/army ranking;
- cursor pagination, including identical timestamps;
- observed-time fallback;
- exact trends and Achievement metrics;
- parser-error isolation and one-time reprocessing;
- STOPPED history preservation;
- tracking/user delete cascades;
- destructive Advanced Stats deletion resets only its derived Achievement metrics and preserves unrelated Achievement progress;
- repeated feature-level deletion is idempotent;
- constraint/abuse rejection;
- monotonic Achievement progress/unlock/source timestamp behavior.

A deeper parser/fingerprint pass also added regressions for non-finite numeric inputs, randomized army-order normalization, unknown IDs, timestamp-less fingerprint stability and a large deterministic identity sample.

Pre-live frontend/privacy hardening also covers:

- complete Advanced Stats locale parity for English, Dutch, French, German and Spanish;
- translated dynamic army/category labels;
- translated semantic accessibility labels;
- private Advanced Stats/internal-poll API responses forced to `Cache-Control: no-store`;
- Privacy/Terms wording aligned with opt-in collection, known gaps, stop/pause retention and destructive delete semantics.

Reusable commands:

```text
npm run check:advanced-stats-db
npm run smoke:advanced-stats-db
```

These commands require an explicit `SUPABASE_DB_URL`; they are deliberately not part of normal CI so GitHub Actions never connects to production automatically.

The remaining Phase 8 gate is therefore external runtime validation, not schema/state-machine creation.

## Deployment order

1. Production database migrations — **COMPLETE**.
2. Production DB schema/security/rollback behavior validation — **COMPLETE**.
3. Deploy the exact candidate backend with collection and public enrollment still disabled.
4. Confirm `/health` and `/ready` are healthy.
5. Confirm `POST /InternalAdvancedStatsPoll` behaves as disabled while `ADVANCED_STATS_COLLECTION_ENABLED=false`.
6. Configure `ADVANCED_STATS_SCHEDULER_SECRET` through Secret Manager.
7. Set `ADVANCED_STATS_ROLLOUT_USER_IDS` to only the developer account.
8. Start one developer-owned linked Clash account through the normal authenticated UI/API.
9. Confirm a user outside the allowlist cannot start tracking.
10. Enable `ADVANCED_STATS_COLLECTION_ENABLED=true`.
11. Trigger/observe several real scheduler cycles before expanding the rollout.

Do not enable `ADVANCED_STATS_PUBLIC_ENROLLMENT_ENABLED=true` during this stage.

## Mandatory real-data checks

The database semantics below have synthetic coverage, but the real Clash payload/network path still needs observation. Verify:

- the first real observation inserts each new battle once;
- a repeated real battle-log payload is recognized as duplicate;
- `last_successful_poll_at` advances after successful real cycles;
- `next_poll_at` follows active/idle cadence in deployed runtime;
- exact `tracked_attack_count`, `tracked_star_count` and `tracked_three_star_count` reconcile from real battles;
- real parser/unknown-ID output is inspected;
- actual Clash API 429/5xx/network behavior maps to the expected collector classification/backoff;
- request volume and row growth match expectations.

## External-runtime checks that cannot be replaced by DB simulation

Before wider rollout, validate in the deployed candidate:

- Cloud Scheduler can authenticate to and invoke the Cloud Run internal poll endpoint;
- collection-disabled behavior is correct in the deployed service;
- an actual Cloud Run restart/instance replacement recovers cleanly;
- overlapping real HTTP poll calls do not create duplicate collection work;
- Secret Manager/env rollout values are wired to the intended revision;
- actual Clash API key rotation/cache/fresh-fetch behavior works from Cloud Run;
- real upstream latency/rate limiting/outages produce expected logs and backoff;
- no runtime-only serialization/configuration/CORS/proxy issue blocks authenticated lifecycle/read routes.

## Operational signals to record

For every staged observation window, record at least:

```text
active/initializing/degraded trackers
poll batches total
trackers claimed/succeeded/failed
new battles
duplicate battles
parser errors
rate-limited polls
finalization failures
oldest active last_successful_poll_at
open/closed known gaps
advanced_stats_battles row count and growth
advanced_stats_battle_units row count and growth
```

The internal poll response already returns batch counters including `claimed`, `succeeded`, `failed`, `insertedBattles`, `duplicateBattles`, `parserErrors`, `rateLimited` and `finalizeFailures`.

## Expansion gate

Only expand from the developer account when all of the following are true:

- several real attack cycles completed without unexplained data loss;
- real duplicate replay is idempotent;
- parser/unknown-ID output has been inspected;
- request volume and database growth are acceptable;
- deployed Cloud Scheduler/Cloud Run invocation is stable;
- restart/overlap behavior has been observed in the real runtime;
- full backend/frontend CI is green on the exact rollout candidate.

Then add a small explicit set of user UUIDs to `ADVANCED_STATS_ROLLOUT_USER_IDS` and repeat the observation window.

`ADVANCED_STATS_PUBLIC_ENROLLMENT_ENABLED=true` is the final public-enrollment switch and must remain false until that small-subset stage is healthy.

## Current environment note

The production schema, permissions, constraints, aggregates, leases, failure/recovery state machine, read models, cascades, deletion reset and retry semantics now have direct rollback-only database validation.

Phase 8 remains incomplete only for behavior that depends on the deployed backend/external environment: Cloud Run revision/runtime behavior, Cloud Scheduler authentication/invocation, real Clash API payloads/network behavior and a real observation window.

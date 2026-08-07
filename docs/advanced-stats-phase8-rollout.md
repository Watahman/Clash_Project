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

## Completed pre-live database validation

Completed on the active production Supabase project on 2026-08-07:

- Advanced Achievements foundation migration applied;
- all seven Advanced Stats migrations applied in order;
- all 9 required Achievement/Advanced Stats tables verified;
- RLS verified on all 9 tables;
- direct CRUD denied to `anon` and `authenticated`;
- required CRUD available to `service_role`;
- required backend RPCs verified;
- backend-only RPC execute denied to `anon` and `authenticated`;
- required RPC execute available to `service_role`;
- all 8 required migration names verified in Supabase migration history.

A transaction-only production DB smoke test also passed:

- first battle persisted once;
- duplicate fingerprint did not increment battle/aggregate counts twice;
- daily, unit and army aggregates were correct;
- `battles_processed` incremented once;
- Advanced Stats -> Achievement reconciliation succeeded;
- the transaction was rolled back;
- follow-up checks confirmed zero synthetic tracking, battle or achievement rows remained.

Reusable scripts:

```text
scripts/check-advanced-stats-schema.sql
scripts/check-advanced-stats-schema.mjs
scripts/smoke-test-advanced-stats-db.sql
```

The remaining Phase 8 gate is therefore runtime validation, not schema creation.

## Deployment order

1. Production database migrations — **COMPLETE**.
2. Deploy the exact candidate backend with collection still disabled.
3. Confirm `/health` and `/ready` are healthy.
4. Confirm `POST /InternalAdvancedStatsPoll` behaves as disabled while `ADVANCED_STATS_COLLECTION_ENABLED=false`.
5. Configure `ADVANCED_STATS_SCHEDULER_SECRET` through Secret Manager.
6. Set `ADVANCED_STATS_ROLLOUT_USER_IDS` to only the developer account.
7. Start one developer-owned linked Clash account through the normal authenticated UI/API.
8. Confirm no unrelated user can start tracking.
9. Enable `ADVANCED_STATS_COLLECTION_ENABLED=true`.
10. Trigger/observe several real scheduler cycles before expanding the rollout.

Do not enable `ADVANCED_STATS_PUBLIC_ENROLLMENT_ENABLED=true` during this stage.

## Mandatory real-data checks

Observe multiple real attacks, including at least one repeated battle-log payload. Verify:

- the first observation inserts each new battle once;
- a repeated log increments duplicate counters but does not increase durable battle/aggregate counts;
- `last_successful_poll_at` advances after successful cycles;
- `next_poll_at` follows active/idle cadence;
- `locked_by` and `locked_until` clear after successful/failing completion;
- exact `tracked_attack_count`, `tracked_star_count` and `tracked_three_star_count` reconcile into Advanced Achievements;
- retrying after a temporary Achievement reconciliation failure converges without a second battle insert;
- parser errors do not partially write army counters;
- unknown unit IDs remain stored with stable unknown keys for later remapping.

## Failure/recovery checks

Before wider rollout, deliberately validate these non-destructive scenarios in the staged environment:

- overlapping internal poll calls: only one worker owns a tracker at a time;
- expired lease/restart simulation: the next worker can reclaim the tracker and a `WORKER_OUTAGE` uncertainty gap is represented;
- temporary 429/5xx/network failures: backoff increases and repeated failures can become `DEGRADED`;
- recovery after a known gap closes a durable gap and resets `data_complete_since` conservatively;
- pause prevents scheduled collection and preserves history;
- stop preserves history but stops future collection;
- delete removes the tracking row and cascades Advanced Stats history;
- deleting the owning user cascades their Advanced Stats tracking through the `users(id)` foreign key.

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
- duplicate replay is idempotent;
- parser/unknown-ID output has been inspected;
- request volume and database growth are acceptable;
- stop/delete/account-delete semantics are verified;
- known-gap semantics are verified;
- overlapping/restarted worker behavior is verified;
- full backend/frontend CI is green on the exact rollout candidate.

Then add a small explicit set of user UUIDs to `ADVANCED_STATS_ROLLOUT_USER_IDS` and repeat the observation window.

`ADVANCED_STATS_PUBLIC_ENROLLMENT_ENABLED=true` is the final public-enrollment switch and must remain false until that small-subset stage is healthy.

## Current environment note

The production database schema and transactional DB contract are now validated. Repository tests and the rollback DB smoke test are still not substitutes for the runtime gate.

Phase 8 remains incomplete until the candidate backend is deployed and real Cloud Run + Clash API + Scheduler cycles have been observed with the developer-only rollout controls above.

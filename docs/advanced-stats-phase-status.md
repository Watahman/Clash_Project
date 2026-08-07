# Advanced Stats — Phase & Merge Status

Branch: `agent/advanced-stats-foundation`  
Draft PR: `#8` (`WIP: Add Advanced Stats tracking`)  
Updated: 2026-08-07

This is the durable phase checkpoint. Detailed API/parser/scheduler notes remain in the dedicated Advanced Stats docs.

## Merge readiness vocabulary

- **NOT READY** — a mandatory implementation or live validation gate is still missing.
- **READY TO MERGE** — the exact merge candidate has passed repository CI, database validation and the staged real runtime rollout.

A green CI run or a deployed database schema alone does not make the branch merge-ready.

## Current phase status

- Phase 0 — branch + plan: **COMPLETE**
- Phase 1 — database + backend domain foundation: **COMPLETE**
- Phase 2 — tracking ownership + lifecycle API: **COMPLETE**
- Phase 3 — battle ingestion + army parsing + deduplication: **COMPLETE**
- Phase 4 — scheduled collection: **COMPLETE**
- Phase 5 — read APIs + derived stats: **COMPLETE**
- Phase 6 — frontend + navigation + i18n: **COMPLETE**
- Phase 7 — Advanced Achievements integration: **COMPLETE**
- Phase 8 — code/static hardening: **COMPLETE**
- Phase 8 — production database migrations: **COMPLETE**
- Phase 8 — transactional production DB smoke test: **COMPLETE**
- Phase 8 — real Cloud Run / Clash API / Scheduler rollout: **PENDING**

## Integrated prerequisite state

Before Phase 7, current `Development` was synced into this branch after these user-prioritized branches had landed there:

1. Bracket Generator redesign
2. War Operation Board Webby redesign
3. Entity Guesser / Higher or Lower Minigames
4. Advanced Achievements

Advanced Stats therefore builds on the actual integrated Achievement implementation rather than a stale parallel branch.

## Phase 7 result

Advanced Stats is the only battle-log/history collector.

Advanced Achievements consumes exact persisted Advanced Stats metrics for:

- tracked attack count;
- tracked star count;
- tracked three-star count.

The reconciliation path is monotonic and retry-safe. A duplicate-only later poll can retry Achievement reconciliation without inserting the battle or aggregate counters twice.

Migration:

`database/migrations/20260807_007_advanced_stats_achievements_integration.sql`

## Phase 8 hardening result

Implemented runtime controls:

```text
ADVANCED_STATS_COLLECTION_ENABLED=false
ADVANCED_STATS_PUBLIC_ENROLLMENT_ENABLED=false
ADVANCED_STATS_ROLLOUT_USER_IDS=<explicit UUID allowlist>
ADVANCED_STATS_SCHEDULER_SECRET=<Secret Manager value>
```

Behavior:

- background collection defaults off;
- new enrollment defaults closed;
- a small server-side UUID allowlist supports staged rollout;
- public enrollment requires a separate explicit switch;
- existing status/pause/resume/stop/delete actions remain available when enrollment is closed;
- scheduler requests require the dedicated secret;
- collector claims use leases and `FOR UPDATE SKIP LOCKED`;
- expired leases produce conservative `WORKER_OUTAGE` gap semantics;
- rate limits/outages use bounded backoff and can degrade a tracker after repeated failures.

## Production database state

On 2026-08-07 the active production Supabase project received the Advanced Achievements foundation plus all seven Advanced Stats migrations.

Verified after deployment:

- all 9 required tables exist;
- RLS is enabled on all 9;
- `anon` and `authenticated` have no direct CRUD access;
- `service_role` has required CRUD access;
- all required RPCs exist;
- backend-only RPC execute is denied to `anon`/`authenticated` and granted to `service_role`;
- all 8 required migration names exist in `supabase_migrations.schema_migrations`.

Reusable verifier:

- `scripts/check-advanced-stats-schema.sql`
- `scripts/check-advanced-stats-schema.mjs`
- `npm run check:advanced-stats-db`

The npm DB check is intentionally not part of normal CI and only runs when a developer explicitly provides `SUPABASE_DB_URL`.

## Transactional database smoke test

A rollback-only smoke test was executed successfully against the deployed production schema.

Verified:

- first synthetic battle insert;
- duplicate replay idempotency;
- daily aggregates;
- unit aggregates;
- army aggregates;
- tracking `battles_processed`;
- Advanced Stats -> Achievement reconciliation.

After rollback, follow-up checks confirmed zero synthetic tracking, battle and achievement rows remained.

Reusable script:

`scripts/smoke-test-advanced-stats-db.sql`

## Repository validation

The integrated Phase 7/8 code candidate has passed the complete repository gate covering:

- Maven tests and package;
- frontend/Vitest tests;
- migration ordering;
- endpoint parity;
- filename casing;
- production build;
- static output;
- SEO checks;
- secret scan.

Any later release/documentation/script commit must keep this normal CI green on the final candidate.

## Branch merge status

**NOT READY**

Only one material gate remains: the staged real runtime rollout.

Before changing this status to **READY TO MERGE**:

1. deploy the exact candidate backend to Cloud Run with collection disabled;
2. verify health/ready and disabled internal polling behavior;
3. configure the scheduler secret and developer-only rollout UUID;
4. start one verified developer-owned Clash account;
5. enable collection;
6. observe multiple real scheduler cycles and real attacks;
7. verify repeated battle-log payload idempotency;
8. verify real Achievement reconciliation;
9. verify lease overlap/restart recovery, 429/5xx backoff and gap semantics;
10. verify pause/stop/delete behavior and database/request growth;
11. rerun full repository CI on the exact merge candidate;
12. inspect final PR diff and merge only then.

See:

- `docs/advanced-stats-current-integration-status.md`
- `docs/advanced-stats-phase8-rollout.md`
- `docs/advanced-stats-scheduler-runbook.md`
- `docs/advanced-stats-read-api.md`
- `docs/advanced-stats-phase3-api-notes.md`

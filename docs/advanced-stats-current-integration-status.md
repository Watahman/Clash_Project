# Advanced Stats — Current integration checkpoint

Updated: 2026-08-07
Branch: `agent/advanced-stats-foundation`
PR: #8 (draft, target `Development`)

## Integrated prerequisite work

The current `Development` baseline was synced into this branch after these integrations landed there:

1. Bracket Generator redesign
2. War Operation Board Webby redesign
3. Entity Guesser / Higher or Lower Minigames
4. Advanced Achievements

The sync was validated through PR #12 before it was merged into this branch.

## Phase status

- Phase 0 — COMPLETE
- Phase 1 — COMPLETE
- Phase 2 — COMPLETE
- Phase 3 — COMPLETE
- Phase 4 — COMPLETE
- Phase 5 — COMPLETE
- Phase 6 — COMPLETE
- Phase 7 — COMPLETE
- Phase 8 code/static hardening — COMPLETE
- Phase 8 production database deployment — COMPLETE
- Phase 8 schema/security verification — COMPLETE
- Phase 8 transactional database behavior suite — COMPLETE
- Phase 8 parser/fingerprint robustness pass — COMPLETE
- Phase 8 real Cloud Run / Clash API / Scheduler rollout — NOT COMPLETE

## Phase 7 result

Advanced Stats remains the only battle-log/history source.

Advanced Achievements consumes exact persisted Advanced Stats aggregates for:

- tracked attacks;
- tracked stars;
- tracked three-star attacks.

There is no second Achievement battle-log poller.

Reconciliation is monotonic and retry-safe. If a battle was already durably inserted but Achievement reconciliation temporarily fails, a later duplicate-only poll retries reconciliation without writing the battle or aggregates twice.

## Phase 8 hardening result

Implemented server-side rollout controls:

- `ADVANCED_STATS_COLLECTION_ENABLED=false` by default;
- `ADVANCED_STATS_PUBLIC_ENROLLMENT_ENABLED=false` by default;
- `ADVANCED_STATS_ROLLOUT_USER_IDS` for developer/small-subset enrollment;
- scheduler secret required for internal poll authorization;
- existing status/pause/resume/stop/delete operations remain available when new enrollment is closed.

See `docs/advanced-stats-phase8-rollout.md` for the mandatory live checklist.

## Production database deployment

On 2026-08-07 the active production Supabase project received:

- `advanced_achievements_foundation`;
- `advanced_stats_foundation`;
- `advanced_stats_battle_ingestion`;
- `advanced_stats_identity_hardening`;
- `advanced_stats_scheduled_collection`;
- `advanced_stats_read_models`;
- `advanced_stats_exact_trends`;
- `advanced_stats_achievements_integration`.

Verified after deployment:

- all 9 required Achievement/Advanced Stats tables exist;
- RLS is enabled on all 9 tables;
- `anon` and `authenticated` have no direct CRUD access;
- `service_role` has required CRUD access;
- all 16 required Advanced Stats/Achievement RPC signatures exist;
- `anon` and `authenticated` cannot execute backend-only RPCs;
- `service_role` can execute them;
- all 8 migration names are present in Supabase migration history.

Negative role tests were also executed directly with PostgreSQL roles: forbidden table reads and RPC execution returned `permission denied` for `anon` / `authenticated`, while `service_role` retained access.

The Supabase linter reports `RLS enabled, no policy` as informational for these backend-only tables. That is intentional because browser roles receive no direct table access.

## Extended rollback-only production database validation

All tests below used synthetic users/trackers and ended with `ROLLBACK`.

### Base ingestion / aggregation

Verified:

- first battle insert succeeds;
- replay of the same fingerprint is deduplicated;
- daily attack/star/three-star aggregates update once;
- unit totals update once;
- army totals update once;
- `battles_processed` updates once;
- Advanced Stats -> Achievement reconciliation writes expected progress.

### Scheduler lease / failure state machine

Verified:

- only one worker can own a live lease;
- a second worker cannot claim the same tracker while the lease is active;
- an expired lease can be reclaimed;
- reclaim creates a conservative `WORKER_OUTAGE` gap;
- success closes the durable gap and clears the lease;
- repeated RATE_LIMIT failures progress to `DEGRADED` at the configured threshold;
- recovery resets failures/status, closes the gap and conservatively advances `data_complete_since`.

### Read model / history behavior

Verified with multiple synthetic battles across time windows:

- all-time, 7d and 30d overview values;
- exact stars/destruction/loot calculations;
- favorite unit ranking;
- army ranking;
- cursor pagination and ordering;
- `OBSERVED` timestamp fallback when upstream battle time is absent;
- exact trend filtering/bucketing;
- Advanced Achievement metric aggregates;
- duplicate replay leaves aggregates unchanged;
- `PARSER_ERROR` does not partially aggregate;
- later reprocessing of the same fingerprint aggregates exactly once.

### Lifecycle / cascade semantics

Verified:

- `STOPPED` preserves readable history;
- deleting a tracking row cascades battles, units, totals, daily rows and gaps;
- deleting the owning user cascades tracking and its Advanced Stats history.

### Constraint / abuse behavior

Verified:

- invalid player tags rejected;
- malformed fingerprint lengths rejected;
- tracking/player identity mismatch rejected;
- invalid stars/destruction rejected;
- invalid unit categories / non-positive quantities fail atomically;
- malformed unit JSON shape is rejected;
- negative loot is normalized to zero by the database contract;
- Achievement reconciliation is monotonic: progress/source timestamp cannot move backwards and unlock remains sticky;
- unsupported Achievement metrics / invalid source timestamps are rejected.

## Parser/fingerprint hardening audit

A deeper Java audit found one concrete edge case: non-finite destruction values (`NaN`, `+Infinity`, `-Infinity`) could pass the previous range-only model validation because comparisons with `NaN` are false.

Fixed in `AdvancedStatsModels` so non-finite destruction/aggregate values are rejected at the domain boundary.

Added regressions for:

- non-finite numeric values;
- 250 deterministic army-order permutations producing the same normalized army hash;
- 200 unknown troop/spell ID pairs retaining stable unknown keys;
- 500 different observation times keeping a timestamp-less battle fingerprint stable;
- 2,000 distinct stable identity values producing distinct fingerprints in the regression sample;
- delimiter/backslash escaping in fingerprint canonicalization.

GitHub Actions run `31201263958` / #595 passed fully after this code hardening: frontend checks/tests/build/static/SEO, backend tests/package and secret scan all passed.

## Migration replay audit

A read-only audit of the deployed migration SQL confirmed replay-safe DDL patterns:

- all Advanced Stats/Achievement `CREATE TABLE` statements use `IF NOT EXISTS`;
- relevant indexes use `IF NOT EXISTS`;
- added columns use `IF NOT EXISTS`;
- functions use `CREATE OR REPLACE` or an explicit safe drop before recreation;
- the scheduled-collection constraint is dropped with `IF EXISTS` before being re-added.

This was a static replay/idempotency audit, not a second production migration registration.

## Reusable verification tooling

Repository scripts now include:

- `scripts/check-advanced-stats-schema.sql`;
- `scripts/check-advanced-stats-schema.mjs`;
- `scripts/smoke-test-advanced-stats-db.sql`;
- `scripts/smoke-test-advanced-stats-state-machine.sql`;
- `scripts/smoke-test-advanced-stats-read-models.sql`;
- `scripts/smoke-test-advanced-stats-constraints.sql`;
- `scripts/smoke-test-advanced-stats-cascades.sql`;
- `scripts/smoke-test-advanced-stats-db.mjs`.

Commands:

```text
npm run check:advanced-stats-db
npm run smoke:advanced-stats-db
```

Both require an explicit `SUPABASE_DB_URL` and are intentionally separate from normal CI so GitHub Actions never connects to production by accident.

## Final diff/code audit

The PR file scope was reviewed against `Development`.

Shared-file changes are limited to the expected integration surfaces: backend/frontend route registration, workspace routing/navigation/i18n, Achievement battle-goal integration, package verification commands, migrations/docs/tests and Advanced Stats feature files. No unrelated feature rewrite or exposed scheduler secret was found.

Future integration note: if ClashPanel later adds a backend operation that unlinks a Clash account from `users.accounts`, that flow must define what happens to an active Advanced Stats tracker (stop/delete it or retain owner-management). No such unlink backend route exists in the current code, so no speculative cross-feature change was introduced here.

## Remaining blocker before merge

The remaining mandatory gate is the real staged runtime rollout:

1. deploy the candidate backend to Cloud Run with collection disabled;
2. configure scheduler secret + developer-only rollout allowlist;
3. start tracking for one verified developer-owned account;
4. enable collection;
5. observe real Clash battle-log polls and repeated payloads;
6. confirm real Cloud Run/Scheduler invocation, process restart/overlap behavior and network/rate-limit handling;
7. inspect real parser/unknown-ID output and real Achievement reconciliation;
8. confirm request/database growth is acceptable;
9. rerun the complete repository validation on the exact merge candidate.

Many state-machine behaviors have now been proven directly against production PostgreSQL with rollback-only synthetic fixtures. The remaining gate specifically covers behavior that cannot be proven without the deployed backend, external scheduler, real Clash API traffic and an observation window.

PR #8 must remain draft and must not be merged into `Development` until this live runtime gate is complete.

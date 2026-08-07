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
- Phase 8 transactional database smoke test — COMPLETE
- Phase 8 real Cloud Run / Clash API / Scheduler rollout — NOT COMPLETE

## Phase 7 result

Advanced Stats remains the only battle-log/history source.

Advanced Achievements consumes exact persisted Advanced Stats aggregates for:

- tracked attacks;
- tracked stars;
- tracked three-star attacks.

There is no second Achievement battle-log poller.

Reconciliation is monotonic and retry-safe. If the battle was already durably inserted but Achievement reconciliation temporarily fails, a later duplicate-only poll retries reconciliation without writing the battle or aggregates twice.

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
- `anon` and `authenticated` have no direct CRUD access to these tables;
- `service_role` has required CRUD access;
- all required Advanced Stats/Achievement RPCs exist;
- `anon` and `authenticated` cannot execute backend-only RPCs;
- `service_role` can execute them;
- all 8 migration names are present in Supabase migration history.

The Supabase linter reports `RLS enabled, no policy` as informational for these backend-only tables. That is intentional because browser roles receive no direct table access.

## Transactional production database smoke test

A rollback-only synthetic test was executed against the deployed production schema on 2026-08-07.

It verified in one transaction:

- first battle insert succeeds;
- replay of the same fingerprint is deduplicated;
- durable battle count remains one;
- daily attack/star/three-star aggregates update once;
- unit totals update once;
- army totals update once;
- `battles_processed` updates once;
- Advanced Stats -> Achievement reconciliation writes expected progress.

The transaction was rolled back and a follow-up query confirmed zero synthetic tracking, battle or achievement rows remained.

Reusable checks now live in:

- `scripts/check-advanced-stats-schema.sql`;
- `scripts/check-advanced-stats-schema.mjs`;
- `scripts/smoke-test-advanced-stats-db.sql`.

`npm run check:advanced-stats-db` is intentionally separate from normal CI and requires an explicit `SUPABASE_DB_URL`.

## Latest repository validation

The integrated Phase 7/8 code candidate previously passed the full GitHub Actions gate including:

- Maven tests/package;
- migration ordering;
- frontend endpoint parity;
- filename casing;
- frontend/Vitest suite;
- production build;
- static output;
- SEO checks;
- secret scan.

The DB verification/smoke-test additions must also keep normal repository CI green before the branch is called merge-ready.

## Remaining blocker before merge

The remaining mandatory gate is the real staged runtime rollout:

1. deploy the candidate backend to Cloud Run with collection disabled;
2. configure scheduler secret + developer-only rollout allowlist;
3. start tracking for one verified developer-owned account;
4. enable collection;
5. observe real Clash battle-log polls and repeated payloads;
6. verify scheduler lease/restart/overlap behavior, rate-limit recovery, gaps, stop/delete and real Achievement reconciliation;
7. confirm request/database growth is acceptable;
8. rerun the complete repository validation on the exact merge candidate.

PR #8 must remain draft and must not be merged into `Development` until this live runtime gate is complete.

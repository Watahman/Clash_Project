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
- Phase 8 staged live rollout — NOT COMPLETE

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

## Latest validation

GitHub Actions run `31196692862` passed completely on the integrated branch:

- Maven tests: PASS
- Maven package: PASS
- migration ordering check: PASS
- frontend endpoint check: PASS
- filename casing check: PASS
- frontend/Vitest suite: PASS
- production build: PASS
- static output check: PASS
- SEO check: PASS
- secret scan: PASS

## Remaining blocker before merge

The staged live rollout is still mandatory.

A read-only inspection of the current production Supabase project showed no `advanced_stats_*` tables yet. Therefore real battle collection, scheduler cycles, lease/restart behavior, DB growth, parser/unknown-ID observations and stop/delete/gap behavior have not been validated against a deployed Advanced Stats schema.

Do not merge PR #8 into `Development` merely because CI is green. The live Phase 8 rollout gate must be completed first.

No production database migration or Cloud Run/Scheduler rollout was performed as part of this integration pass.

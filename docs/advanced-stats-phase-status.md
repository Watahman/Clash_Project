# Advanced Stats — Phase & Merge Status

Updated: 2026-08-07  
Branch: `agent/advanced-stats-foundation`  
Draft PR: `#8` -> `Development`

This file is the compact phase checkpoint. Detailed implementation and validation evidence lives in `docs/advanced-stats-current-integration-status.md`; the remaining live gate is in `docs/advanced-stats-phase8-rollout.md`.

## Current phase status

- Phase 0 — branch + integration plan: **COMPLETE**
- Phase 1 — durable database + backend domain foundation: **COMPLETE**
- Phase 2 — verified-account ownership + lifecycle API: **COMPLETE**
- Phase 3 — battle ingestion + army parsing + deduplication: **COMPLETE**
- Phase 4 — scheduled collection design + leases/backoff/recovery: **COMPLETE**
- Phase 5 — read APIs + derived statistics: **COMPLETE**
- Phase 6 — private frontend + navigation + all-site-language i18n: **COMPLETE**
- Phase 7 — Advanced Achievements integration: **COMPLETE**
- Phase 8 — code/static/security/database hardening: **COMPLETE**
- Phase 8 — real Cloud Run / Cloud Scheduler / Clash API staged rollout: **PENDING**

## Merge status

**NOT READY — LIVE RUNTIME GATE REMAINS**

PR #8 must remain draft until the real staged runtime checks are complete.

The remaining blocker is no longer unfinished feature code or missing database schema. It is specifically validation that depends on the deployed environment:

1. deploy the exact candidate backend with collection and public enrollment disabled;
2. verify health/ready and disabled internal-poll behavior;
3. configure the scheduler secret and developer-only rollout UUID;
4. start one verified developer-owned linked account;
5. enable collection;
6. observe real Clash battle-log cycles and duplicate payloads;
7. verify Cloud Scheduler authentication/invocation;
8. observe real restart/overlap behavior;
9. inspect actual parser/unknown-ID, API 429/5xx/network and Achievement reconciliation behavior;
10. inspect real request/database growth;
11. run the full repository test/build checks locally or manually on the exact merge candidate;
12. only then move PR #8 out of draft and merge it into `Development`.

`ADVANCED_STATS_PUBLIC_ENROLLMENT_ENABLED=true` is not part of the first live stage.

## Validation policy

GitHub Actions CI is intentionally disabled for this repository. Do not add or re-enable GitHub Actions or automatic CI pipelines unless explicitly requested.

Repository checks remain available for manual/local execution, including `mvn test`, `npm test`, `npm run build`, `npm run check` and the Advanced Stats database verification commands.

## Integrated prerequisite state

Current `Development` was synced into this branch after these prerequisite integrations landed there:

1. Bracket Generator redesign
2. War Operation Board Webby redesign
3. Entity Guesser / Higher or Lower Minigames
4. Advanced Achievements

Advanced Stats therefore builds on the integrated Achievement implementation rather than a stale parallel branch.

## Completed production database work

The active production Supabase project contains:

- Advanced Achievements foundation;
- Advanced Stats migrations `001` through `008`.

The eighth Advanced Stats migration makes destructive feature deletion transactionally complete: it removes the tracking row/history and only the Achievement progress derived exclusively from Advanced Stats tracking. Unrelated Achievement progress remains intact.

Verified production DB contract:

- 9 required tables;
- RLS enabled on all 9;
- 17 required backend-only RPCs;
- 9 migration-history entries (Achievements foundation + 8 Advanced Stats migrations);
- browser roles cannot CRUD the feature tables;
- browser roles cannot execute backend-only RPCs;
- browser roles cannot create objects in schema `public`;
- `service_role` has the required table/RPC access.

## Completed rollback-only production DB tests

Synthetic transactions ending in `ROLLBACK` cover:

- battle ingestion and duplicate idempotency;
- daily/unit/army aggregates;
- Advanced Stats -> Achievement reconciliation;
- exclusive leases and expired-lease recovery;
- `WORKER_OUTAGE` gaps;
- repeated failures -> `DEGRADED` -> recovery;
- all-time / 7d / 30d read models;
- exact trend filtering;
- favorite units/armies;
- cursor pagination, including identical battle timestamps;
- first-observed timestamp fallback;
- parser-error isolation + exact reprocessing;
- STOPPED history preservation;
- destructive feature deletion + cascades;
- user deletion cascades;
- constraint/abuse rejection;
- monotonic Achievement progress;
- complete reset of Advanced-Stats-derived Achievement progress on feature deletion while unrelated Achievement progress is preserved.

No synthetic production records are intentionally retained.

Reusable commands:

```text
npm run check:advanced-stats-db
npm run smoke:advanced-stats-db
```

They require an explicit `SUPABASE_DB_URL` and are manual/local commands only.

## Additional hardening completed

- non-finite numeric values (`NaN` / infinity) rejected at the domain boundary;
- deterministic fuzz/property coverage for army normalization and battle fingerprints;
- full Advanced Stats locale coverage for `en`, `nl`, `fr`, `de`, `es`;
- dynamic army/category labels localized;
- translated/semantic accessibility labels;
- private Advanced Stats/internal-poll API responses forced to `Cache-Control: no-store` at the Cloudflare proxy;
- Privacy Policy and Terms updated for opt-in battle-history collection, gaps, retention and destructive deletion semantics;
- stale temporary phase/checkpoint documents removed;
- scheduler runbook aligned with separate collection/public-enrollment/developer-allowlist controls.

## Important data limitation

The upstream player battle log does not guarantee a durable battle ID or exact timestamp for every entry.

When an exact upstream timestamp is unavailable:

- `observed_at` is used as the fallback display/bucketing time;
- `observed_at` is deliberately excluded from the battle fingerprint;
- timestamp-less identity uses stable battle content and is therefore best-effort;
- known interruptions are represented as gaps instead of silently claiming complete history.

## Future integration note

If ClashPanel later adds a backend operation that unlinks a Clash account from a user profile, that flow must explicitly define what happens to an active Advanced Stats tracker. No backend unlink/remove-account route exists in the current implementation, so no speculative cross-feature behavior was added here.

## Detailed references

- `docs/advanced-stats-current-integration-status.md`
- `docs/advanced-stats-phase8-rollout.md`
- `docs/advanced-stats-scheduler-runbook.md`
- `docs/advanced-stats-read-api.md`
- `docs/advanced-stats-phase3-api-notes.md`

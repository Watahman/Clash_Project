# Advanced Stats — Phase 8 staged rollout gate

This checklist is mandatory before `agent/advanced-stats-foundation` may be called merge-ready.

## Safety switches

New enrollment and background collection are independent server-side controls.

```text
ADVANCED_STATS_PUBLIC_ENROLLMENT_ENABLED=false
ADVANCED_STATS_ROLLOUT_USER_IDS=<developer user UUID only during first stage>
ADVANCED_STATS_COLLECTION_ENABLED=false
ADVANCED_STATS_SCHEDULER_SECRET=<Secret Manager value>
```

Safe default with all variables absent:

- no account may start new Advanced Stats tracking;
- the scheduled collector is disabled;
- existing tracking lifecycle data can still be read, paused, stopped or deleted;
- no scheduler secret is accepted.

For the first live stage, keep public enrollment disabled and put only the developer account UUID in `ADVANCED_STATS_ROLLOUT_USER_IDS`.

Do not put user UUID allowlists or scheduler secrets in frontend files or public runtime config.

## Validation policy

GitHub Actions CI is intentionally disabled repository-wide. Do not add or re-enable GitHub Actions or automatic CI pipelines unless explicitly requested.

Repository verification is local/manual using the existing Maven, npm and database-check commands.

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
- all-time/7d/30d/90d read periods;
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

Pre-live code/frontend/privacy hardening also covers:

- non-finite number rejection and parser/fingerprint fuzz regressions;
- complete Advanced Stats locale parity for English, Dutch, French, German and Spanish;
- translated dynamic army/category labels;
- translated semantic accessibility labels;
- private Advanced Stats/internal-poll API responses forced to `Cache-Control: no-store`;
- Privacy/Terms wording aligned with opt-in collection, known gaps, stop/pause retention and destructive delete semantics.

Reusable manual commands:

```text
npm run check:advanced-stats-db
npm run smoke:advanced-stats-db
```

These require an explicit `SUPABASE_DB_URL` and are never run automatically by GitHub.

## Zero-traffic staged runtime design

The first Phase 8 backend candidate must **not** replace the production backend revision.

Use a Cloud Run traffic tag named `phase8`:

- candidate revision receives 0% normal service traffic;
- its tag URL can be called directly for health, auth and collector checks;
- production `clashpanel.com` traffic remains on the currently serving revision;
- future Phase 8 environment updates also use `--no-traffic --tag phase8`;
- the Cloud Scheduler job targets the tagged candidate URL, not the normal Cloud Run service URL.

The frontend candidate also stays isolated:

- `wrangler.phase8-preview.jsonc` creates a separate Worker named `clashpanel-phase8-preview`;
- it has a `workers.dev` URL only;
- it has no custom-domain route;
- it has no cron trigger;
- canonical redirect is disabled only when the explicit preview config sets `DISABLE_CANONICAL_REDIRECT=true`;
- it proxies `/api/*` only to the tagged `phase8` backend candidate;
- it reuses `API_PROXY_SECRET` from Google Secret Manager through a temporary Wrangler secrets file that is deleted immediately after deployment.

Production `clashpanel.com` remains unchanged during this stage.

## Staged helper scripts

The branch contains guarded helpers:

```text
deploy-cloud-run-phase8.ps1
configure-advanced-stats-phase8.ps1
deploy-phase8-preview.ps1
enable-advanced-stats-phase8.ps1
disable-advanced-stats-phase8.ps1
```

Purpose:

- `deploy-cloud-run-phase8.ps1` — deploy candidate with `--no-traffic --tag phase8`, verify `/health`, `/ready` and disabled internal poll;
- `configure-advanced-stats-phase8.ps1` — generate/store scheduler secret, configure exactly one developer UUID, create/update the scheduler target against the tag URL, keep scheduler paused and collection off;
- `deploy-phase8-preview.ps1` — build and deploy isolated `workers.dev` frontend against the tagged candidate;
- `enable-advanced-stats-phase8.ps1` — enable collection only on a new zero-traffic tagged candidate, verify no-secret/wrong-secret rejection and one authorized collector request, then resume Scheduler;
- `disable-advanced-stats-phase8.ps1` — emergency kill switch: pause Scheduler and disable collection/public enrollment on the tagged candidate without deleting history or moving production traffic.

`cloudrun-env.example.yaml` documents the safe non-secret values. The real `cloudrun-env.yaml` remains gitignored.

## Deployment order

1. Production database migrations — **COMPLETE**.
2. Production DB schema/security/rollback behavior validation — **COMPLETE**.
3. Checkout/pull `agent/advanced-stats-foundation` locally.
4. Ensure `cloudrun-env.yaml` contains the current production non-secret config plus:
   - `ADVANCED_STATS_COLLECTION_ENABLED: "false"`
   - `ADVANCED_STATS_PUBLIC_ENROLLMENT_ENABLED: "false"`
   - `ADVANCED_STATS_ROLLOUT_USER_IDS: ""`
5. Run `deploy-cloud-run-phase8.ps1`.
6. Confirm the script reports:
   - tagged candidate has 0% normal production traffic;
   - `/health = 200`;
   - `/ready = 200`;
   - `POST /InternalAdvancedStatsPoll = 404` while collection is disabled.
7. Run `configure-advanced-stats-phase8.ps1` with exactly one developer user UUID.
8. Confirm Scheduler is PAUSED and still targets the tagged candidate URL.
9. Run `deploy-phase8-preview.ps1`.
10. Open the printed `workers.dev` preview URL and sign in. Prefer normal email/password sign-in for the preview because the production Google OAuth callback still points at `clashpanel.com`.
11. Open `/app/advanced-stats` and start tracking for the allowlisted linked developer account.
12. Confirm a non-allowlisted user/request cannot start tracking if a suitable test identity is available.
13. Run `enable-advanced-stats-phase8.ps1`.
14. Confirm:
    - public enrollment remains false;
    - normal production traffic to the candidate remains 0%;
    - missing/wrong scheduler secret receives 401;
    - authorized collector request receives 200;
    - Scheduler becomes ACTIVE against the tagged candidate.
15. Observe several real scheduler/battle-log cycles before any rollout expansion.

Do not enable `ADVANCED_STATS_PUBLIC_ENROLLMENT_ENABLED=true` and do not move normal production traffic to the Phase 8 tag during the developer stage.

## Emergency stop

At any unexpected behavior, run:

```powershell
.\disable-advanced-stats-phase8.ps1 -ProjectId "clashpanel"
```

This is intentionally non-destructive:

- Scheduler is paused;
- Advanced Stats collection is disabled;
- public enrollment remains disabled;
- the tagged candidate remains at 0% production traffic;
- existing tracked history remains stored.

## Mandatory real-data checks

The database semantics have synthetic coverage, but the real Clash payload/network path still needs observation. Verify:

- the first real observation inserts each new battle once;
- a repeated real battle-log payload is recognized as duplicate;
- `last_successful_poll_at` advances after successful real cycles;
- `next_poll_at` follows active/idle cadence in deployed runtime;
- exact `tracked_attack_count`, `tracked_star_count` and `tracked_three_star_count` reconcile from real battles;
- real parser/unknown-ID output is inspected;
- actual Clash API 429/5xx/network behavior maps to expected collector classification/backoff;
- request volume and row growth match expectations.

## External-runtime checks that cannot be replaced by DB simulation

Before wider rollout, validate in the tagged candidate:

- Cloud Scheduler authenticates to and invokes the tagged Cloud Run internal poll endpoint;
- collection-disabled behavior was correct before enablement;
- an actual Cloud Run restart/instance replacement recovers cleanly;
- overlapping real HTTP poll calls do not create duplicate collection work;
- Secret Manager/env rollout values are wired to the intended tagged revision;
- actual Clash API key rotation/cache/fresh-fetch behavior works from Cloud Run;
- real upstream latency/rate limiting/outages produce expected logs and backoff;
- the isolated preview has no runtime-only serialization/auth/CORS/proxy issue blocking lifecycle/read routes.

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
- deployed Cloud Scheduler/tagged Cloud Run invocation is stable;
- restart/overlap behavior has been observed in the real runtime;
- full backend/frontend repository checks have been run locally/manually on the exact rollout candidate.

Then add a small explicit set of user UUIDs to `ADVANCED_STATS_ROLLOUT_USER_IDS` and repeat the observation window.

`ADVANCED_STATS_PUBLIC_ENROLLMENT_ENABLED=true` is the final public-enrollment switch and must remain false until that small-subset stage is healthy.

## Current environment note

The production schema, permissions, constraints, aggregates, leases, failure/recovery state machine, read models, cascades, deletion reset and retry semantics already have direct rollback-only database validation.

Phase 8 remains incomplete only for behavior that depends on the deployed tagged backend/external environment: Cloud Run revision/runtime behavior, Cloud Scheduler authentication/invocation, real Clash API payloads/network behavior and a real observation window.

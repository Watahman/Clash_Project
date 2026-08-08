# Advanced Stats — Current integration checkpoint

Updated: 2026-08-08
Branch: `agent/advanced-stats-foundation`
PR: #8 (draft, target `Development`)

## Current status

Phases 0–7 are complete. Phase 8 implementation, production database deployment, rollback-only database validation, parser/fingerprint hardening, i18n/accessibility/privacy hardening, and staged deployment tooling are complete.

The remaining gate is the **real external runtime observation** against a deliberately isolated candidate:

- Cloud Run candidate is deployed with tag `phase8` and **0% normal production traffic**;
- an isolated `clashpanel-phase8-preview` Worker on `workers.dev` is used instead of replacing `clashpanel.com`;
- public Advanced Stats enrollment remains disabled;
- only one developer UUID is allowlisted during the first stage;
- Scheduler targets the tagged candidate, not the production service URL;
- Scheduler remains paused until one developer tracker has been started and the protected collector endpoint passes its authorization checks.

No Phase 8 candidate should receive normal production traffic before the staged observation gate is complete.

## Completed production database work

The active production Supabase project contains the Advanced Achievements foundation plus Advanced Stats migrations `001` through `008`.

Verified directly:

- 9 required tables with RLS;
- 17 required backend RPC signatures;
- 9 migration-history entries;
- no direct Advanced Stats CRUD for `anon`/`authenticated`;
- no backend-only RPC execute for `anon`/`authenticated`;
- required `service_role` access;
- browser roles cannot create objects in schema `public`;
- destructive Advanced Stats deletion removes only tracking-derived Achievement progress while preserving unrelated Achievement progress.

Rollback-only synthetic production database tests cover ingestion, deduplication, aggregates, leases, failure/recovery state, all read periods, pagination, timestamp fallback, parser-error reprocessing, cascades, constraints and monotonic Achievement reconciliation. Follow-up checks confirmed no synthetic test data remained.

Reusable manual database verification:

```text
npm run check:advanced-stats-db
npm run smoke:advanced-stats-db
```

These require an explicit `SUPABASE_DB_URL` and are never run automatically by GitHub.

## Additional hardening completed

- non-finite numeric values rejected at the Java domain boundary;
- deterministic parser/fingerprint fuzz regressions;
- full Advanced Stats locale coverage for English, Dutch, French, German and Spanish;
- localized dynamic army/category labels;
- semantic accessibility labels and live regions;
- private Advanced Stats/internal-poll API responses forced to `Cache-Control: no-store`;
- Privacy Policy and Terms aligned with opt-in tracking, known gaps, retention and destructive deletion semantics;
- GitHub Actions removed repository-wide; validation is local/manual only.

## Phase 8 zero-traffic deployment tooling

The branch now includes:

```text
cloudrun-env.example.yaml
deploy-cloud-run-phase8.ps1
configure-advanced-stats-phase8.ps1
wrangler.phase8-preview.jsonc
deploy-phase8-preview.ps1
enable-advanced-stats-phase8.ps1
disable-advanced-stats-phase8.ps1
```

Safety properties:

- `deploy-cloud-run-phase8.ps1` requires collection/public enrollment to be explicitly false;
- backend candidate uses `--no-traffic --tag phase8`;
- health/ready and disabled internal-poll behavior are checked on the tag URL;
- developer configuration keeps exactly one UUID allowlisted, collection off and Scheduler paused;
- Scheduler secret is generated into Google Secret Manager rather than Git;
- Scheduler job targets only the `phase8` tag URL;
- preview frontend is a separate `workers.dev` Worker with no custom-domain route and no cron;
- preview config disables canonical redirect only in that isolated Worker;
- preview API traffic points only to the tagged backend candidate;
- preview reuses the existing `API_PROXY_SECRET` through a temporary secrets file that is removed after deployment;
- preview-only `UPSTREAM_ORIGIN_OVERRIDE=https://clashpanel.com` lets the trusted Worker pass the existing backend CORS policy while retaining the preview host in `X-Forwarded-Host`;
- collection enablement first verifies missing/wrong scheduler-secret rejection and one authorized collector request;
- any enablement failure automatically pauses Scheduler and turns collection/public enrollment back off on the tagged candidate;
- `disable-advanced-stats-phase8.ps1` is a non-destructive emergency kill switch and leaves production traffic untouched.

Production `clashpanel.com` and the currently serving Cloud Run revision remain outside this developer stage.

## Remaining mandatory live gate

1. Checkout/pull the current feature branch locally.
2. Prepare `cloudrun-env.yaml` from the safe example with the existing production non-secret values and both Advanced Stats switches false.
3. Run `deploy-cloud-run-phase8.ps1` and verify 0% normal traffic + health/ready + disabled poll.
4. Run `configure-advanced-stats-phase8.ps1` with exactly one developer user UUID.
5. Run `deploy-phase8-preview.ps1`.
6. Sign into the isolated preview and start Advanced Stats for the allowlisted linked developer account.
7. Run `enable-advanced-stats-phase8.ps1`.
8. Observe multiple real Cloud Scheduler / Cloud Run / Clash battle-log cycles.
9. Validate real duplicate behavior, parser/unknown IDs, restart/overlap recovery, 429/5xx/network handling, Achievement reconciliation and database/request growth.
10. Run the complete local/manual repository checks on the exact candidate.
11. Only then consider moving PR #8 out of draft and merging it into `Development`.

`ADVANCED_STATS_PUBLIC_ENROLLMENT_ENABLED` must remain false during the initial developer stage. Normal production traffic must remain at 0% for the `phase8` tagged candidate until the live gate succeeds.

Detailed execution instructions are in `docs/advanced-stats-phase8-rollout.md`.

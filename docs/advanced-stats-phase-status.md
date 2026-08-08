# Advanced Stats — Phase & Merge Status

Updated: 2026-08-08  
Branch: `agent/advanced-stats-foundation`  
Draft PR: `#8` -> `Development`

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
- Phase 8 — safe zero-traffic runtime rollout tooling: **COMPLETE**
- Phase 8 — real Cloud Run / Cloud Scheduler / Clash API staged observation: **PENDING**

## Merge status

**NOT READY — LIVE RUNTIME GATE REMAINS**

PR #8 stays draft.

The remaining gate is environment-dependent validation. The candidate must be tested through the `phase8` Cloud Run traffic tag at 0% normal production traffic plus an isolated `clashpanel-phase8-preview` workers.dev frontend. Public enrollment stays disabled and the first rollout allowlist contains exactly one developer UUID.

GitHub Actions are intentionally disabled repository-wide. Release validation uses local/manual Maven, npm and database checks only.

## Safe Phase 8 sequence

1. `deploy-cloud-run-phase8.ps1` — zero-traffic tagged backend, collection/public enrollment off.
2. `configure-advanced-stats-phase8.ps1` — one developer UUID, Scheduler secret in Secret Manager, Scheduler paused.
3. `deploy-phase8-preview.ps1` — isolated workers.dev frontend against the tagged backend.
4. Start Advanced Stats for the allowlisted linked developer account in that preview.
5. `enable-advanced-stats-phase8.ps1` — auth checks + first collector request + resume Scheduler.
6. Observe several real attack/poll cycles and runtime failure/recovery behavior.
7. Run local/manual repository checks on the exact candidate.
8. Only then consider moving PR #8 out of draft.

Emergency kill switch:

```powershell
.\disable-advanced-stats-phase8.ps1 -ProjectId "clashpanel"
```

This pauses Scheduler and disables collection/public enrollment on the tagged candidate without deleting stored history or moving production traffic.

See `docs/advanced-stats-phase8-rollout.md` for the full checklist and `docs/advanced-stats-current-integration-status.md` for the current checkpoint.

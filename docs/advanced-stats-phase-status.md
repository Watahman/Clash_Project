# Advanced Stats — Phase & Merge Status

Branch: `agent/advanced-stats-foundation`

This file is the durable implementation checkpoint when chat context is reset.

## Merge readiness vocabulary

Every completed phase must end with one explicit branch status:

- **NOT READY** — required Advanced Stats implementation or validation is still missing.
- **TECHNICALLY READY — WAITING FOR PRIOR BRANCHES** — Advanced Stats itself has passed its final technical gate, but branches that the user wants merged first are still ahead of it in merge order.
- **READY TO MERGE** — Advanced Stats has passed its final technical gate, prerequisite/prior branches are already incorporated into `master`, the branch has been refreshed against current `master`, conflicts/regressions have been resolved, and final checks pass.

A phase being complete does **not** imply the branch is ready to merge.

Before declaring **READY TO MERGE**, always:

1. fetch/reinspect current `master`;
2. confirm the user-designated earlier branches have landed;
3. rebase/merge current `master` into this branch as appropriate;
4. resolve any overlap with systems added by those branches;
5. run the full backend/frontend validation suite;
6. inspect the final diff for unrelated changes;
7. only then explicitly tell the user the branch is ready to merge.

## Current status

- Phase 0 — branch + plan: **COMPLETE**
- Phase 1 — database + backend domain foundation: **IN PROGRESS**
- Phase 2 — tracking ownership + lifecycle API: **NOT STARTED**
- Phase 3 — battle ingestion + army parsing + deduplication: **NOT STARTED**
- Phase 4 — scheduled collection: **NOT STARTED**
- Phase 5 — read APIs + derived stats: **NOT STARTED**
- Phase 6 — frontend + navigation + i18n: **NOT STARTED**
- Phase 7 — Advanced Achievements integration: **BLOCKED until that work exists on master / is intentionally incorporated**
- Phase 8 — hardening + staged rollout: **NOT STARTED**

### Branch merge status

**NOT READY**

Reason: implementation is only in Phase 1 and the branch is intentionally expected to wait behind other branches before final merge.

## Phase 1 gate

Phase 1 is complete only when all of the following hold:

- Advanced Stats database migration exists and passes migration checks;
- tables are backend-managed with RLS enabled and anon/authenticated access revoked;
- `(tracking_id, battle_fingerprint)` is database-unique;
- child tables cascade from the tracking row;
- no closed CHECK constraint is used for upstream battle-type values;
- domain enums/models compile;
- deterministic SHA-256 battle fingerprinting is covered by tests;
- initial repository boundary exists without exposing lifecycle writes/routes;
- existing route/UI behavior is unchanged;
- available baseline/full checks are green.

When Phase 1 completes, this file must be updated before Phase 2 work starts.

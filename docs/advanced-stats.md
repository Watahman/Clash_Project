# Advanced Stats

This is the current operational reference for ClashPanel Advanced Stats. Historical phase plans, rollout reports, and one-off audits were removed during the repository cleanup.

## Current state

- Advanced Stats data structures, backend routes, compact storage, achievements integration, and frontend views are present in the repository.
- Public enrollment remains disabled by default.
- Scheduled collection remains disabled unless it is deliberately enabled for a controlled test or release.
- Production and preview use the same three Secret Manager resources: `SUPABASE_SERVICE_ROLE_KEY`, `API_PROXY_SECRET`, and `ADVANCED_STATS_SCHEDULER_SECRET`.
- Production and preview use the dedicated `clashpanel-api-runtime` Cloud Run service account and request-based CPU billing.
- The existing preview Cloud Run tag is still named `phase8` for compatibility; it is now the generic zero-traffic preview target rather than a separate infrastructure stack.

## Read API

Authenticated, owner-checked routes include:

- `POST /AdvancedStatsOverview`
- `POST /AdvancedStatsUnits`
- `POST /AdvancedStatsArmies`
- `POST /AdvancedStatsBattles`
- `POST /AdvancedStatsTrends`

Supported periods are `7d`, `30d`, `90d`, and `all`. The backend resolves the linked player and tracking record server-side; callers do not supply a tracking UUID.

Battle-list pagination is cursor based. Raw provider payloads, authorization material, and secrets are never returned to the browser.

## Deployment and preview

Normal production deployment uses `scripts/deploy/deploy-cloud-run-production.ps1`. The isolated backend preview uses `scripts/deploy/deploy-cloud-run-preview.ps1`; its candidate receives 0% normal production traffic and receives the stable preview OAuth redirects directly during the Cloud Run deploy. Cloudflare preview/production deployments are triggered automatically by Git pushes using the repository Wrangler configuration.

The preview scripts verify the Development Git state, runtime service account, CPU throttling, secret bindings, feature switches, and tagged revision before deployment. Production deployment independently verifies the exact production revision, health/readiness, traffic, service account, and secret configuration.

## Scheduled collection

The protected collector endpoint is `/InternalAdvancedStatsPoll`. Collection must remain off unless a deliberate test or release requires it.

For a controlled preview collector test:

1. Deploy a fresh zero-traffic preview.
2. Run `scripts/deploy/configure-advanced-stats-preview.ps1` with exactly one developer user ID.
3. Deploy the isolated frontend preview if browser testing is required.
4. Run `scripts/deploy/enable-advanced-stats-preview.ps1` only when the candidate is ready for real collection.
5. Use `scripts/deploy/disable-advanced-stats-preview.ps1` as the non-destructive kill switch.

Production collection is configured separately with `scripts/deploy/configure-advanced-stats-production.ps1`. Do not run it as part of a normal application deploy.

## Database verification

`npm run check:advanced-stats-db` validates the compact schema contract. `npm run smoke:advanced-stats-db` runs the maintained compact smoke suite. Both require `SUPABASE_DB_URL` and are intentionally manual.

The current database model is defined by the complete ordered migration history in `database/migrations/`; old migrations are not disposable documentation and must remain intact once applied.

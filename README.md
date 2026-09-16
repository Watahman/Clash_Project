# ClashPanel

ClashPanel is a Clash of Clans web application for CWL planning, operation tracking, clan-family management, polls, brackets, achievements, minigames, and player/clan analysis.

## Architecture

- `src/` contains the static frontend and Java HTTP backend.
- `src/assets/js/` contains browser modules, API clients, workspace logic, caching, analytics, and feature code.
- `src/Java/` contains the API gateway, authentication, authorization, Clash/ClashKing integrations, caching, and persistence logic.
- `database/migrations/` is the immutable ordered PostgreSQL/Supabase migration history.
- `test/` contains Vitest/JSDOM and JUnit regression tests.
- `worker/` contains the Cloudflare Worker used for the public site and `/api` proxy.
- `scripts/` contains maintained build, validation, database, asset, and operational helpers.

The browser uses same-origin `/api` routes. Locally, the Node static server proxies those routes to the Java API. Production uses Cloudflare in front of Cloud Run.

## Local development

Requirements: Node.js, JDK 21, Maven 3.9+, and access to the configured Supabase project.

```text
npm ci
mvn compile exec:java
npm run dev
```

Open `http://localhost:5173`. Copy `.env.example` to `.env` for local configuration. Real credentials belong only in ignored local files or the hosting platform; never commit them.

## Validation

Run the complete frontend/repository gate with:

```text
npm run check
```

Run backend tests separately with:

```text
mvn test
```

The repository gate validates migration ordering, endpoint registration, filename casing, frontend tests, the static build, public output, and SEO contracts.

## Database

Apply every migration in `database/migrations/` once and in filename order. Do not remove old applied migrations during cleanup; they are deployment history, not disposable scripts. See [docs/database.md](docs/database.md).

Optional Advanced Stats database checks are available through `npm run check:advanced-stats-db` and `npm run smoke:advanced-stats-db`; both require an explicit `SUPABASE_DB_URL`.

## Deployment

For normal releases, use the two root entrypoints:

```powershell
.\deploy-dev.ps1
.\deploy-prod.ps1
```

`deploy-dev.ps1` stages and commits local Development changes when needed, runs the repository checks, pushes `Development` (which triggers the Cloudflare preview deployment), then deploys the zero-traffic Google Cloud preview. `deploy-prod.ps1` only accepts the exact clean commit already pushed to Development, fast-forwards that commit to `master` (triggering Cloudflare production), then deploys the same commit to Cloud Run production. Neither wrapper manually deploys Cloudflare.

The underlying Google Cloud helpers live in `scripts/deploy/`. `deploy-cloud-run-production.ps1` requires a clean commit already present on `origin/master`; `deploy-cloud-run-preview.ps1` requires the corresponding `origin/Development` commit and binds the stable preview OAuth callbacks while keeping 0% normal production traffic.

Cloudflare is intentionally not deployed by repository PowerShell helpers. Git pushes trigger the configured Cloudflare builds automatically: `Development` for preview and `master` for production. Production Cloud Run uses the dedicated `clashpanel-api-runtime` service account, request-based CPU billing, and only the three approved Secret Manager resources.

## Maintained documentation

- [docs/database.md](docs/database.md) — migration policy and database verification.
- [docs/advanced-stats.md](docs/advanced-stats.md) — current Advanced Stats API and operational state.
- [docs/analytics.md](docs/analytics.md) — PostHog event contract and reporting guidance.
- [docs/minigames-data-maintenance.md](docs/minigames-data-maintenance.md) — curated minigame-data maintenance rules.
- [docs/assets.md](docs/assets.md) — asset provenance and fan-content constraints.

Historical redesign reports, one-off audits, completed checklists, rollout phase notes, and superseded database smoke scripts are intentionally not kept in the active repository. Git history remains the recovery source for that material.

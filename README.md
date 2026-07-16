# ClashTools

ClashTools is a vanilla JavaScript and Java application for CWL planning and live operation tracking. It also includes groups, role management, availability polls, internal reminders, player-account verification, saved drafts and a local single-elimination bracket generator.

## Architecture

- `src/`: Vite frontend and Java HTTP backend.
- `src/assets/js/auth`: Supabase Auth browser session handling.
- `src/assets/js/cache`: IndexedDB stale-while-revalidate cache.
- `src/Java`: authenticated API gateway, authorization and the layered Clash response cache.
- `database/migrations`: ordered PostgreSQL/Supabase schema and security migrations.
- `test`: Vitest/JSDOM and JUnit regression tests.

The browser uses same-origin `/api` routes by default. During development, Vite proxies those routes to `http://localhost:8080`. The Java server validates every protected bearer token with Supabase Auth and derives the acting profile server-side.

## Requirements

- Node.js 22 or a Vite 8-compatible runtime
- JDK 21
- Maven 3.9+
- A Supabase project
- A Clash of Clans API token

## Local setup

1. Copy `.env.example` to `.env` and replace only the placeholder values.
2. Apply the database migrations in the documented order.
3. Install and start both processes:

```text
npm ci
mvn compile exec:java
npm run dev
```

Open `http://localhost:5173`. Never expose the Supabase service-role key through a `VITE_` variable or frontend bundle.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `_BASE_URL_SUPABASE` or `SUPABASE_URL` | yes | Supabase project URL |
| `_API_KEY_SUPABASE` | yes | Supabase publishable/anon key used for server-side token validation |
| `_API_KEY_SECR_SUPABASE` or `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-only service-role key |
| `_API_KEY_ALL` | yes | Clash API authorization value, including `Bearer ` |
| `_BASE_URL_CLASH` | no | Clash API base URL |
| `VITE_SUPABASE_URL` | yes | Public Supabase URL for browser auth |
| `VITE_SUPABASE_ANON_KEY` | yes | Public Supabase publishable/anon key |
| `VITE_API_BASE_URL` | no | Browser API base; defaults to `/api` |
| `SERVER_PORT` or `PORT` | no | Backend port; defaults to `8080` |
| `ALLOWED_ORIGINS` | production | Comma-separated browser-origin allowlist |
| `CACHE_ENABLED`, `CACHE_MODE` | no | Layered public Clash response cache configuration |
| `MAX_REQUEST_BODY_BYTES` | no | Request body limit |
| `PUBLIC_RATE_LIMIT_PER_MINUTE` | no | Public Clash route limit per IP and route |
| `SENSITIVE_RATE_LIMIT_PER_MINUTE` | no | Token verification and legacy auth route limit |
| `DATA_RATE_LIMIT_PER_MINUTE` | no | Authenticated data route limit |

## Database

See [DATABASE_MIGRATIONS.md](DATABASE_MIGRATIONS.md) for the apply order, preflight, backup and rollback notes. The Java cache persists public Clash responses in `api_cache`; private profile, auth and verification data must never be written there.

## Build and test

```text
npm ci
npm run check
mvn test
mvn package
```

`mvn package` produces a runnable dependency-inclusive JAR in `target/`. Health probes are available at `/health`; `/ready` returns `503` and only the names of missing configuration categories until required configuration is present.

## Production notes

Build the frontend with `npm run build`, serve `dist/` over HTTPS and reverse-proxy `/api` to the Java service. Run the packaged Java JAR with JDK 21. Configure an exact production origin allowlist, keep service credentials in the hosting secret store, apply migrations before new application code, and monitor `429`, `401`, upstream Clash errors and cache health.

Before release, complete [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md). The CI workflow builds both sides, runs tests, validates migration ordering and performs a history-aware secret scan.

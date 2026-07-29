# ClashPanel pre-launch audit

Audit date: 29 July 2026
Audited checkout: `C:\Users\Emile\IdeaProjects\Clash_Project`
Branch and starting revision: `Development` at `501eded`
Decision: **CONDITIONAL GO**

The audited release is deployed to production and its automated, infrastructure and live smoke checks pass. The decision remains CONDITIONAL GO because leaked-password protection requires a paid Supabase plan, destructive account lifecycle tests and two-user authorization tests were not run against real production users, monitoring alerts are not configured, and AdSense is still reviewing the site.

## Production release

- GitHub release branch: `Development`; draft PR: [#2](https://github.com/Watahman/Clash_Project/pull/2).
- GitHub CI passes for both the branch push and pull request at `9185b85`.
- Cloudflare Worker/static release: version `1e0b40aa-b7fe-4b2b-8ae0-245fe31847a4`.
- Cloud Run backend: revision `clashpanel-api-00022-cas`, serving 100% of production traffic.
- Supabase migration file `20260729121006_harden_database_access_and_indexes.sql` was validated on the existing test project and applied to production as migration `20260729131503`.
- A shared `API_PROXY_SECRET` is present in Cloudflare and Google Secret Manager. The Cloud Run runtime service account has access only to that secret, and direct application API requests without it return `403 PROXY_AUTH_REQUIRED`.
- The Cloudflare rule `Redirect www to apex` is active as a `301` and preserves the complete path and query string.

## Fixed

- Public legal and contact pages now have canonical URLs, index directives, Open Graph/Twitter metadata and crawlable server-rendered fallback headings.
- Build-time site URL replacement now covers both `robots.txt` and every sitemap URL.
- All HTML buttons have an explicit type, preventing accidental form submission.
- The large legacy logo was replaced with the existing compact equivalent.
- The release configuration and checklist now document every operational environment variable and proxy-secret requirement.
- CI now rejects case-insensitive filename collisions.

## SEO / indexing

- Indexable pages: `/`, `/subpages/privacy`, `/subpages/cookies`, `/subpages/terms`, `/subpages/contact`.
- App, authentication, draft, bracket and error pages retain `noindex`.
- `robots.txt` allows the public site while excluding `/api/` and the HTML-fragment directory. Private app pages are not disallowed, so crawlers can still see their `noindex`.
- `sitemap.xml` contains only the five public canonical URLs.
- Cloudflare preview deployments under `workers.dev` receive `X-Robots-Tag: noindex`.
- No fake `hreflang` URLs were added: language selection is client-side on the same URL.

## Routing

- Cloudflare Static Assets remains configured with `auto-trailing-slash` and `404-page`.
- Local production-runtime checks confirmed:
  - clean public and private routes return `200`;
  - `.html` routes redirect to clean routes with `307`;
  - missing pages and assets return `404`;
  - missing API routes return a structured JSON `404`.
- This matches Cloudflare's documented static-site routing and HTML handling behavior: [Static site generation](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/) and [HTML handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/).
- `www.clashpanel.com` now permanently redirects to the canonical apex host while preserving path and query string.

## Error handling

- The Worker now converts upstream HTML failures for `/api` into safe JSON errors without exposing Cloud Run internals.
- Backend-unavailable and invalid-proxy-configuration failures return stable JSON codes.
- Existing structured JSON errors and OAuth redirects are preserved.
- Java `405` responses now include the appropriate `Allow` header.

## Security

- Static responses now define `nosniff`, clickjacking protection, a strict referrer policy and a restrictive permissions policy through Cloudflare's supported `_headers` file ([Cloudflare static headers](https://developers.cloudflare.com/workers/static-assets/headers/)).
- The Worker discards caller-controlled forwarding and internal proxy-secret headers, rebuilds trusted forwarding headers and can inject `API_PROXY_SECRET`.
- Cloud Run can verify the shared proxy secret using a constant-time comparison. `/ready` reports the secret as missing whenever proxy headers are trusted but no secret is configured.
- Existing exact-origin CORS, HttpOnly/Secure cookie controls, PKCE, request-body limits, authorization checks, rate limits and server-only Supabase credentials remain intact.
- A forward-only Supabase migration:
  - removes anonymous access to the SECURITY DEFINER identity helpers;
  - removes browser-role access from trigger-only helpers and reminder-delivery storage;
  - adds the twelve foreign-key indexes flagged by the live performance advisor.
- Authenticated execution on the three read-only identity helpers remains intentional because current RLS policies depend on it. Their results are tied to the authenticated identity.
- The post-migration security advisor no longer reports anonymous SECURITY DEFINER access. Its remaining leaked-password warning cannot be enabled on the current Free plan.

## Performance

- Removed approximately 3.8 MB of proven-unused or duplicate image assets.
- Removed six JavaScript modules that were absent from every HTML entry point and the complete static import graph.
- The static build now removes the backend `Java` source tree and internal `REDESIGN_NOTES.txt` before deployment. CI rejects any `.java`, `.env`, backend folder or design note found in `dist`.
- No long immutable cache lifetime was added because asset filenames are not content-versioned. Cloudflare can safely revalidate current static assets with ETags.
- Town Hall images remain a measurable optimization opportunity; resizing them was left out to avoid an unreviewed visual asset change.

## Tests added

- Five Worker proxy tests: static passthrough, URL mapping, forwarding-header sanitization, JSON error normalization and unavailable-backend behavior.
- Seventeen static pre-launch tests: public metadata, private `noindex`, robots/sitemap, security headers and explicit button types.
- Three Java proxy tests: direct-request rejection, valid proxy continuation and `Allow` headers.
- A tracked-file casing uniqueness check is part of `npm run check` and CI.

Verification after the changes:

- `npm run check`: **58 files, 224 tests passed**; migration, route, casing and production build checks passed.
- `mvn test`: **42 tests passed**.
- `mvn package -DskipTests`: shaded production JAR built successfully.
- Static output validation: **237 public files**, with no backend source, environment file or internal design note.
- `npm audit --audit-level=high`: **0 vulnerabilities**.
- Live browser smoke test: homepage, public policy rendering, unauthenticated-route redirect, authenticated saved-plans and planner loading passed without application browser-console warnings.
- Live proxy checks: invalid `/api/Player` requests reach the backend and return the expected structured `400`; missing API routes return structured JSON `404`; direct Cloud Run application requests without the proxy secret return `403`.
- Cloud Run logs for the new revision show successful authenticated app requests and no error-level entries during the release window.
- Supabase performance advisors no longer report the twelve missing foreign-key indexes.
- AdSense reports `ads.txt` as **Authorized**, European regulations as **1 active**, and **No current issues** in Policy Center. Site approval remains **Getting ready**.

## Removed code

The following files were proven unreachable by the static entry/import graph before removal:

- `src/assets/js/API/API-Goldpass.js`
- `src/assets/js/API/API-Labels.js`
- `src/assets/js/API/API-Leagues.js`
- `src/assets/js/API/API-Locations.js`
- `src/assets/js/groups/groups-tooltips.js`
- `src/assets/js/pages/index.js`

The following images had no source, CSS, JavaScript or HTML references, or were replaced by the visually equivalent compact logo:

- `src/assets/css/pictures/background-image.png`
- `src/assets/css/pictures/back2.jpg`
- `src/assets/css/pictures/shield_with_hamer_logov2.png`

## Left unchanged intentionally

- No redesign, navigation change, application workflow change or broad refactor.
- No Content Security Policy yet: current inline bootstrapping, JSON-LD, AdSense, Google sign-in and SheetJS require a tested nonce/hash and consent-aware policy first.
- No HSTS change: this should be staged separately because browsers cache the policy and subdomain coverage must be intentional.
- No speculative removal of Supabase “unused” indexes; low traffic is not proof that an index is obsolete.
- No primary-key or permissive-policy restructuring; those changes need staged data and authorization validation.
- No removal of the bracket module; it is an explicit future/disabled feature with tests.
- No persistence of historical CWL provider data.

## Remaining risks

Required follow-up:

1. Enable Supabase leaked-password protection after upgrading from the Free plan, or keep the current application-side password checks until an upgrade is justified.
2. Run controlled register/confirm/reset/logout/Google sign-in and two-user RLS tests with dedicated production test accounts.
3. Complete mutation-based browser tests for save/rename/copy/delete plans and multi-user operation/poll workflows using disposable data.
4. Configure production monitoring and alerting for `401`, `403`, `429`, `5xx`, upstream failures and readiness.
5. Wait for AdSense site approval; the current status is **Getting ready**.

Non-blocking follow-up:

- Introduce versioned asset filenames before adding long immutable browser caching.
- Optimize oversized Town Hall images after a visual comparison.
- Design and stage a CSP compatible with authentication, advertising and the current boot scripts.
- Review Supabase duplicate indexes and composite-primary-key drift in a controlled database maintenance window.

## Production checks

Observed after deployment:

| URL | Production result |
| --- | --- |
| `https://clashpanel.com/` | `200` with static security headers |
| `https://www.clashpanel.com/subpages/privacy?release=audit` | `301` to the identical apex path and query |
| `https://clashpanel.com/subpages/privacy` | `200` with canonical/social metadata |
| `https://clashpanel.com/subpages/privacy.html` | `307` to the clean route |
| `https://clashpanel.com/definitely-missing-page-audit` | `404` |
| `https://clashpanel.com/assets/definitely-missing-audit.js` | `404` |
| `https://clashpanel.com/api/definitely-missing-audit` | `404 application/json` |
| `https://clashpanel.com/Java/Config.java` | `404` |
| `https://clashpanel.com/REDESIGN_NOTES.txt` | `404` |
| `https://clashpanel.com/robots.txt` | `200` with production sitemap URL |
| `https://clashpanel.com/sitemap.xml` | `200` with five canonical public URLs |
| `https://clashpanel.com/ads.txt` | `200`; AdSense reports **Authorized** |

The release was deployed in the documented order: shared secret, test migration, production database migration, Worker/static assets, no-traffic backend revision, tagged health/readiness tests, 100% backend traffic, canonical redirect, advisors and live smoke tests. No merge to `master` was performed.

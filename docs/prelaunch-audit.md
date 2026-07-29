# ClashPanel pre-launch audit

Audit date: 29 July 2026
Audited checkout: `C:\Users\Emile\IdeaProjects\Clash_Project`
Branch and starting revision: `Development` at `501eded`
Decision: **CONDITIONAL GO**

The code is ready for a controlled staging release. Production is not yet a GO because the audited changes have not been deployed, the new database migration has not been applied, shared proxy authentication still needs matching secrets, and several external/manual controls remain open.

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
- `www.clashpanel.com` currently returns `200` instead of redirecting to the canonical apex host. Configure a Cloudflare Bulk Redirect; static `_redirects` rules do not support domain-level redirects ([Cloudflare redirects](https://developers.cloudflare.com/workers/static-assets/redirects/)).

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

## Performance

- Removed approximately 3.8 MB of proven-unused or duplicate image assets.
- Removed six JavaScript modules that were absent from every HTML entry point and the complete static import graph.
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
- Build mirror: **298 source files and 298 dist files**, no unexpected mismatches, and no production-domain placeholder remained.
- `npm audit --audit-level=high`: **0 vulnerabilities**.
- Local browser smoke test: homepage, public policy rendering and authenticated-route redirect passed with no browser-console messages.

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
- No HSTS in the static file because it should be configured and verified at the canonical domain level.
- No speculative removal of Supabase “unused” indexes; low traffic is not proof that an index is obsolete.
- No primary-key or permissive-policy restructuring; those changes need staged data and authorization validation.
- No removal of the bracket module; it is an explicit future/disabled feature with tests.
- No persistence of historical CWL provider data.

## Remaining risks

Release blockers:

1. Configure the same strong `API_PROXY_SECRET` in the Cloudflare Worker and Cloud Run before enabling the new backend verification in production.
2. Apply `20260729121006_harden_database_access_and_indexes.sql` to staging, run authorization tests and Supabase advisors, then apply it to production with a backup.
3. Configure a permanent `www.clashpanel.com` to `https://clashpanel.com` redirect.
4. Enable Supabase leaked-password protection.
5. Complete live register/login/reset/logout/Google sign-in, AdSense consent, two-user RLS and core planner/operation/poll workflows.
6. Configure production monitoring and alerting for `401`, `403`, `429`, `5xx`, upstream failures and readiness.

Non-blocking follow-up:

- Introduce versioned asset filenames before adding long immutable browser caching.
- Optimize oversized Town Hall images after a visual comparison.
- Design and stage a CSP compatible with authentication, advertising and the current boot scripts.
- Review Supabase duplicate indexes and composite-primary-key drift in a controlled database maintenance window.

## Production checks

Observed before deployment:

| URL | Current result | Required after release |
| --- | --- | --- |
| `https://clashpanel.com/` | `200`, canonical homepage | `200` plus static security headers |
| `https://www.clashpanel.com/` | `200` duplicate host | permanent redirect to apex |
| `https://clashpanel.com/subpages/privacy` | `200` | `200` with canonical/social metadata |
| `https://clashpanel.com/subpages/privacy.html` | `307` to clean route | keep |
| `https://clashpanel.com/definitely-missing-page-audit` | `404` | keep |
| `https://clashpanel.com/assets/definitely-missing-audit.js` | `404` | keep |
| `https://clashpanel.com/api/definitely-missing-audit` | `404 text/html` | `404 application/json` |
| `https://clashpanel.com/robots.txt` | `200` | updated rules and production sitemap URL |
| `https://clashpanel.com/sitemap.xml` | `200` | five canonical public URLs |
| `https://clashpanel.com/ads.txt` | `200` | keep and verify publisher ID in AdSense |

Safe release order:

1. Create the same secret value in Cloudflare and Cloud Run while the old code still ignores it.
2. Apply and validate the database migration in staging.
3. Deploy the Worker/static build, then deploy the backend.
4. Apply the validated migration to production.
5. Configure the apex-host redirect and leaked-password protection.
6. Run every URL and manual control above, rerun Supabase advisors, and only then change the decision to **GO**.

No commits, pushes, merges, deployments, secret changes or live database writes were performed during this audit.

# ClashPanel release-readiness audit

Audit date: 2026-07-16  
Audited base: `origin/codex/profile-settings-theme` (`541dce5`)  
Working branch: `fix/release-readiness-functional`

## Baseline

- `npm ci`: passes; npm reports one high-severity advisory in the locked dependency tree.
- `npm run build`: passes with Vite 8.0.8.
- `node --check`: all 57 project JavaScript files pass.
- `mvn test`: passes but executes no tests (`src/test` is absent).
- `mvn package`: passes on Microsoft JDK 25 targeting Java 21. Maven warns that `--release 21` should replace separate source/target settings.
- Live Clash API, Supabase Auth, production Supabase data, email, and production deployment were not exercised during the baseline.

## Confirmed P0 findings

| Area | File(s) | Cause | Risk / affected functionality | Proposed fix |
|---|---|---|---|---|
| Authentication | `src/Java/API_Utils.java`, all `SUPABASE_*.java` | Protected endpoints do not authenticate. They trust `userId`, `ownerId`, and `actorId` from request bodies. | Account takeover-equivalent writes and reads across profiles, plans, friends, groups, polls, and accounts. | Verify Supabase access tokens server-side and derive the actor from the verified session only. Reject missing/invalid tokens with 401. |
| Database authorization | `src/Java/SUPABASE_Client.java`, existing migrations | Every database request uses the service-role key, bypassing RLS. No reproducible baseline or RLS policies exist in Git. | A route bug becomes unrestricted database access; fresh deployments cannot reproduce a safe schema. | Add forward-only schema/RLS migrations, least-privilege grants, authenticated ownership policies, and restrict service-role use to explicit administration. |
| Plans | `src/Java/SUPABASE_CWLPlanner.java` | Plan read/update by ID performs no owner/membership check; name lookup is global. | Any known plan ID can be read or overwritten; duplicate names can return another user's plan. | Require the authenticated actor, check `owner_id`/membership, use plan ID identity, and add optimistic `revision`. |
| Friends | `src/Java/SUPABASE_Friend.java` | Accept/reject logic accepts either direction and trusts the supplied user ID. | A caller can act as another user and can accept a request from the sender side. | Derive recipient from auth; accept/reject only a pending request addressed to that actor; enforce canonical uniqueness in SQL. |
| Groups/polls | `src/Java/SUPABASE_Group.java` | Role checks exist but operate on a spoofable actor ID. Poll answers are read-modify-write on `groups.polls` JSON. | Role bypass plus concurrent answers/status changes can overwrite one another. | Authenticate first and normalize polls/answers with atomic upserts and database constraints. |
| Registration/login | `src/Java/SUPABASE_User.java`, `src/assets/js/pages/login.js`, `register.js` | Custom password rows and localStorage UUID are used instead of real sessions. Frontend only logs results; registration does not complete the flow. | No secure session boundary; credentials and user IDs are handled by bespoke code. | Move to Supabase Auth sessions, return no hashes, store access/refresh session data safely, and finish form/error/redirect behavior. |

## Confirmed P1 findings

| Area | File(s) | Cause | Risk / affected functionality | Proposed fix |
|---|---|---|---|---|
| Global loading | `API-Client.js`, `Supabase-Client.js`, `profile_popup.js`, `loading-state.js` | Every request/cache lookup and profile preload is wrapped in the global overlay; nested wrappers have no show delay. | Homepage/profile/group/planner interaction is blocked and flickers for background work. | Add explicit `blocking`, `inline`, `background`, and `none` modes; inspect cache before loading; add delayed reference-counted overlay. |
| Browser cache | `cache/local-cache.js` | General response data is stored in localStorage; failed quota writes are not retried; stale refresh promise is fire-and-forget without a catch; any expired entry is an unlimited error fallback. | Quota failures, unhandled rejections, stale data without a maximum age, and unnecessary cache loss. | Move data cache to IndexedDB, keep bounded retention metadata, deduplicate refreshes, cap fallback age, and isolate user-scoped entries. |
| Backend cache | `API_Utils.java`, `cache/*` | Memory-only fresh-or-miss cache, fixed 1000 entries, no stale window, persistence, request coalescing, metadata, or negative cache. | Restart loses cache; parallel misses fan out to Clash; poor perceived performance and API pressure. | Add L1 SWR plus persistent Postgres L2, per-entity policies, single-flight, safe cache headers, cleanup, and negative cache. |
| Wrong cache keys | `src/assets/js/API/API-Clan.js` | Current war uses clan-info key/TTL; clan info uses member key/TTL; members have no browser policy. | Different endpoint payloads can be returned as each other and live data remains stale. | Use distinct normalized keys and policies for info, members, current war, league group, war, and raid seasons. |
| Clan search | `API-Clan.js`, `API_Clan.java`, `Main.java` | Frontend references undefined `clanTag`; backend route is declared but never registered/implemented. | Calling the wrapper throws; advertised API is dead. | Implement validated Clash clan search parameters and register the route, or document backend-only status. |
| HTTP hardening | `API_Utils.java`, `Main.java`, `Config.java` | `Access-Control-Allow-Origin: *`, unbounded `readAllBytes()`, no rate limits/security headers, fixed port, default executor, no graceful shutdown, and missing connect/read timeouts on Clash calls. | Cross-origin exposure, memory/request abuse, thread exhaustion, and hung requests. | Add configurable allowlist, body limits, safe headers, endpoint rate limits, bounded executor, timeouts, health/readiness, and shutdown hook. |
| Planner saves/loads | `cwl-plan-io.js`, `SUPABASE_CWLPlanner.java` | Autosave uses a global blocking overlay, no revision, and no serialized write queue; plan loading uses tokens only after requests complete. | Older writes can overwrite newer state; quick switches waste requests; UX blocks while saving. | Debounce and serialize saves per plan, add revision conflict checks, use abort/request tokens, render snapshots first, and use inline status. |
| Planner schema | `cwl-plan-io.js` and CWL templates | Legacy array encodes free players as a synthetic first clan and uses old identity assumptions. | Ambiguous data, fragile migrations, and possible loss during future changes. | Introduce a versioned `{schemaVersion, freePlayers, clans, pollMeta}` document with lossless legacy normalization. |
| Poll reminders | `groups.html`, `groups-polls.js`, `SUPABASE_Group.java` | Reminder UI is fallback text only; there is no notification/reminder model. | Required action does nothing and can mislead admins. | Add internal notifications and idempotent/cooldown reminder deliveries, unread list/count, and role checks. |
| Database model | `database/migrations/*` | Only three incremental migrations exist; polls/accounts remain JSON; constraints/FKs/indexes are incomplete. | Non-reproducible deployments, duplicate memberships/friendships, lost concurrent updates, unclear deletion/privacy behavior. | Add documented baseline/forward migrations, normalized account/poll/notification/cache tables, constraints, indexes, timestamps, and RLS. |
| i18n | `translations.js`, `i18n.js` | Locale parity differs; `setContent` treats any translated `<` as trusted HTML; one large file is patched by late `Object.assign` calls. | Missing UI strings and an avoidable translation-XSS surface. | Enforce parity in tests, default to `textContent`, allow explicit sanitized markup only, and split/generate locale dictionaries. |

Missing locale keys at baseline:

- EN: 8 (`home.ctaOperation`, six operation-step keys, `cwl.loadingPlans`).
- FR: 1 (`cwl.loadingPlans`).
- DE: 4 (three operation descriptions, `cwl.loadingPlans`).
- ES: 4 (three operation descriptions, `cwl.loadingPlans`).

## Confirmed P2 / completeness findings

| Area | File(s) | Cause / impact | Proposed fix |
|---|---|---|---|
| Bracket generator | `src/subPages/bracket-generator.html` | Static “Coming soon” page. | Implement single-elimination generation, byes, seed/shuffle, progression, local persistence, and versioned JSON import/export. |
| Drafts | `src/subPages/cwl-planner-drafts.html` | Static shell with no plan list or actions. | Load authenticated user's plans and add open/rename/copy/delete with confirmation and server authorization. |
| API wrappers | `API-Goldpass.js`, `API-Labels.js`, `API-Leagues.js`, `API-Locations.js` | Empty files while backend routes exist. | Add consistent wrappers or explicitly document/remove unused backend-only modules. |
| Login UX | `login.html`, `register.html`, page scripts | Inputs are not real forms; Enter/error/loading flows are incomplete; forgot password is `href="#"`; Google control is non-functional. | Use semantic forms and implement configured Auth actions; disable unavailable providers with an explanation. |
| Profile/group controls | profile and groups modules | Profile data fans out to multiple blocking calls; profile/group member data creates N+1 lookups; group add action/later section are incomplete. | Batch public profiles, background-refresh cached profile data, and connect controls to real flows. |
| Repository hygiene | tracked `.idea`, `*.iml`, `test-output`, `TEST_REPORT_*`, `vite-project` | Generated IDE/test/demo content is tracked. The isolated Vite demo is not referenced by the production build. | Remove tracked generated/demo artifacts after final reference verification and update `.gitignore`. |
| Documentation/CI | repository root | No README or CI workflow; environment example omits runtime/CORS/cache/auth settings. | Add architecture/setup/migration/deploy documentation, safe `.env.example`, and build/test/secret/static CI. |

## Race conditions and edge cases to cover

- Stale browser refreshes can reject without an attached handler.
- Parallel identical backend cache misses each call Clash.
- Poll answer and poll status writes overwrite the full JSON array.
- Plan autosaves are neither serialized nor revision checked.
- Quick plan/operation-board selection changes do not consistently abort old network work.
- Group leadership transfer spans several independent writes and can leave zero/multiple leaders after a partial failure.
- Account JSON updates are read-modify-write and can lose concurrent additions.
- The global loader becomes visible immediately for nested and cache-hit requests.

## Existing functionality at risk during fixes

- Authentication changes affect login, register, logout, profile, accounts, friends, groups, polls, planner, drafts, and operation board plan selection.
- Poll normalization affects group poll UI and CWL Planner availability imports.
- Plan schema/version changes affect planner save/load, operation board, drafts, and JSON import/export.
- Cache changes affect all Clash lookups and user/group/plan first rendering.
- Loading changes affect every API/Supabase wrapper and explicit group/operation actions.
- RLS/constraint migrations affect all existing rows; migrations must be forward-only, preceded by backup and duplicate-preflight queries, and tested against a representative copy.

## Release blockers

Public release is blocked until P0 authentication/authorization and safe forward migrations are deployed together, automated security regression tests pass, and production Auth/RLS/CORS/rate-limit configuration is verified. A passing build alone is not release evidence.

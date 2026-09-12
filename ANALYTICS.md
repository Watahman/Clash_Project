# ClashPanel product analytics

Last reviewed: 12 September 2026

This document describes the PostHog product analytics implementation currently
present in ClashPanel. It is an operational contract, not a promise that
analytics is enabled in every deployment. Analytics is fail-open: if the
configuration, browser request, queue, or PostHog request fails, the feature
request continues normally.

## Scope and privacy boundary

The implementation has one central browser module,
`src/assets/js/analytics/product-analytics.js`, and one server-side provider,
`src/Java/analytics/ProductAnalytics.java`. Feature code calls the small
wrappers in the browser module or the server provider; it does not call the
PostHog SDK directly. The browser sends an allowlisted event envelope to the
ClashPanel API. The browser never receives or uses a PostHog project key.

Analytics deliberately excludes email addresses, raw player or clan tags,
player or clan names, authentication tokens, API responses, passwords,
screenshots, free text, IP-based identity, and other unnecessary personal or
sensitive data. An authenticated event is identified only by the internal
ClashPanel profile ID. An anonymous event uses a generated in-memory browser
identifier and remains anonymous until a later authenticated request.

PostHog's capture endpoint documentation is available at
<https://posthog.com/docs/api/capture>.

## Transport and identity

1. The browser module validates the event name and keeps only the caller
   properties listed below. It posts JSON to the own API route
   `${APP_CONFIG.API_BASE_URL || '/api'}/ProductAnalytics`, using `sendBeacon`
   when available and otherwise `fetch` with `keepalive`. The request is
   best-effort and is never awaited by a product action.
2. The backend validates the envelope again. For a request with an
   authenticated ClashPanel session it resolves the internal user ID from the
   session; it does not trust a browser-supplied user ID. Without a valid
   session it uses only the generated anonymous ID.
3. The backend adds `logged_in`, `environment`, and `traffic_type`, and sets
   PostHog's top-level `distinct_id` to the internal user ID or anonymous ID.
   For anonymous events it also adds `$process_person_profile: false`.
4. A bounded asynchronous queue (capacity 256) forwards the resulting payload
   to `${POSTHOG_HOST}/i/v0/e/`. The worker uses short network timeouts and
   drops failed or full-queue events. PostHog failures therefore cannot block
   or slow normal requests.

The allowlisted caller property keys are `tool`, `action`, `entity_type`,
`mode`, `outcome`, `result_status`, and `source`. Values are scalar, bounded,
and sanitized. The central module may omit a value that is empty, too long, or
matches a sensitive format. The server rejects unknown event or property keys.

## Event contract

There are exactly eight product events. The first column lists the caller
properties actually used by the current code; omitted optional keys are not
sent. Every event also receives the central fields described above.

| Event | Caller properties and current values | Exact fire moment | Origin | Classification |
| --- | --- | --- | --- | --- |
| `tool_opened` | `tool`: one of `cwl_planner`, `cwl_tracker`, `clan_family`, `advanced_stats`, `achievements`, `bracket_generator`, or `minigames` | Once, when the central module initializes on a recognized tool route. A given tool is de-duplicated per browser page runtime. | Frontend | Usage/entry signal; neither a success nor a failure. |
| `tag_submitted` | `tool`, `action`, `entity_type`, `source`, and `result_status`. Current variants are planner clan/player add (`cwl_planner`, `add`, `clan` or `player`, `tag`, `success`) and tracker clan load (`cwl_tracker`, `load`, `clan`, `tag`, `success`). | Only after the existing add/validation flow succeeds, or after the tracker has resolved a usable clan report. It is not a keypress or button-click event. | Frontend | Successful submission/load intent; no failure counterpart is emitted. |
| `entity_load_succeeded` | `tool`, `action`, `entity_type`, `source`, `result_status`; some loads also send `mode`. Variants include planner `plan`/`saved`/`success`, tracker `cwl_report` (`fixture` or `live`) and `cwl_history` (`live` or `historical`), clan-family `clan_family` (`fixture` or `supabase`), achievements `achievements`/`summary`/`complete`, and Advanced Stats `stats` with `mode` equal to the selected period and status `complete` or `partial`. | After usable data has been applied to state and rendered. Advanced Stats emits this event when at least one usable section exists, including a partial response. | Frontend | Success. `result_status=partial` is a usable-but-incomplete success, not a complete-data claim. |
| `entity_load_failed` | `tool`, `action`, `entity_type`, `source`, `result_status`; some loads also send `mode`. Current variants cover planner `plan`, tracker `cwl_report`/`cwl_history`, clan-family `clan_family`, achievements `achievements`, Advanced Stats `stats` with `mode`, and the minigames `scenery_manifest` with `mode=scenery_scout`, `outcome=unavailable`. | After the existing load path has failed and the feature has entered its error/unavailable state. Aborted or stale requests are not treated as failures where the caller suppresses them. | Frontend | Failure. It is emitted only when no usable result exists for that load path. |
| `core_action_completed` | Backend: planner `tool=cwl_planner`, `action=plan_created`, `entity_type=plan`; Clan Family `tool=clan_family`, `action=family_created` or `family_joined`, `entity_type=family`; achievements `tool=achievements`, `action=achievements_calculated`, `entity_type=achievements`. Frontend: bracket `action=bracket_generated`, `mode=seeded` or `shuffled`, `outcome=success`, `result_status=complete`, `source=frontend`; minigames `action=game_started` or `game_completed`, `entity_type=minigame`, `mode` identifying `higher_lower`, `scenery_scout`, or `entity_guesser`, with completion outcome and `result_status=complete` when supplied. | Only after the relevant state transition is complete: a plan/group is successfully persisted, achievements are calculated after persistence, a bracket is rendered successfully, or a game run actually starts/completes. | Frontend and backend | Success. No event is emitted for an attempted but unsuccessful action. |
| `data_saved` | Backend planner `tool=cwl_planner`, `action=plan_created` or `plan_updated`, `entity_type=plan`; backend achievements `tool=achievements`, `action=achievement_imported`, `entity_type=achievements`. | After the existing backend persistence operation returns successfully and before the successful response is sent. | Backend | Success. It represents confirmed server-side persistence, not a save button click. |
| `account_created` | `tool=auth`, `action=signup` | Asynchronously after the password-signup response yields the internal ClashPanel profile ID. If that ID cannot be resolved within the bounded lookup, no event is sent. | Backend | Success. Google OAuth new-account detection is not currently instrumented. |
| `tracking_enabled` | `tool=advanced_stats`, `action=enable`, `entity_type=player` | After the Advanced Stats tracking-start operation succeeds for the authenticated user. | Backend | Success. It does not mean that historical data is complete. |

The `result_status` values are caller-provided status labels, not a second
event taxonomy. Current values include `success`, `failure`, `complete`,
`partial`, and `failed`. `mode`, `outcome`, and `source` are used only where
they explain a real product variant or result; there is no per-click, per-guess,
or per-keystroke tracking.

## Tool activation and core actions

| Major tool | Current activation/core action | What is and is not measured |
| --- | --- | --- |
| CWL Planner | A valid plan is successfully created (`core_action_completed`, `plan_created`) and persisted (`data_saved`). | Saved-plan loads and successful clan/player additions are also measured. Draft typing and arbitrary edits are not. |
| CWL Tracker / Operation Board | A valid live or historical CWL report is loaded, applied, and rendered (`entity_load_succeeded`). | The successful clan-report load is also represented by `tag_submitted`; historical overview/detail loads use the same load-success event. No individual roster click is measured. |
| Clan Family | A family is successfully created or joined by the backend RPC (`core_action_completed`, `family_created` or `family_joined`). | Membership-list loading is measured. Other family-management actions are not newly instrumented by this analytics contract. |
| Advanced Stats | Tracking is enabled (`tracking_enabled`), then usable statistics are loaded and rendered (`entity_load_succeeded`). | Partial section coverage is explicitly `result_status=partial`. There is no claim that an upstream history or analysis is complete, and no separate analysis-completed event exists. |
| Achievements | Achievement results are successfully calculated and persisted (`core_action_completed`, `achievements_calculated`, plus `data_saved` for an imported base). | Summary loading and its failure are measured. Imported player data itself is not sent to PostHog. |
| Bracket Generator | A bracket is generated, rendered, and the success status is shown (`core_action_completed`, `bracket_generated`). | This is frontend-only. Match-by-match winner clicks are not measured. |
| Minigames | A run actually starts and, where applicable, completes (`core_action_completed`, `game_started`/`game_completed`). | This is frontend-only. Individual guesses, answers, scores, and free-form game data are not sent. Manifest failure is an `entity_load_failed` event. |

## Internal and external traffic

Authenticated internal traffic is classified only on the server by matching
the resolved internal ClashPanel profile ID against the comma-separated
`POSTHOG_INTERNAL_USER_IDS` configuration value. No IP address, email, player
tag, or clan tag is used for this classification, and the internal status is
not exposed in the public UI. Anonymous pre-login traffic is external by
default. For an operator's own local browser testing, set the flag in that
browser's developer console:

```js
localStorage.setItem('clashpanel_analytics_internal', 'true')
```

Remove it when testing as an external visitor:

```js
localStorage.removeItem('clashpanel_analytics_internal')
```

The flag affects only anonymous requests from that browser. It does not add a
user identity and cannot override the server-side classification of an
authenticated account.

Development and Production must use separate PostHog projects and project API
keys. Set `CLASHPANEL_ENVIRONMENT=development` for Development and
`CLASHPANEL_ENVIRONMENT=production` for Production. Recommended production
reports and funnels use both `environment=production` and
`traffic_type=external`; internal traffic remains available by changing the
filter to `traffic_type=internal`.

## Configuration still required

Configure these values per deployment; do not commit real keys or internal
profile IDs:

| Value | Required setting |
| --- | --- |
| `POSTHOG_ENABLED` | `true` only when the deployment should capture product analytics; leave `false` to disable it. |
| `POSTHOG_HOST` | The PostHog region host, for example `https://us.i.posthog.com`, without a capture-path suffix. |
| `POSTHOG_PROJECT_API_KEY` | The project API key for the matching Development or Production PostHog project. ClashPanel keeps it server-side even though PostHog project API keys are designed for event ingestion. |
| `CLASHPANEL_ENVIRONMENT` | `development` or `production` (or another deliberate bounded environment label for a non-production deployment). |
| `POSTHOG_INTERNAL_USER_IDS` | Optional comma-separated internal ClashPanel profile IDs for the deployment's own testing accounts. |
| `APP_CONFIG.API_BASE_URL` | The browser's own ClashPanel API base, normally `/api`; it must expose `/ProductAnalytics` and must not be a PostHog URL. |

After deployment, verify that the backend route is reachable through the same
API origin as the product. No frontend PostHog SDK, browser project key, or
additional PostHog environment variable is required.

## PostHog setup after deployment

1. Create one PostHog project for Development and a separate one for
   Production. Put only the matching project key in each backend environment.
2. Add descriptions for the eight events and the properties listed above.
   Use `environment=production` and `traffic_type=external` as the default
   filters for production views. Keep a separate internal-debug view with
   `traffic_type=internal`.
3. Create an activation dashboard showing unique authenticated users,
   `tool_opened`, successful entity loads, core actions, confirmed saves, and
   load-failure rate. Exclude `logged_in=false` when measuring authenticated
   activation.
4. Create a reliability dashboard split by `tool`, `entity_type`,
   `result_status`, `source`, and `environment`. Keep `partial` Advanced Stats
   loads visible instead of combining them with complete loads.
5. Treat `account_created`, `tracking_enabled`, and `data_saved` as confirmed
   milestones. Do not use `tag_submitted` or `tool_opened` as proof that a
   backend action completed.

## Recommended funnels

Use the generic path as a template, not as a claim that every tool emits every
step:

`tool_opened → entity_load_succeeded → core_action_completed → data_saved`

Recommended tool-specific funnels are:

- CWL Planner: `tool_opened` → successful `tag_submitted` →
  `entity_load_succeeded` for `entity_type=plan` →
  `core_action_completed` with `action=plan_created` → `data_saved`.
- CWL Tracker: `tool_opened` → successful `tag_submitted` →
  `entity_load_succeeded` for `entity_type=cwl_report` or `cwl_history`.
- Clan Family: `tool_opened` → `entity_load_succeeded` for
  `entity_type=clan_family` → `core_action_completed` with
  `action=family_created` or `family_joined`.
- Advanced Stats: `tool_opened` → `tracking_enabled` →
  `entity_load_succeeded` for `entity_type=stats`; break out
  `result_status=partial`.
- Achievements: `tool_opened` → `entity_load_succeeded` for
  `entity_type=achievements` → `core_action_completed` with
  `action=achievements_calculated` → `data_saved` with
  `action=achievement_imported`.
- Bracket Generator: `tool_opened` → `core_action_completed` with
  `action=bracket_generated`.
- Minigames: `tool_opened` → `core_action_completed` with
  `action=game_started` → `action=game_completed`.

Planner and achievement backend events are queued asynchronously and may reach
PostHog in a slightly different order. Use the funnel's conversion window and
properties rather than assuming same-request ordering.

## Recommended retention reports and filters

- Normal returning-user retention: cohort on the first authenticated
  `tool_opened` in Production, filter `logged_in=true` and
  `traffic_type=external`, and measure a later authenticated
  `tool_opened` or `core_action_completed` in weekly or monthly intervals.
- CWL season-to-season usage: use `cwl_tracker` activity, especially
  `entity_load_succeeded` for `cwl_report` or `cwl_history`, with
  `environment=production`, `traffic_type=external`, and authenticated users.
  Configure retention windows around the actual CWL season cadence. The
  current event contract intentionally carries no season identifier, so this
  is a date-window approximation rather than an exact season-keyed report.
- Tool return dashboard: compare returning users by `tool` and keep internal
  traffic out of the default view.
- Failure follow-up: use `entity_load_failed` as a breakdown or secondary
  signal, never as a retention success event.

## Known limits and intentionally uninstrumented areas

- Google OAuth new-account detection is not currently reliable enough to emit
  `account_created`; the current backend capture covers the password-signup
  flow only.
- Advanced Stats can be partial, delayed, unavailable, or based on retained
  upstream observations. Analytics reports this with `partial` or failure
  statuses and does not convert it into a completeness claim.
- Bracket and minigame lifecycle events are frontend-only; there is no server
  confirmation for those local state transitions.
- CWL history events can represent progressive overview/detail loads, and the
  current contract does not carry a season key. Do not infer exact season
  identity from `source` alone.
- No per-click, per-guess, player/clan tag, player/clan name, email, token,
  raw API response, screenshot, or free-text analytics is collected.
- Google Analytics consent/storage and advertising consent are separate
  existing systems. PostHog product analytics is enabled by server
  configuration and must be used only where applicable legal requirements and
  deployment settings permit it; this implementation does not claim a
  PostHog-specific consent UI that the code does not provide.

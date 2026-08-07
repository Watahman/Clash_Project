# Advanced Stats — Integration Plan

Branch: `agent/advanced-stats-foundation`
Base: `master` at `4fcf6475f2aac6b79de4cbe102ea12431a0ea527`

## Goal

Integrate opt-in Advanced Stats without replacing existing ClashPanel systems. The feature will build durable personal gameplay history from newly observed player battle-log attacks, then derive lifetime-since-tracking statistics from that stored history.

Core pipeline:

`battle log -> deduplicate -> parse army -> persist battle -> update aggregates -> expose read API -> render UI`

"Lifetime" always means **since tracking started / all tracked time**.

## Existing code that must be reused

- `src/Java/API_Player.java`
  - `/PlayerBattleLog` already proxies `/players/{tag}/battlelog`.
- `src/Java/API_Utils.java`
  - existing Clash API key rotation, HTTP handling and cache helpers.
  - use internal Clash fetching; do not call ClashPanel's own HTTP endpoint from the worker.
- `src/Java/SUPABASE_User.java`
  - existing authenticated user handling and verified linked-account flow.
  - Advanced Stats must only start for an account already linked to the authenticated user.
- `src/Java/Config.java`
  - existing endpoint/env configuration style.
- `src/Java/Main.java`
  - existing explicit route registration style.
- `SUPABASE_Client`
  - keep database access consistent with the existing backend.
- existing frontend API helper, shell/navigation, loading/error components, i18n and Clash assets.

Do not introduce a second auth system, a second player-verification system, or direct frontend calls to the Clash API.

## Important branch rule

`agent/advanced-achievements-foundation` is currently separate from master. Advanced Stats is therefore implemented independently from it.

Do **not** merge/cherry-pick Advanced Achievements into this branch just to support this feature.

When Advanced Achievements later exists on master, add the integration through a small event/adapter layer. The Advanced Stats collection pipeline remains the single source of battle-history ingestion.

---

# Phase 0 — Branch, baseline and contract

Status: started.

Tasks:

1. Work only on `agent/advanced-stats-foundation`.
2. Keep master untouched.
3. Keep this integration plan in the branch.
4. Lock product semantics:
   - opt-in only;
   - stats begin when tracking is enabled;
   - recent battles may be bootstrap-imported and explicitly marked;
   - stop != delete;
   - known collection gaps are never hidden.
5. Before functional changes, run the existing baseline test/build suite locally when implementation begins:
   - `mvn test`
   - `npm run check`

Gate to next phase:

- branch cleanly based on master;
- no production behavior changed;
- baseline known.

Commit boundary:

`docs: add advanced stats phased integration plan`

---

# Phase 1 — Database + backend domain foundation

Purpose: add the storage model without exposing the feature to users yet.

## Database migration

Add a migration under `database/migrations/` for the core tables:

1. `advanced_stats_tracking`
   - one row per `user_id + player_tag`;
   - status;
   - start/poll timestamps;
   - bootstrap metadata;
   - failure/gap state;
   - battle counter;
   - optional worker lease fields.

2. `advanced_stats_battles`
   - compact durable battle history;
   - stable fingerprint unique per tracking row;
   - timestamp/type/opponent/performance;
   - `army_share_code`;
   - bootstrap flag;
   - parser version/status;
   - army-data-available flag.

3. `advanced_stats_battle_units`
   - one normalized unit record per battle/category;
   - enables 7/30/90-day filtering and aggregate rebuilds.

4. `advanced_stats_unit_totals`
   - lifetime-since-tracking counters.

5. `advanced_stats_army_totals`
   - normalized army hash + performance aggregate.

6. `advanced_stats_daily`
   - graph-ready common daily metrics.

7. optional `advanced_stats_tracking_gaps`
   - explicit known-gap intervals.

## Backend package

Prefer a dedicated package:

`src/Java/advancedstats/`

Initial classes:

- `AdvancedStatsTrackingStatus`
- `AdvancedStatsUnitCategory`
- `AdvancedStatsModels`
- `AdvancedStatsRepository`
- `BattleFingerprint`

No frontend and no polling yet.

## Correctness requirements

- unique DB constraint on `(tracking_id, battle_fingerprint)`;
- stable unit keys, never localized display names as IDs;
- no CHECK constraint for battle types that Supercell may extend;
- child data cascades when tracking data is deleted;
- repository operations are parameterized/escaped through the existing Supabase client conventions.

## Tests

- migration checker;
- fingerprint deterministic/changes correctly;
- model/status tests where useful;
- `mvn test`;
- `npm run check:migrations`.

Gate:

- schema is valid;
- no existing route/UI behavior changes;
- all baseline tests still pass.

Suggested commit:

`feat: add advanced stats storage foundation`

---

# Phase 2 — Tracking ownership + lifecycle API

Purpose: users can safely enable/disable tracking before battle processing exists.

## Backend entry point

Add a route class following current backend style, e.g.:

`src/Java/SUPABASE_AdvancedStats.java`

Register it from `Main.java` and add endpoint constants to `Config.java`.

## Endpoints

Use existing ClashPanel naming conventions rather than forcing REST purity if that makes endpoint checks simpler.

Required logical operations:

- start tracking;
- get tracking status;
- pause;
- resume;
- stop future tracking;
- permanently delete Advanced Stats data.

Possible route names:

- `/AdvancedStatsTrackingStart`
- `/AdvancedStatsTrackingGet`
- `/AdvancedStatsTrackingPause`
- `/AdvancedStatsTrackingResume`
- `/AdvancedStatsTrackingStop`
- `/AdvancedStatsDataDelete`

## Ownership

Start/resume/delete must:

1. `requireAuthenticatedUser`;
2. normalize player tag with existing `CacheKeys.requireValidTag`;
3. read the authenticated user's `users.accounts`;
4. verify the requested tag is one of the already linked accounts;
5. reject otherwise with 403.

Do not ask for the Clash API account token again when starting Advanced Stats; linking already performed that verification.

## Semantics

- Start is idempotent.
- Stop sets `STOPPED`; it does not erase history.
- Delete is separate and destructive.
- Pause warns that missing battles may be unrecoverable.
- Resume records/opens a possible gap before collection resumes.

## Tests

- owner can start;
- non-owner cannot start/read private stats;
- duplicate start does not duplicate row;
- stop preserves data;
- delete cascades;
- invalid tag rejected;
- unauthenticated mutation rejected.

Gate:

- lifecycle state is correct without any scheduler dependency.

Suggested commit:

`feat: add advanced stats tracking lifecycle`

---

# Phase 3 — Battle ingestion, parsing and deduplication

Purpose: make one newly observed attack the atomic unit of Advanced Stats.

## Internal Clash fetch

Reuse `API_Utils` internal Clash-fetch/caching capability.

Do **not** have the worker call `/PlayerBattleLog` over HTTP.

Prefer a small reusable internal function/service that obtains:

`/players/{encodedTag}/battlelog`

with a freshness policy appropriate for tracking.

Avoid a broad rewrite of `API_Player` or `API_Utils`.

## New backend components

Under `src/Java/advancedstats/`:

- `AdvancedStatsBattleProcessor`
- `ArmyShareCodeParser`
- `AdvancedStatsAggregationService`
- `ClashGameDataService` only if ID/name metadata resolution is actually required.

## Processing flow

For every attack entry:

1. normalize relevant fields;
2. ignore defense entries for MVP unit usage;
3. create fingerprint;
4. begin DB operation/transaction-like sequence;
5. insert battle with unique fingerprint;
6. if duplicate: stop with no aggregate change;
7. parse `armyShareCode`;
8. insert battle-unit rows;
9. upsert unit totals;
10. upsert normalized army totals;
11. upsert daily totals;
12. mark battle processed;
13. increment tracking battle count.

## Parser behavior

- malformed army code must not corrupt totals;
- unknown unit IDs become `unknown_<id>` and generate a structured warning;
- retain the raw compact `army_share_code` for reprocessing;
- store `parser_version`;
- missing army code may still store battle performance with `army_data_available=false`.

## Bootstrap

Use bootstrap-import mode:

- first poll imports currently available recent attacks;
- `bootstrap_import=true`;
- UI later explains that some imported attacks can precede the exact start moment.

## Tests

Critical tests:

- same battle twice => one battle and one set of counters;
- one changed identity field => different fingerprint;
- valid troops/spells/siege parse;
- malformed code does not partially increment;
- unknown ID does not crash processing;
- duplicate cannot increment aggregates even under retry;
- bootstrap rows marked correctly.

Gate:

- manually feeding repeated battle-log fixtures is idempotent;
- aggregate rebuild is possible from stored raw battles/battle units.

Suggested commits:

`feat: add advanced stats battle ingestion`

`feat: add advanced stats army aggregation`

Split these if the phase becomes too large.

---

# Phase 4 — Poll worker + Cloud Run scheduling

Purpose: continuously collect future battles without relying on a user's browser.

## Worker strategy

Do not use an in-memory Java timer as the only scheduler because Cloud Run can restart/scale to zero.

MVP design:

- Google Cloud Scheduler calls a protected backend endpoint;
- backend selects due tracking rows by `next_poll_at`;
- rows are claimed with lease/lock protection;
- a bounded batch is processed;
- each tracker receives its next poll timestamp.

Internal endpoint concept:

`POST /InternalAdvancedStatsPoll`

It must not be a normal public user endpoint.

## Scheduling rules

Start conservatively around 15–30 minutes per active player, adjustable through `next_poll_at` rather than hard-coding a permanent cadence.

Later adaptive behavior:

- recently active: faster;
- inactive: slower;
- rate limited/outage: backoff.

## Concurrency

Use a lease/claim mechanism and retain DB fingerprint uniqueness as the final double-counting guard.

## Failure handling

- single 429/5xx => reschedule, not ERROR;
- repeated failures => `DEGRADED`;
- prolonged uncertainty => record known tracking gap;
- never silently claim complete stats after a known gap.

## Tests

- due rows selected only once;
- overlapping workers cannot double aggregate;
- 429 uses backoff;
- 5xx/timeout leaves existing totals intact;
- failure counters/status recover after successful poll.

Gate:

- developer account can run through multiple scheduled cycles without duplicates;
- request volume observable.

Suggested commit:

`feat: add advanced stats scheduled collection`

---

# Phase 5 — Read APIs and derived statistics

Purpose: provide stable graph/UI-ready responses without forcing the frontend to compute domain logic.

Logical APIs:

- overview;
- units;
- armies;
- battles with cursor pagination;
- trends.

Filters:

- 7d;
- 30d;
- 90d;
- all tracked time;
- category;
- battle type where useful.

MVP derived fields:

- attacks tracked;
- average stars;
- average destruction;
- 3-star rate;
- total quantity by troop/spell/siege;
- battles containing each unit;
- favorite troop;
- favorite spell;
- favorite army;
- favorite-army average stars/destruction.

The backend must return already normalized/display-ready domain data; the frontend should mainly render/filter.

Gate:

- endpoint contract tests pass;
- pagination works;
- period filtering matches known fixtures.

Suggested commit:

`feat: expose advanced stats read APIs`

---

# Phase 6 — Frontend + navigation + i18n

Purpose: expose Advanced Stats without changing unrelated pages.

Likely additions following existing project structure:

- `src/subpages/advanced-stats.html`
- `src/assets/js/pages/advanced-stats.js`
- `src/assets/css/advanced-stats.css`
- small Supabase/API wrapper only if existing frontend helper structure needs one;
- navigation registration;
- EN/NL first, then all currently supported site languages before public release.

## UI states

1. Not tracking
2. Initializing
3. Active
4. Paused
5. Degraded/known gap
6. Stopped
7. Error without raw console/API details

## Active-page sections

- tracking since / last updated / attacks tracked;
- overview KPIs;
- troop usage;
- spell/siege usage;
- favorite armies;
- performance trend;
- recent tracked battles;
- settings: pause/stop/delete.

## UX wording

Never say "complete lifetime stats".

Use:

- `All tracked time`
- `Since tracking started`
- `Tracking since ...`

Gate:

- responsive desktop/mobile;
- no unrelated shell/sidebar regressions;
- loading/empty/error states tested;
- `npm run check` passes.

Suggested commits:

`feat: add advanced stats interface`

`feat: add advanced stats translations and responsive states`

---

# Phase 7 — Advanced Achievements integration

This phase starts **only after** the Advanced Achievements work is present on master or otherwise intentionally merged by the user.

Do not duplicate collection.

Advanced Stats becomes the history/event source.

Preferred integration:

`AdvancedStatsBattleProcessedEvent`

with enough normalized data for achievements to evaluate usage-based goals.

Advanced Achievements consumes this event or reads Advanced Stats aggregates; it does not poll the battle log independently for the same statistics.

If the achievements branch has changed significantly by then, re-inspect the implementation before integrating rather than assuming today's branch layout.

Suggested commit:

`feat: connect advanced stats to advanced achievements`

---

# Phase 8 — Hardening and staged rollout

Before public release:

1. feature flag disabled by default;
2. enable only developer account;
3. verify several real attack cycles;
4. inspect parser failures/unknown IDs;
5. inspect request volume and DB growth;
6. verify stop/delete/account deletion;
7. verify known-gap state;
8. test Cloud Run restarts/overlapping poll calls;
9. run full:
   - `mvn test`
   - `npm run check`
10. enable for a small subset;
11. only then enable publicly.

Useful metrics:

- active trackers;
- polls total/failed;
- new battles;
- duplicate battles;
- parser errors;
- upstream 429/5xx;
- oldest active `last_successful_poll_at`;
- known gaps.

---

# Context / phase working rule

Do not attempt the entire feature in one giant change.

For each phase:

1. re-read this plan and the relevant current source files;
2. inspect whether master/branch changed since the previous phase;
3. implement only that phase's scope;
4. add/adjust tests with the code;
5. run the phase gate;
6. commit with a focused message;
7. summarize what changed and what remains;
8. continue to the next phase only after the current branch is in a consistent state.

If conversation context becomes too large, the next session should resume from:

- branch: `agent/advanced-stats-foundation`;
- this file: `docs/advanced-stats-integration-plan.md`;
- latest commits on that branch;
- the Advanced Stats technical specification.

This makes the repository itself the durable source of implementation context rather than relying on chat history.

---

# Non-goals for the first implementation

Do not add these before the MVP pipeline is proven:

- public Advanced Stats profiles;
- yearly Wrapped UI;
- every possible hero/pet/equipment stat;
- complex adaptive polling heuristics;
- automatic tracking of every searched player;
- recruitment/clan-wide background tracking;
- massive refactors of existing API/auth/cache systems.

The first priority is **correct, deduplicated, recoverable personal battle history**.

# ClashPanel Functional Contract

## Purpose

This document is a **redesign preservation contract**.

A visual redesign may change:
- page composition;
- navigation hierarchy;
- labels/copy;
- component structure;
- CSS architecture;
- responsive interaction model.

A redesign must **not silently remove or weaken existing user capabilities**.

Before changing a module:
1. map the existing behavior to this contract;
2. note any implementation-specific dependency;
3. preserve the behavior or explicitly document an intentional replacement;
4. test the important happy path and failure/empty states after redesign.

---

# 1. Global application shell

## Existing responsibilities

- authenticated workspace shell;
- current-page navigation state;
- collapsible desktop sidebar;
- mobile navigation;
- language control;
- light/dark theme control;
- notifications surface;
- user identity/profile shortcut;
- session/auth synchronization;
- page guidance/help integration.

## Redesign preservation rules

- Do not break direct URLs.
- Do not require a page reload for basic shell controls unless already required.
- Preserve theme and language persistence.
- Preserve notification access.
- Preserve profile/account access.
- Preserve keyboard-accessible navigation.
- Replace page-specific navigation injection with one central module registry where practical.
- Remove "CWL workspace" as the global identity; ClashPanel is broader than CWL.

---

# 2. Dashboard

## Current user jobs

- enter the main workspace;
- start a CWL plan;
- open CWL tracking;
- open Clan Family;
- open Achievements;
- continue recent saved plans;
- open recent Clan Families;
- see linked-account count and reach Profile.

## Redesign target

Broaden the dashboard to the whole product:
- Manage;
- Plan;
- Compete;
- Play;
- Progress.

## Must preserve

- recent saved-plan access;
- Clan Family access;
- linked-account/profile access;
- direct launch of important modules.

## May improve

- contextual "Needs attention";
- recent work;
- Explore/discovery;
- visibility of Advanced Stats, Games, War Board and Brackets.

---

# 3. CWL Planner

## Core plan lifecycle

- load/select saved plan;
- rename plan;
- create new plan;
- save plan;
- save status feedback;
- plan save-limit feedback;
- undo last plan change.

## Clan planning

- one plan may contain multiple clans;
- add clan;
- clan-specific roster format/limits must remain supported;
- planning board must preserve per-clan lineups across CWL days;
- player movement between free roster and clan/day planning must remain possible.

## Free roster

- display total free-roster count;
- search by player name/tag;
- sort by Town Hall or name;
- filter/contextualize by Clan Family poll result;
- display roster filter status.

## Add Players

Supported input sources must remain discoverable:

### By tag
- player tag;
- clan tag where supported by current logic.

### My accounts
- own linked accounts.

### Friends
- linked/friend accounts available through the current profile/social model.

### Clan Family
- choose Clan Family;
- choose poll result where available;
- preview linked clans/members;
- load eligible accounts.

## Spreadsheet import

Preserve the existing workflow:
- upload Excel/CSV-compatible file;
- scan sheets;
- detect unique player/clan tags;
- validate;
- review before import;
- import accepted entries;
- show validation/duplicate/error feedback.

## Auto Plan

Preserve:
- Auto Plan entry point;
- automatic mode;
- guided mode;
- preview before applying;
- explicit apply/cancel;
- status/error feedback;
- multi-clan distribution where supported.

## Optimize Plan

Preserve:
- analyze current plan;
- suggestion preview;
- accept individual suggestions where supported;
- apply accepted;
- apply all;
- cancel;
- status/error feedback.

## Player context

Preserve all planning-relevant player data already available, such as:
- name/tag;
- Town Hall;
- availability;
- role/rotation context;
- performance context/popover where available.

## Error/edge behavior to preserve

- duplicate player handling;
- invalid tags;
- failed API lookup;
- save limit reached;
- unavailable Clan Family/poll;
- empty plan;
- large roster;
- roster/clan capacity conflicts;
- stale/failed live lookups must not corrupt saved planning.

---

# 4. Saved Plans

## Core jobs

- list saved plans;
- search;
- sort;
- open;
- rename;
- duplicate/copy where currently supported;
- delete;
- show plan metadata such as clans/free roster/updated time.

## Preserve

- current plan limits;
- destructive-action confirmation where relevant;
- reliable navigation back into Planner.

---

# 5. CWL Tracker / Operation Board

## Source selection

Preserve both major entry modes:

### Saved-plan mode
- choose planning;
- choose clan inside planning.

### Direct-clan mode
- enter/load clan tag without a saved plan.

## Critical direct-clan rule

Planning-only data/columns must not appear as if they exist when a clan is loaded directly.

## CWL availability state

If no current CWL exists:
- show a clear no-CWL state;
- do not leave stale data from a previously loaded clan/CWL visible.

Current behavior identifies this as `NO_ACTIVE_CWL`, clears the live report, and opens the historical overview for the selected clan. Preserve that stale-data clearing and history fallback.

## Sync/data controls

Preserve where currently supported:
- refresh live data;
- auto-refresh/pause;
- sync/status feedback;
- JSON import/export;
- current/history season selection.

The selected base exposes both import and export controls and an imported-plan adapter. Preserve them as active functionality.

## Live view

Preserve access to:
- current war/CWL phase;
- current matchup/score;
- attacks;
- stars;
- destruction;
- war-day state;
- roster/live participation context.

## League view

Preserve:
- current position;
- projected finish where available;
- completed rounds;
- W/L/D record;
- stars per day;
- position per day;
- 7-day overview;
- full standings;
- projected/partial-data labeling.

## Roster view

Preserve:
- search/filter;
- sort;
- player;
- Town Hall;
- planning/participation when source supports it;
- attacks;
- stars;
- average destruction;
- missed attacks;
- player detail/performance access where supported.

## Bonuses

Preserve:
- recommended-recipient count;
- Fair strategy;
- Performance strategy;
- Contribution strategy;
- Custom strategy;
- custom weights where supported;
- recommendation results;
- source/limitation wording.

## History

Preserve:
- previous seasons where data exists;
- league movement;
- historical summary;
- partial-history labeling;
- distinction between historical and live/current data.

---

# 6. Regular War Board

## Source/loading

Preserve:
- linked/source clan selection where available;
- direct clan tag loading;
- no-current-war state;
- refresh/live data.

The current state normalizer treats private/unavailable/not-in-war responses as `notAvailable`. A league-war payload throws `ACTIVE_CWL_WAR` and must direct the user to the CWL tool rather than presenting it as a regular war.

## Views

Preserve the meaningful operational areas:
- Live;
- War Map;
- Roster;
- History.

## Live

Preserve:
- war state;
- own vs opponent score;
- stars;
- destruction;
- attack usage/remaining;
- needs-attention/missed-attack information.

## War Map

Preserve:
- ordered bases;
- own/enemy side distinction;
- Town Hall/base context;
- stars/destruction received;
- selected base detail;
- attack detail where available.

## Roster

Preserve:
- player list;
- Town Hall;
- attack availability/usage;
- completed attack information;
- missed attacks.

## History

Preserve recent-war outcome/context where available.

---

# 7. Clan Family

## Family lifecycle

Preserve:
- create Clan Family;
- join Clan Family;
- invitation/join code;
- switch between multiple families;
- leave family.

## Identity

Preserve:
- family name;
- member count;
- user role;
- join/invite code;
- linked-clan count;
- account/member summary.

## Members

Preserve:
- member list;
- linked Clash accounts;
- role display;
- role/permission management for authorized users.

## Permissions

Administrative actions must remain permission-aware.
Normal members must not receive leader-only controls merely because the UI moved.

Current role rules are concrete:
- roles are `leader`, `co_leader` and `member`;
- leaders can promote/demote co-leaders and members and transfer leadership;
- co-leaders can manage normal members but cannot manage the leader or another co-leader;
- backend/RLS authorization remains authoritative even when a control is hidden in the UI.

## Clans

Preserve:
- linked clan list;
- add/link clan;
- clan tag;
- shared visibility;
- account audit / unlinked-account scan where available.

## Polls

Current backend behavior is CWL-availability-oriented.

Preserve:
- create poll;
- title;
- round/day count;
- poll limit;
- open/closed poll overview;
- answer poll;
- answers per account/day;
- results;
- reminders;
- active-poll indication;
- member vs admin behavior.

Do not fake generic poll types unless the backend actually supports them.

## Redesign target

The information architecture may become:
- Overview;
- Members;
- Clans;
- Polls;
- Settings.

Availability should be treated as an active poll/use case rather than the permanent identity of Clan Family.

---

# 8. Advanced Stats

## Account requirement

Preserve:
- verified linked account selection;
- no-linked-account state;
- profile-load failure/retry.

## Tracking lifecycle

Preserve:
- not tracking;
- start tracking;
- initializing;
- active;
- pause;
- resume;
- degraded tracking;
- lifecycle error;
- stop;
- delete tracked data;
- tracking since;
- last updated;
- battles processed.

Destructive tracking controls may move into overflow/settings, but cannot disappear.

The persisted backend status values are `INITIALIZING`, `ACTIVE`, `PAUSED`, `DEGRADED`, `STOPPED` and `ERROR`. `Not tracking` is the absence of a tracking record rather than an enum value.

## Time ranges

Preserve:
- 7 days;
- 30 days;
- 90 days;
- all tracked time.

## Summary

Preserve:
- attacks;
- average stars;
- 3-star rate;
- average destruction;
- favorite troop;
- favorite spell;
- favorite siege;
- favorite army.

## Trends

Preserve:
- performance trend;
- empty state when no attacks exist.

## Armies

Preserve:
- favorite/most-used army compositions;
- empty state for unavailable composition data.

## Unit Usage

Preserve categories:
- All;
- Troops;
- Super Troops;
- Spells;
- Siege;
- Heroes;
- Pets;
- Equipment.

Preserve metrics:
- total used;
- attacks present;
- usage rate.

## Battle timeline

Preserve:
- tracked attacks;
- load more;
- army context;
- data-quality/partial-data warning where relevant.

## Critical data rule

Missing data is **not zero**.

The redesign must preserve:
- partial-data warnings;
- complete-since context;
- explicit unavailable/unknown states.

---

# 9. Achievements

## Account selection

Preserve:
- verified linked account selection;
- refresh;
- private/per-account storage semantics.

## Progress system

Preserve:
- achievement level;
- XP;
- unlocked tiers;
- completed achievement families;
- progress to next level.

## Data sources

Achievements combine multiple sources, including current/live data and optional historical/imported sources.

Preserve:
- source overview;
- source availability;
- waiting/unknown state;
- missing source must not become 0 progress.

## Base snapshot import

Preserve:
- optional import;
- file selection;
- clipboard paste;
- clear;
- JSON validation;
- selected-player tag validation;
- snapshot preview;
- save;
- feedback/errors;
- snapshot timestamp/history semantics.

The redesign may move this into Data Sources/overflow, but must retain it.

## Library

Preserve:
- search;
- category filter;
- rarity filter;
- status filter;
- source filter;
- load more.

Statuses include:
- in progress;
- partly unlocked;
- completed;
- not started;
- waiting for data / unknown.

Rarity includes the existing rarity ladder.

## Cross-module integrations

Do not break achievements backed by:
- live profile;
- base progress;
- wars;
- CWL;
- Advanced Stats;
- Clan Family;
- other current ClashPanel activity.

---

# 10. Minigames

## Public availability

Preserve the public `/minigames` experience and SEO/indexability.

## Modes

Both games preserve:
- Daily;
- Practice.

Daily:
- shared challenge semantics;
- reset timing;
- persisted result.

Practice:
- category selection where supported;
- repeat/new round;
- must not overwrite the Daily result.

## Entity Guesser

Preserve:
- broad category selection;
- searchable answer picker/combobox;
- up to six attempts;
- comparison feedback;
- exact/close/partial/wrong semantics;
- directional higher/lower hints where applicable;
- two optional hints;
- score;
- streak;
- best;
- result state;
- share result;
- sideways comparison scrolling on narrow screens.

## Higher or Lower

Preserve:
- nine comparisons;
- shown left value;
- hidden right value;
- Higher;
- Lower;
- equal-value pairs excluded;
- question count;
- score;
- correct count;
- combo;
- result/reveal;
- Next action;
- Daily/Practice state persistence.

## Asset rule

Game imagery may enhance entity recognition but must not leak hidden answers through:
- alt text;
- DOM text;
- hidden preload metadata;
- inaccessible but inspectable labels.

---

# 11. Bracket Generator

## Functional engine contract

Before redesign, verify the actual engine present on the selected implementation branch.

The intended/current functional scope to preserve where engine code exists:
- bracket name;
- participant list;
- participant-count validation;
- seeded order;
- shuffle;
- bracket generation;
- BYE handling;
- winner selection;
- automatic winner progression;
- changing a previous winner updates downstream state correctly;
- champion;
- local restore/persistence;
- JSON import;
- JSON export;
- reset.

Repository verification on the selected base confirms this engine is implemented locally with a maximum of 128 unique participants. The public/workspace "Coming soon" copy is a release-state mismatch that must be corrected after browser and regression validation; it is not evidence that the engine is fake.

## Public release state

The current public page may still describe the tool as "Coming soon".

Do not let public marketing contradict the actual engine:
- if stable enough, release/index honestly;
- if not stable, keep preview/noindex honestly;
- never market unsupported cloud saves/collaboration/share links as live.

---

# 12. Profile / Accounts / Social

## Profile identity

Preserve:
- ClashPanel display identity;
- profile access;
- language;
- theme;
- logout/session actions.

## Linked Clash accounts

Preserve:
- list accounts;
- link/add account;
- verification flow/token where required;
- remove/manage account where supported;
- Town Hall/clan/league context where available.

Modern copy should prefer "linked accounts" over "bases" when referring to accounts.

The current add-account flow requires both a normalized Clash player tag and an API token. It rejects duplicate accounts and surfaces `ACCOUNT_VERIFICATION_FAILED` / `ACCOUNT_TOKEN_REQUIRED` as verification failure.

## Friends/social

Preserve where currently available:
- friends;
- incoming requests;
- sent requests;
- add/accept/reject actions.

Do not advertise friend removal unless an equivalent current implementation is verified or deliberately added; the selected base exposes add, incoming/sent request views, accept and reject.

## Account/settings

Preserve:
- display name/profile settings;
- password/security action where supported;
- notification controls where supported;
- session/logout;
- cache/advanced controls only if still functionally necessary.

## Redesign target

Small profile popover for quick actions plus a full `/app/profile` page is preferred, but behavior must remain available.

---

# 13. Authentication

## Login

Preserve:
- email/password login;
- Google login if enabled;
- forgot-password path;
- loading/error feedback;
- session redirect.

## Registration

Preserve:
- account creation;
- current required fields;
- Google path if enabled;
- validation;
- errors;
- post-registration/session behavior.

Do not force clan/CWL onboarding merely because the UI is redesigned.

---

# 14. Public website

## Public routes

Preserve currently indexable routes and route equity, including the major product/resource/legal pages.

Typical public surfaces include:
- homepage;
- CWL Planner landing page;
- CWL Tracker landing page;
- Clan Management landing page;
- Minigames;
- Bracket preview/release page;
- Guides;
- Methodology;
- About;
- Changelog;
- Privacy;
- Cookies;
- Terms;
- Contact.

## SEO contract

Preserve or improve:
- canonical URLs;
- one meaningful H1;
- title;
- meta description;
- index/noindex intent;
- sitemap membership;
- robots behavior;
- OpenGraph/Twitter data;
- structured data when accurate;
- semantic internal links.

Private workspace pages remain noindex.

## Legal/trust

Preserve:
- privacy page;
- cookie handling/preferences;
- terms;
- contact;
- Supercell Fan Content Policy link/disclaimer;
- unofficial/not-endorsed disclosure.

Do not invent legal claims.

---

# 15. Internationalization

Current supported redesign validation set:
- English;
- Dutch;
- French;
- German;
- Spanish.

Preserve:
- existing translation keys where practical;
- language switching;
- long-translation layouts;
- translated accessibility labels;
- no hardcoded English-only strings in newly redesigned shared UI unless explicitly unavoidable and documented.

---

# 16. Accessibility

Preserve/improve:
- skip links where public pages have them;
- keyboard navigation;
- focus visibility;
- button semantics;
- form labels;
- dialog semantics;
- tab semantics;
- `aria-current`;
- `aria-live` for async status;
- reduced-motion behavior;
- non-color status cues.

---

# 17. Functional acceptance rule

A module is **not accepted** merely because it looks better.

For every module, compare:
1. this contract;
2. the UI State Matrix;
3. baseline screenshots;
4. real browser behavior;
5. current persisted data/API behavior.

Any missing capability must be:
- restored;
- intentionally replaced with equivalent/better behavior;
- or explicitly documented as an approved removal.

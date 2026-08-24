# ClashPanel Baseline Screenshot Plan

## Goal

Capture the **current functional UI before the redesign**.

These screenshots are not design references to imitate.
They are regression evidence showing:
- controls that existed;
- information that existed;
- unusual states;
- mobile behavior;
- modals/drawers;
- error/empty states.

## Viewports

Capture at least:

```text
Desktop wide     1440×1000
Desktop compact  1200×900
Tablet           768×1024
Mobile           390×844
```

For highly horizontal modules also capture:
```text
Large desktop    1680×1050
```

## Naming convention

```text
<module>/<viewport>/<state>.png
```

Example:

```text
planner/1440/normal-plan.png
planner/390/add-players.png
tracker/1440/no-cwl.png
```

---

# 1. Global shell

Capture:
- expanded sidebar;
- collapsed sidebar;
- mobile menu open;
- notifications empty;
- notifications with entries;
- profile quick surface;
- dark;
- light;
- one long-translation language (German or French).

---

# 2. Dashboard

Desktop + mobile:
- rich normal account;
- no recent plans;
- no Clan Families;
- linked-account line;
- loading if easy to reproduce.

---

# 3. CWL Planner — highest priority

## Desktop 1440/1680

Capture:
- normal one-clan plan;
- multi-clan plan;
- large free roster;
- search filter active;
- poll filter active;
- Add Players → tag;
- Add Players → own accounts;
- Add Players → friends;
- Add Players → Clan Family;
- spreadsheet upload;
- spreadsheet review with invalid/duplicate entries;
- Auto Plan automatic preview;
- Auto Plan guided preview;
- Optimize suggestions;
- some Optimize suggestions accepted;
- roster/day full conflict if reproducible;
- player performance/context popover;
- unsaved/dirty plan;
- save-limit message.

## Mobile 390

Capture:
- normal planner;
- free roster;
- clan/day planning;
- Add Players;
- player detail;
- how player movement currently works;
- Auto Plan/Optimize if usable.

---

# 4. Saved Plans

Desktop + mobile:
- normal list;
- search;
- sort;
- row/card actions;
- rename;
- delete confirmation;
- plan limit reached.

---

# 5. CWL Tracker

Desktop:
- no source selected;
- saved-plan mode;
- direct-clan mode;
- no-current-CWL;
- active CWL Live;
- League with partial days;
- League completed if available;
- Roster normal;
- Roster missed filter;
- Bonuses Fair;
- Bonuses Custom expanded;
- historical season;
- partial-history warning.

Mobile:
- Live;
- League charts;
- Roster;
- Bonuses.

---

# 6. War Board

Desktop:
- no clan;
- no war;
- preparation;
- live war;
- War Map own side;
- War Map enemy side;
- selected base detail;
- roster with attacks remaining;
- missed attacks;
- history.

Mobile:
- Live;
- map;
- base inspector;
- roster.

---

# 7. Clan Family

Desktop:
- no families;
- family selected;
- member role;
- admin/leader role;
- Members;
- member with multiple accounts;
- Availability no active poll;
- active poll unanswered;
- active poll answered;
- poll results admin;
- reminder action;
- Polls list;
- poll create;
- poll limit;
- Linked Clans;
- Account Audit before scan;
- Account Audit with issues;
- role/permission management;
- invite/code;
- leave confirmation.

Mobile:
- family switcher;
- Members;
- active poll;
- Poll results;
- Clans.

---

# 8. Advanced Stats

Desktop + selected mobile:
- no linked account;
- profile load error if reproducible;
- not tracking;
- initializing;
- active tracking;
- paused;
- partial-data warning;
- 7d;
- 30d;
- 90d;
- all-time;
- summary populated;
- trend;
- favorite armies;
- Unit Usage each category at least once;
- Unit Usage empty category;
- Battle timeline;
- timeline Load More;
- no attacks in selected range;
- delete-data confirmation.

---

# 9. Achievements

Desktop:
- no account;
- rich account overview;
- Data Sources all ready;
- one missing source;
- import collapsed;
- import open;
- valid snapshot preview;
- malformed/wrong-tag error;
- library mixed statuses;
- search active;
- category filter;
- rarity filter;
- source filter;
- waiting-for-data cards;
- no filter matches;
- load more.

Mobile:
- progress hero;
- filters;
- achievement cards;
- import flow.

---

# 10. Minigames

Public desktop + mobile.

Entity Guesser:
- hub;
- Daily fresh;
- Practice/category;
- suggestion combobox;
- after 1 guess;
- after several guesses;
- hint 1;
- hint 2;
- won;
- lost;
- share state;
- mobile horizontal comparison.

Higher or Lower:
- fresh;
- correct reveal;
- wrong reveal;
- mid-combo;
- final result;
- Practice filter;
- mobile stacked cards.

---

# 11. Bracket

If the real engine is reachable in the selected branch, capture:
- empty setup;
- 4 participants;
- 8 participants;
- 12 participants with BYEs;
- 32 participants;
- winner selected;
- changed prior winner;
- champion;
- import/export controls;
- mobile.

Also capture the current public `/bracket-generator` page because its marketing/release state may differ from the engine.

---

# 12. Profile / Auth

Profile:
- quick surface;
- linked accounts;
- add/link account;
- verification state;
- Friends;
- incoming requests;
- Settings;
- language/theme;
- logout.

Auth:
- login desktop/mobile;
- validation error;
- Google option;
- register desktop/mobile;
- forgot password path.

---

# 13. Public pages

For each major public route:
- 1440 desktop hero + first content;
- 390 mobile hero/nav;
- footer;
- light theme if materially different.

Prioritize:
- `/`;
- `/cwl-planner`;
- `/cwl-tracker`;
- `/clan-management`;
- `/minigames`;
- `/bracket-generator`;
- `/guides`;
- `/methodology`;
- `/about`;
- `/changelog`;
- Privacy/Cookies/Terms/Contact as one representative legal-layout set.

---

# 14. Manual notes alongside screenshots

Create:

```text
docs/redesign/baseline/NOTES.md
```

For each hard-to-understand screenshot, record:
- what user action opened it;
- what data source was used;
- anything broken already before redesign;
- whether the state is rare/legacy.

This prevents the redesign agent from "preserving a bug" simply because it appears in a baseline screenshot.

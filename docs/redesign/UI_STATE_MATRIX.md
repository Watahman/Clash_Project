# ClashPanel UI State Matrix

## Purpose

This matrix defines the important states the redesign must represent deliberately.

The goal is to prevent the common failure mode where the "full happy path" looks excellent but:
- loading is broken;
- empty screens look accidental;
- errors leave stale content visible;
- direct-clan mode shows planning-only UI;
- partial data appears as zero;
- mobile interactions become unusable.

Use these states as fixture and screenshot targets.

---

# Global shell

| State | Expected behavior |
|---|---|
| Auth/session loading | Stable shell/loading treatment; no flash of unauthorized private content |
| Authenticated | Workspace loads correct user/module |
| Session expired | Clear auth recovery/redirect |
| Sidebar expanded | Labels visible, current module obvious |
| Sidebar collapsed | Icons/tooltips/accessible names remain usable |
| Mobile nav closed | Content usable without overlay |
| Mobile nav open | Trap/restore focus appropriately; close action obvious |
| Dark theme | All semantic states legible |
| Light theme | All semantic states legible |
| EN/NL/FR/DE/ES | No overlap/truncation caused by longer labels |
| Notifications empty | Clear empty state |
| Notifications present | Count + list + read behavior |

---

# Dashboard

| State | Expected behavior |
|---|---|
| Fresh user | No fake "recent work"; strong Explore/onboarding |
| Saved plans only | Continue section prioritizes plans |
| Clan Families only | Continue section prioritizes family |
| Linked accounts only | Profile/progress discovery useful |
| Rich user | Needs Attention + Continue + Explore |
| Data loading | Stable skeleton/status |
| Partial load failure | Other working sections remain usable |
| No reliable recent data | Hide section rather than fabricate activity |

---

# CWL Planner

## Plan lifecycle

| State | Expected behavior |
|---|---|
| No saved plans | Empty/new-plan experience |
| Existing plan loaded | Name, clans, roster and save state correct |
| Unsaved change | Save state visibly dirty |
| Save in progress | Prevent duplicate destructive action |
| Save success | Clear non-intrusive confirmation |
| Save failure | Existing data stays visible; retry possible |
| Plan limit reached | Explain limit without destroying current work |
| Undo unavailable | Disabled correctly |
| Undo available | Restores prior planning state |

## Roster

| State | Expected behavior |
|---|---|
| Empty free roster | Add Players guidance |
| Normal roster | Search/sort work |
| 60+ players | Dense but usable; scrolling performant |
| Search no result | Explicit filtered-empty state |
| Poll unavailable | Poll control disabled/explained |
| Poll loaded | Availability context visible |
| Duplicate player import | Duplicate explained/skipped |
| Invalid player tag | Inline error; current roster unchanged |
| API lookup failure | Retry/error; no corrupted placeholder player |

## Clan board

| State | Expected behavior |
|---|---|
| No clans | Add Clan CTA |
| One clan | Normal planning |
| Multiple clans | Cross-clan planning remains understandable |
| Clan capacity full | Invalid drop/move blocked and explained |
| Day full | Invalid drop/move blocked and explained |
| Player unavailable | Visible conflict; planner remains usable |
| Player on bench | Bench state clear |
| Touch/mobile | Move-to/select-destination alternative if drag is unreliable |

## Add Players

| State | Expected behavior |
|---|---|
| By tag | Player/clan tag entry |
| Own accounts empty | Link-account guidance |
| Own accounts populated | Multi-select/add |
| Friends empty | Clear empty state |
| Friends populated | Multi-select/add |
| No Clan Family | Create/join guidance |
| Family selected | Members/clans preview |
| Family poll selected | Availability result context |
| Family/poll API failure | Error without closing/losing selection |

## Spreadsheet

| State | Expected behavior |
|---|---|
| Waiting for file | Drop/select |
| Unsupported file | Validation error |
| Parsing | Progress/status |
| Valid tags | Review |
| Mixed valid/invalid | Review with distinctions |
| Duplicates | Deduplicated/explained |
| Import success | Added counts |
| Import partial failure | Explain what was/was not imported |

## Auto Plan

| State | Expected behavior |
|---|---|
| Closed | Planner normal |
| Loading | Status |
| Automatic preview | Full proposed plan |
| Guided preview | User-control points visible |
| Conflicts | Explain unplaceable players/constraints |
| Apply disabled | Reason visible |
| Apply success | Planner updates |
| Cancel | Original plan untouched |

## Optimize

| State | Expected behavior |
|---|---|
| No suggestions | "Already optimized"/no-op state |
| Suggestions | Each change understandable |
| Some accepted | Apply Accepted enabled |
| Apply all | All valid suggestions applied |
| Invalidated suggestion | Recompute/block rather than apply stale change |

---

# Saved Plans

| State | Expected behavior |
|---|---|
| No plans | New-plan CTA |
| Few plans | Table/cards |
| Plan limit reached | Clear limit |
| Search no match | Filtered-empty |
| Rename | Inline/modal validation |
| Duplicate | New identity clearly created |
| Delete confirmation | Destructive confirmation |
| Delete failure | Existing item remains |

---

# CWL Tracker

## Source

| State | Expected behavior |
|---|---|
| No selection | Source guidance |
| Saved plan selected | Clan selection enabled |
| Direct clan tag | Planning-specific UI removed/hidden |
| Invalid clan tag | Inline error |
| Clan fetch failure | Retry; stale previous clan cleared or clearly marked |

## CWL

| State | Expected behavior |
|---|---|
| Loading | Stable loading |
| No current CWL (`NO_ACTIVE_CWL`) | Clear live report, open historical overview, and show no stale old CWL |
| Preparation | Appropriate pre-war state |
| Active | Live view |
| Between war days | Next/previous context |
| Completed | Final summary |
| Partial external data | Labeled partial |
| Historical season | Clearly historical; no "live" language |

## League

| State | Expected behavior |
|---|---|
| 0 completed days | Charts explain lack of data |
| Partial days | Real completed + clearly predicted future |
| All 7 complete | Final charts/standings |
| Projection unavailable | Do not fake projected finish |
| Standings partial | Label limits |

## Roster

| State | Expected behavior |
|---|---|
| Plan mode | Planning column allowed |
| Direct mode | Planning column absent |
| Search no match | Filtered-empty |
| Missed filter | Only missed-attack cases |
| Performance unavailable | Unknown/unavailable, not 0 |

## Bonuses

| State | Expected behavior |
|---|---|
| No eligible data | Explain |
| Fair | Recommendations |
| Performance | Recommendations |
| Contribution | Recommendations |
| Custom | Weight controls |
| Invalid custom weights | Block/normalize with feedback |
| Recipient count 0 | Valid empty recommendation |

---

# War Board

| State | Expected behavior |
|---|---|
| No clan | Source guidance |
| Invalid clan | Error |
| No current war | Clean no-war state |
| Private/unavailable/not in war | Normalize to `notAvailable` and explain that live war data is unavailable |
| Active CWL war | Show the `ACTIVE_CWL_WAR` handoff to CWL Tracker instead of regular-war data |
| Preparation | Planning-friendly state |
| In war | Live score/map |
| War ended | Final outcome |
| API private/unavailable | Explain limitation |
| Own side selected | Correct base details |
| Enemy side selected | Correct base details |
| Base never attacked | Zero attacks as real state, not missing data |
| Roster with attacks remaining | Needs-attention visible |
| History empty | Empty state |

---

# Clan Family

## Family list

| State | Expected behavior |
|---|---|
| No family | Create/join onboarding |
| One family | Open directly or select |
| Multiple families | Switcher/list |
| Family load failure | Retry |

## Role

| State | Expected behavior |
|---|---|
| Member | No admin controls |
| Leader/admin | Management controls |
| Permission changed while open | UI refreshes/guards backend action |

## Members

| State | Expected behavior |
|---|---|
| No members (edge) | Empty |
| Normal family | Member list |
| Large family | Search/scroll/performance |
| Member no linked accounts | Explicit status |
| Member multiple accounts | Accounts grouped clearly |

## Polls

| State | Expected behavior |
|---|---|
| No active poll | Empty |
| Active poll unanswered | CTA to answer |
| Partially answered | Current selections retained |
| Answered | Summary/edit if supported |
| Admin results | Per-account/day results |
| No responses | Results empty state |
| Some missing responses | Reminder useful |
| Poll limit reached | Explain |
| Poll closed | Historical/read-only |
| Reminder failure | Non-destructive feedback |

## Clans/audit

| State | Expected behavior |
|---|---|
| No linked clans | Add clan |
| Linked clans | Cards/list |
| Invalid clan tag | Error |
| Audit not run | Prompt |
| Audit clean | Explicit all-linked state |
| Audit issues | Missing/unlinked accounts listed |

---

# Advanced Stats

## Account/profile

| State | Expected behavior |
|---|---|
| Profile loading | Status |
| Profile load failed | Retry |
| No linked accounts | Open Profile CTA |
| Multiple accounts | Account selector |

## Tracking

| State | Expected behavior |
|---|---|
| NOT_TRACKING | Start tracking onboarding |
| INITIALIZING | Preparing-history state |
| ACTIVE | Full dashboard |
| PAUSED | Resume + historical data visible |
| DEGRADED | Existing data remains visible; explain reduced collection quality and recovery action |
| STOPPED | Explain retention/restart behavior; stored history remains visible |
| ERROR | Existing data remains safe; show failure context and retry/recovery action |
| DELETE confirmation | Strong destructive confirmation |
| Delete success | Return to clean not-tracking state |
| Lifecycle error | Existing tracked data not hidden/lost |

## Data quality

| State | Expected behavior |
|---|---|
| Full data | Normal |
| Partial data | Warning + complete-since |
| No attacks in range | Empty, not zeros pretending to be performance |
| Army details unavailable | Army-specific empty |
| Unit category empty | Category-specific empty |
| Read API error | Error/retry |
| Pagination available | Load More |
| End of timeline | Hide/disable Load More |

## Time range

Test:
- 7d;
- 30d;
- 90d;
- all.

Each should preserve selected account and clearly update data/status.

---

# Achievements

## Account

| State | Expected behavior |
|---|---|
| No linked account | Link account state |
| Account loading | Status |
| Account error | Retry |
| Multiple accounts | Switch cleanly |
| Refresh | Preserve filters where sensible |

## Sources

| State | Expected behavior |
|---|---|
| All sources ready | Normal |
| Optional base snapshot missing | Only affected achievements wait |
| Advanced Stats unavailable | Stats-backed achievements wait |
| History source partial | Partial/unknown |
| Source failed | Not converted to zero |

## Progress

| State | Expected behavior |
|---|---|
| New user | Level 1/low progress |
| Mid progress | Mixed locked/in-progress/unlocked |
| Many complete | Dense library still usable |
| Unknown | Waiting for data |

## Filters

Test combinations:
- search;
- category;
- rarity;
- status;
- source;
- no matches;
- load more after filtering.

## Base snapshot

| State | Expected behavior |
|---|---|
| Closed | Progress remains primary |
| Open | Instructions/form |
| File selected | Parsed/validated |
| Clipboard pasted | Parsed/validated |
| Malformed JSON | Error |
| Wrong player tag | Block save |
| Valid snapshot | Preview |
| Save success | Source/progress refresh |
| Save failure | Input retained/retry |

---

# Minigames

## Hub

| State | Expected behavior |
|---|---|
| First visit | Both games discoverable |
| Entity active | Higher/Lower not loaded as competing full UI |
| Higher/Lower active | Entity UI inactive |
| Mobile | Switcher and game controls usable |

## Entity Guesser

| State | Expected behavior |
|---|---|
| Daily not played | Fresh shared challenge |
| Daily in progress | Attempts restored |
| Daily won | Result restored |
| Daily lost | Result restored |
| Practice | Category selection |
| Search empty | Suggestions usable |
| Guess 1..5 | Feedback grid grows |
| Guess 6 | Terminal result |
| Hint 0 | Button |
| Hint 1 | First hint |
| Hint 2 | Second hint |
| Share | Spoiler-safe output |
| Horizontal overflow | Sticky/scroll affordance |

## Higher or Lower

| State | Expected behavior |
|---|---|
| Daily not played | Question 1 |
| Daily in progress | State restored |
| Correct | Reveal + combo increments |
| Wrong | Reveal + combo behavior correct |
| Equal candidate | Must not be generated |
| Question 9 | Final result |
| Practice | Filter/category |
| Next | Advances once only |
| Share/result if supported | Persistent result |

---

# Bracket

Test participant counts:
- 4;
- 8;
- 12 (BYEs);
- 16;
- 32.

| State | Expected behavior |
|---|---|
| Empty setup | Add participants |
| Invalid count | Validation |
| Seeded | Supplied order respected |
| Shuffle | Randomized opening |
| BYEs | Correct automatic advancement |
| Generated | All rounds visible |
| Winner selected | Advances |
| Previous winner changed | Downstream invalidated/recomputed correctly |
| Champion | Final winner state |
| Restore | Local persisted state restored |
| Import valid | Bracket restored |
| Import invalid | Error/no corruption |
| Export | Re-importable output |
| Reset | Confirmation + clean state |
| Mobile | One-round/scroll strategy usable |

---

# Profile / Accounts

| State | Expected behavior |
|---|---|
| Quick popover | Common actions only |
| Full profile | Overview/Accounts/Friends/Settings |
| No linked accounts | Link CTA |
| Linking account | Verification flow |
| Missing/invalid token or tag | Verification error; both values are required |
| Duplicate linked account | Reject without adding a second card |
| Multiple accounts | Manage individually |
| Friends empty | Empty |
| Incoming request | Accept/reject |
| Sent request | Pending state |
| Theme switch | Persists |
| Language switch | Persists |
| Logout | Session cleared/redirect |

---

# Auth

| State | Expected behavior |
|---|---|
| Login idle | Form |
| Invalid credentials | Inline/general error |
| Loading | Prevent duplicate submit |
| Success | Correct redirect |
| Google success/failure | Correct feedback |
| Forgot password | Reach recovery |
| Register invalid | Validation |
| Register success | Session/confirmation behavior preserved |
| Session already active | Avoid unnecessary login wall |

---

# Public pages

For each major public page test:

| State | Expected behavior |
|---|---|
| JS enabled | Full page |
| Slow assets | Layout stable |
| Mobile nav | Usable |
| Dark/light | Usable |
| EN/NL/FR/DE/ES | No overflow |
| OG/meta | Correct |
| Canonical | Correct |
| Structured data | Parses where present |
| Cookies/consent | Preferences remain reachable |
| Logged out | Public content remains public |

Special:
- Minigames remains playable publicly.
- Bracket marketing must match actual release state.
- Private `/app/*` pages remain noindex.

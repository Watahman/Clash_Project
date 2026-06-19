# ClashTools CWL/Operation approved pass

Applied after user approved prompt.

Main changes:
- CWL planner compact layout and no decorative slash text.
- Stable player cards and compact clan articles.
- Plan switch race protection and operation-board plan selection token.
- Operation Board uses planning + clan members + CWL league group/league war data, with current-war fallback.
- Profile dynamic cards styled as compact clickable articles.
- Index yellow step tags removed.
- Groups header/card final CSS pass and member/member(s) i18n fixed.
- Added missing i18n keys for EN/NL and kept FR/DE/ES fallback.

API notes:
- Clash API live data can still be unavailable if the clan war log/data is private, there is no active/recent CWL, or the token/IP is invalid.
- No real secrets were added.

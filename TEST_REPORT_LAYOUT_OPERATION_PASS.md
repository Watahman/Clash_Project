# ClashTools layout + operation-board pass

## Fixed
- Profile popup now reloads profile data on every open and no longer clears rendered cards permanently on close.
- Profile dynamic base/friend/group cards have stable sizing and safer relative asset paths.
- CWL planner toolbar was rebuilt so Players/Clans headers, buttons, plan select, save status and Operation Board link align cleanly.
- Free player cards now keep a fixed readable size and remain draggable.
- CWL plans are cached/preloaded when possible; plan switching uses planId and suppresses autosave while a plan is loading.
- Groups sidebar/detail headers were polished and the `//` prefix was removed.
- Homepage stat cards no longer use the large yellow `30v30 / API / Live` labels.
- Language selector added and connected to shared navigation, profile, auth, groups, CWL planner and operation-board labels.
- New CWL Operation Board page added with local autosave, roster, 7 war days, scoreboard, missed attacks, TH spread, bonus advice and JSON import/export.
- Vite build input includes the new operation-board page.
- Supabase get-all-plans response now includes `info` so the frontend can cache plans instead of fetching every plan only after selection.

## Tests run here
- `node --check` on all JavaScript files: passed.
- HTML/CSS/JS asset path check: passed.
- Secret scan for pasted Supabase/Clash tokens: passed.
- `npm ci --offline`: passed.
- `npm run build`: passed.

## Not live-tested here
- Real browser interaction with your local Supabase account.
- Real Clash API calls.
- Live Java backend smoke tests, because those must run on your PC with your env vars and Java server.
- Actual GitHub push, because only your machine has your GitHub credentials.

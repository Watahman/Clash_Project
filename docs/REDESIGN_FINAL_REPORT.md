# ClashPanel V2 redesign handoff

Updated: 2026-08-12

Source branch: `redesign/clashpanel-v2`

Deployed redesign commit: `5407e38`

Production release: not performed

## Outcome

The V2 redesign is complete on the repository's `Development` branch and is
available in the isolated Google Cloud and Cloudflare development environments.
The work preserves the existing product capabilities while replacing the public
site, shared application shell, and core product workspaces with one coherent,
responsive interface.

The implementation follows the V2 master specification and the pre-redesign
pack. It uses real development-only fixtures for data-heavy previews; no fixture
or invented metric is presented as live user data.

## Delivered surfaces

### Public product

- Homepage and public navigation
- CWL Planner, CWL Tracker, and Clan Management product pages
- Minigames and Bracket Generator product pages
- Guides, Methodology, About, Changelog, Contact, and legal pages
- Login, registration, language, and theme flows
- Responsive product previews backed by controlled fixtures

### Plan

- Dashboard and saved-plan entry points
- CWL Planner roster, schedule, availability, import, Auto Plan, and optimization
- CWL Tracker planning and progress surfaces

### Compete

- War Operation Board and CWL Operation Board
- Historical CWL context and war-statistics presentation
- Deterministic fixture states for visual verification

### Manage

- Clan Families overview, setup guidance, members, roles, invitations, polls,
  availability, linked clans, and Planner handoff

### Progress and play

- Advanced Stats lifecycle, army, trends, and progress views
- Achievements and entity-aware display states
- Minigames hub, Entity Guesser, Higher or Lower, and sharing states

### Brackets and account

- Bracket editor, import validation, fixtures, and public product preview
- Profile, settings, notifications, friends, and linked-account surfaces

## Shared architecture

- Public and authenticated routes share the same design tokens, typography,
  motion rules, focus treatment, and responsive contracts.
- Workspace navigation is grouped around user intent: Plan, Compete, Manage,
  Progress, and Play.
- Game imagery is resolved through the central entity asset layer. Dynamic clan
  badges remain API-driven, and unavailable entities use the approved fallback.
- English, Dutch, French, German, and Spanish copy is supported across the
  redesigned surfaces.
- Development fixtures are deterministic and visibly labelled. They do not
  activate on normal production URLs.

## Verification evidence

The exact development candidate passed the following local gates before deploy:

- `npm.cmd run check`: passed
  - 31 ordered migrations checked
  - 68 frontend endpoints and 7 auth endpoints checked
  - 1,362 tracked paths checked for casing
  - 109 test files and 603 tests passed
  - production build passed
  - static-output and SEO checks passed
- `npm.cmd run verify:redesign -- --full`: 0 failures, 0 warnings
- SEO output: 14 route definitions and 13 sitemap URLs
- no GitHub Actions workflow exists

Browser verification covered public and authenticated surfaces at desktop,
tablet, and 390px mobile widths in dark and light themes. The five supported
languages were checked for layout stability, including long German labels.
Checked pages had no document-level horizontal overflow. The final live Planner
check reported matching client and scroll widths at both 1,425px and 375px.

Reference screenshots are stored in [`docs/redesign/final`](redesign/final).

## Development deployment

### Google Cloud

- Project: `clashpanel`
- Service: `clashpanel-api`
- Region: `europe-west1`
- Development tag: `phase8`
- Revision: `clashpanel-api-00059-toz`
- URL: `https://phase8---clashpanel-api-rxco3fz7da-ew.a.run.app`
- Normal production traffic: 0%
- `/health`: 200
- `/ready`: 200
- Advanced Stats collection: off
- Advanced Stats public enrollment: off
- Scheduler secret: not attached to this revision

### Cloudflare

- Worker: `clashpanel-phase8-preview`
- Version: `b509918f-d002-41e7-ad88-97d7254f9b21`
- URL: `https://clashpanel-phase8-preview.emile-vandewaetere.workers.dev`
- Backend: the tagged `phase8` Cloud Run revision
- Custom-domain route: none
- Cron trigger: none
- Search indexing: disabled with `X-Robots-Tag`

Live checks returned 200 for the preview homepage, CWL Planner, Advanced Stats,
and Minigames. The production custom domain and its 100% traffic revision were
not changed.

## Deliberate release boundaries

- This is a development deployment, not a production release.
- Do not move production traffic to the `phase8` revision until its separate
  Advanced Stats observation gate is complete.
- The public Bracket route remains excluded from the sitemap and search index
  until a separate publishing decision is approved.
- Google sign-in on the preview requires the exact preview callback URL to be
  present in Supabase Authentication redirect configuration.
- Database migrations, production Cloud Run traffic, and the `clashpanel.com`
  Cloudflare Worker were not changed by this redesign deployment.

## Recommended next review

Use the Cloudflare preview for stakeholder acceptance. Test the primary flows
with a normal account and real linked Clash of Clans data, then record any
content or interaction changes before authorizing a production rollout.

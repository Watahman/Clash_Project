# ClashPanel AdSense low-value content audit

Audit date: 2026-08-04  
Production baseline: `f064d01` (`agent/fix-mobile-planner-layout`)  
Canonical host observed in production: `https://clashpanel.com`

## Scope and evidence

This audit was completed before broad content changes. It combines:

- the production source at commit `f064d01`;
- direct production requests with a normal browser user agent, Googlebot Smartphone, AdsBot-Google and Mediapartners-Google;
- the Worker route maps, static HTML, `robots.txt`, `sitemap.xml`, `_redirects` and `_headers`;
- a repository-wide search for advertising, robots, canonical, placeholder, coming-soon and client-routing code.

All four tested user-agent classes received the same status and content type for the audited routes. This is evidence against crawler-specific cloaking. It does not prove how Google evaluated an earlier version.

## Route matrix: canonical public pages

| Route | Title / canonical | Live | Index / sitemap | Initial HTML and dependency | Ads before remediation | States and original value | Recommended action |
|---|---|---:|---|---|---|---|---|
| `/` | Clash of Clans Clan Management, CWL Planner & Tracker / `/` | 200 | index / yes | 1 H1 and substantial workflow/sample content; no input required | Script loads after interaction or 12 s; no explicit slot | Static labelled sample plan and original product workflow; useful without JS | Retain as the only initial ad-eligible route, but gate by central eligibility and consent |
| `/about` | About ClashPanel / `/about` | 200 | index / yes | 1 H1, substantial static copy; no auth/input | none | Original product explanation, but limited verified first-hand author detail | Keep ad-free; add correction/data-limit/support detail; founder facts remain owner TODO |
| `/cwl-planner` | Free Clash of Clans CWL Planner & Roster Optimizer / `/cwl-planner` | 200 | index / yes | 1 H1 and substantial static explanation; tool itself requires sign-in | none | Original feature copy, but screenshots are decorative game art rather than current UI output | Keep ad-free during review; add a labelled static decision example and methodology links |
| `/cwl-tracker` | Clash of Clans CWL Tracker, Stats & History / `/cwl-tracker` | 200 | index / yes | 1 H1 and substantial static explanation; live tool requires clan/plan | none | Original feature copy, but no read-only output demonstration | Keep ad-free during review; add labelled sample output and methodology links |
| `/clan-management` | Clash of Clans Clan Management & Clan Family Tool / `/clan-management` | 200 | index / yes | 1 H1 and substantial static explanation; app requires sign-in | none | Original feature copy, but no current UI evidence | Keep ad-free during review; add only released behaviour and a labelled sample workflow |
| `/bracket-generator` | Clash of Clans Bracket Generator / `/bracket-generator` | 200 | noindex / no | Static coming-soon landing page | no loader on landing page | Unreleased/under construction | Keep noindex and ad-free; remove from prominent public navigation until complete |

## Route matrix: legal and support pages

| Route | Title / canonical | Live | Index / sitemap | Initial HTML and dependency | Ads | States and original value | Recommended action |
|---|---|---:|---|---|---|---|---|
| `/subpages/privacy` | Privacy policy / same route | 200 | index / yes | Only heading/introduction (~70 source words); full policy injected by `public-policy.js` | none | Complete after JS, incomplete without JS | Move the complete English policy into initial HTML; retain optional JS translation enhancement; keep ad-free |
| `/subpages/cookies` | Cookie policy / same route | 200 | index / yes | Only heading/introduction; full policy injected by JS | none | Complete after JS, incomplete without JS | Move complete English policy into initial HTML; explain consent controls; keep ad-free |
| `/subpages/terms` | Terms of use / same route | 200 | index / yes | Only heading/introduction; full terms injected by JS | none | Complete after JS, incomplete without JS | Move complete English terms into initial HTML; keep ad-free |
| `/subpages/contact` | Contact / same route | 200 | index / yes | Only heading/introduction; contact details injected by JS | none | Useful after JS; thin without JS | Put support address and request categories in initial HTML; keep ad-free |

## Route matrix: authentication, account and application surfaces

| Route | Page / source | Live | Index / sitemap | Auth or input | Initial states | Ads before remediation | Recommended action |
|---|---|---:|---|---|---|---|---|
| `/subpages/login` | Login | 200 | noindex / no | authentication | form/error/redirect | none | Keep noindex and ad-free |
| `/subpages/register` | Signup | 200 | noindex / no | authentication | form/error/success | none | Keep noindex and ad-free |
| logout/password reset | Actions inside auth UI; no standalone indexable route | n/a | noindex / no | authentication | redirect/success/error | none | Never load ads; retain as actions rather than public content |
| `/dashboard` | Dashboard shell | 200 + `X-Robots-Tag: noindex, nofollow` | noindex / no | authentication | empty/loading/error/private data | **loader present** | Remove loader and enforce central deny rule |
| `/app/cwl-planner` | Planner workspace | 200 + noindex header | noindex / no | authentication + roster input | empty/loading/API error/private data | **loader present** | Remove loader and enforce central deny rule |
| `/app/cwl-planner-drafts` | Saved plans/drafts | 200 + noindex header | noindex / no | authentication | empty/loading/error/private data | **loader present** | Remove loader and enforce central deny rule |
| `/app/cwl-tracker` | CWL Operation Board | 200 + noindex header | noindex / no | clan tag or saved plan | empty/loading/API error/private data | **loader present** | Remove loader and enforce central deny rule |
| `/app/clan-management` | Clan Family workspace | 200 + noindex header | noindex / no | authentication/membership | empty/loading/error/private data | none | Retain ad-free |
| `/app/war-operation-board` | War Operation Board | 200 + noindex header | noindex / no | clan tag/API data | empty/loading/error | none | Retain ad-free |
| profile/settings | Overlay loaded inside application shells; no standalone route | n/a | noindex / no | authentication | loading/error/private data | inherits containing page | Central deny rule must cover every application shell |
| `/subpages/bracket-generator` | Unfinished bracket workspace source | 200 as static asset/legacy target | noindex / no | controls only | empty/coming soon | **loader present** | Remove loader; redirect public legacy access to noindex landing page |

Private shells intentionally return safe HTML 200 responses rather than HTTP 401 so client-side authentication can run. Their HTML meta robots and Worker `X-Robots-Tag` both exclude indexing. Authentication remains the access-control boundary; robots rules are not used for security.

## Errors, aliases, routing and languages

| Route class | Observed behaviour | Ads | Recommended action |
|---|---|---|---|
| Unknown route, e.g. `/missing-adsense-audit-route` | Real HTTP 404 with the static 404 page | none | Retain; add automated status check |
| `/404.html` | Production issues a 307 to `/404`; unknown routes themselves are 404 | none | Add an explicit permanent alias if `/404.html` must remain addressable; never index or monetize |
| Clean public `.html` aliases | Worker and `_redirects` use 301 to clean routes | destination-dependent | Retain one-hop redirects; central eligibility evaluates final canonical route only |
| Legacy `/subpages/*.html` public aliases | 301 to the matching clean public landing page | destination-dependent | Retain one-hop redirects |
| Legacy application aliases | 301 to `/dashboard` or `/app/*` | must be denied | Central deny rule evaluates aliases and application prefixes |
| Uppercase/trailing-slash variants of four public product paths | Worker normalizes to a 301 canonical path | destination-dependent | Retain; ensure one-hop HTTPS canonical redirect at edge |
| Language variants | No language-specific URLs exist. EN/NL/FR/DE/ES are client-side preferences on the same canonical URL | same route | Do not add duplicate localized sitemap URLs without real alternate routes and `hreflang` |
| Client-side routes | No SPA content router was found; JavaScript changes auth/navigation state and redirects to the Worker-owned routes | inherited | Keep route policy centralized and path-based |

## Advertisement matrix: initial state

| Route class | Script loads | Slot may render | Reason |
|---|---:|---:|---|
| `/` | yes | Auto Ads may decide | Indexable and meaningful, but loading is not consent- or explicit-slot-gated in local code |
| `/about`, product landings, policy/support pages | no | no | No loader present |
| dashboard, planner workspace, drafts, Operation Board | **yes** | Auto Ads may decide | Incorrect global-style inclusion on private/noindex/application screens |
| bracket landing | no | no | noindex/coming soon |
| unfinished bracket workspace | **yes** | Auto Ads may decide | Incorrect inclusion on noindex/unfinished/control-only screen |
| auth, Clan Family workspace, War Operation Board, 404 | no | no | No loader present |

No explicit `<ins class="adsbygoogle">` slots were found. The Google script is capable of enabling account-level Auto Ads, so absence of a local slot is not a reliable exclusion.

## Content inventory: initial state

| Page | Primary intent and unique value | Original evidence/example | Internal links | Indexability | Completion |
|---|---|---|---|---|---|
| Homepage | Explain prepare-plan-run workflow | Static, labelled sample multi-clan plan | auth + sections + policies | index | Strong base; needs clearer methodology/resource paths |
| About | Explain product purpose and independence | Product-informed workflow; decorative art | product pages + policies | index | Needs owner-verified author story and correction process |
| Planner landing | Explain multi-clan availability-aware planning | No current UI screenshot; no worked decision example | tracker + app | index | Needs demonstration/methodology |
| Tracker landing | Explain live-to-history tracking | No current UI screenshot; no worked output | planner + app | index | Needs demonstration/methodology |
| Clan Management landing | Explain connected clans/accounts/availability | No current UI screenshot; no worked workflow | planner + app | index | Needs demonstration/methodology |
| Privacy/cookies/terms/contact | Trust, rights and support | Full detail exists only in JavaScript dictionaries | footer cross-links | index | Technically incomplete without JS |
| Bracket landing | Announce unreleased tool | Coming-soon copy only | public navigation/footer | noindex | Intentionally incomplete; should not be prominent or monetized |

## Confirmed problems

1. AdSense loads on four private application routes and one unfinished workspace. This is directly confirmed by script tags in their initial HTML.
2. `robots.txt` in the production source references `https://replace-with-production-domain.invalid/sitemap.xml`. The live file must be rechecked after deployment because production can lag source.
3. Privacy, cookies, terms and contact depend on JavaScript for their complete meaningful body.
4. Auto Ads are not controlled by an explicit conservative page-eligibility allowlist in the publisher code.
5. Product landing pages describe functionality but rely mainly on decorative Clash of Clans imagery rather than current ClashPanel output evidence.
6. There is no public methodology or focused guide hub in the route inventory.
7. Public navigation does not yet distinguish product explanations, resources and authenticated tools.

## Suspected or owner-dependent problems

1. Consent Mode defaults are denied, but local code does not demonstrate a certified EEA/UK/Switzerland consent platform granting or persisting Google advertising consent. Account-level Google configuration requires owner verification.
2. Current product art may communicate less first-hand product evidence than real anonymised screenshots. Suitable private-safe screenshots require owner review or controlled demo fixtures.
3. The About page lacks owner-confirmed founder/community history. No such claims may be added until confirmed.
4. Search Console canonical selection, indexing state, manual actions and AdSense Auto Ads configuration are external account facts and cannot be inferred from repository code.

## Problems that are not current

1. Unknown routes are not soft 404s in the tested production state: they return HTTP 404.
2. The sitemap currently contains only canonical, indexable public pages; it does not include application, private, error, alias or coming-soon routes.
3. `ads.txt` currently returns HTTP 200 and `text/plain` to normal, Googlebot, AdsBot and Mediapartners user agents. This does not address low-value content by itself.
4. Tested crawler user agents were not blocked and received the same core status/content types as a normal user agent.
5. The canonical hostname is consistently `https://clashpanel.com` in current public page metadata and sitemap source.

## Implementation gate opened by this audit

The remediation order is:

1. remove advertising from every application/noindex/unfinished route and add a conservative eligibility gate;
2. make policy/support text complete in initial HTML;
3. fix the production-domain robots reference and generate crawl inventory from one route configuration;
4. add honest, labelled product demonstrations and methodology/resource paths without inventing owner facts;
5. add automated source/build checks for advertising exclusion and crawl metadata.

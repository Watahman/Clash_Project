# ClashPanel AdSense remediation report

Prepared: 2026-08-04  
Branch: `agent/adsense-low-value-remediation`  
Baseline: production commit `f064d01`  
Deployment status: approved for release; live deployment verification pending

## A. Initial audit

The complete pre-change route matrix, advertisement matrix, content inventory, evidence and confirmed/suspected/outdated findings are in [adsense-low-value-content-audit.md](./adsense-low-value-content-audit.md).

### Highest-impact initial findings

1. The AdSense loader was present on the dashboard, CWL Planner workspace, saved plans, Operation Board and unfinished bracket workspace.
2. Privacy, cookies, terms and contact depended on JavaScript for their complete body.
3. Public HTML was hidden by a loading class until JavaScript removed it, so a script failure could leave otherwise crawlable text unusable.
4. Source `robots.txt` referenced a placeholder sitemap domain.
5. Public product pages explained features but did not show a standalone output or the decision that output supports.
6. There was no public methodology, guide hub or factual changelog.
7. Unknown production routes returned a real 404, the sitemap already excluded private/noindex routes, tested crawler agents were not blocked and `ads.txt` was healthy. Those suspected problems were not current.

### Live evidence collected before changes

- Normal browser, Googlebot Smartphone, AdsBot-Google and Mediapartners-Google received matching statuses and content types on the audited public, private, error, `robots.txt`, sitemap and `ads.txt` routes.
- Unknown route `/missing-adsense-audit-route` returned HTTP 404.
- `ads.txt` returned HTTP 200 and `text/plain` and contained `google.com, pub-7361256415342967, DIRECT, f08c47fec0942fa0`.
- Public pages returned HTTP 200 and canonical metadata used `https://clashpanel.com`.
- Live `http://www.clashpanel.com/...` currently redirects through HTTPS `www` before apex, creating a two-hop edge chain. The Worker now computes a direct canonical redirect when it receives the request, but the Cloudflare edge rule still requires owner-side verification after deployment.

## B. Changes made

### Changed-file inventory

| Path | Reason and change | Main risk | Coverage or check |
|---|---|---|---|
| `docs/adsense-low-value-content-audit.md` | Records the pre-change route/ad/content audit and evidence | Can become stale after future releases | Date and baseline are explicit |
| `docs/adsense-remediation-report.md` | Records final matrices, validation and owner checklist | Can become stale | Date and branch are explicit |
| `src/assets/js/Data/ads.js` | Replaced delay-only loading with central route/status/indexability/content/consent eligibility | Ads stay disabled until a certified CMP exposes explicit consent | New route-eligibility test; source scan; browser showed no Google ad script |
| `src/subpages/dashboard.html` | Removed AdSense loader | None to application behaviour | Exclusion test/source scan |
| `src/subpages/cwl-planner.html` | Removed AdSense loader | None to planner behaviour | Exclusion test/source scan |
| `src/subpages/cwl-planner-drafts.html` | Removed AdSense loader | None to drafts behaviour | Exclusion test/source scan |
| `src/subpages/cwl-operation-board.html` | Removed AdSense loader | None to tracking behaviour | Exclusion test/source scan |
| `src/subpages/bracket-generator.html` | Removed AdSense loader from unfinished workspace | None to unfinished controls | Exclusion test/source scan |
| `src/subpages/privacy.html` | Added complete English policy to initial HTML and public-resource navigation | Static EN and JS NL copies must remain aligned | New initial-HTML quality test; browser inspection |
| `src/subpages/cookies.html` | Added complete English cookie/consent text to initial HTML | Certified CMP status still owner-dependent | New initial-HTML quality test; browser inspection |
| `src/subpages/terms.html` | Added complete English terms to initial HTML | Legal text still merits owner/legal review | New initial-HTML quality test; browser inspection |
| `src/subpages/contact.html` | Added contact/support/security guidance to initial HTML | Public email may attract spam | New initial-HTML quality test; browser inspection |
| `src/assets/js/pages/public-policy.js` | Preserves the initial English body; still renders NL and contact form enhancement | Translation copy can drift from static English | Static body test; existing form behaviour retained |
| `src/index.html` | Added resource navigation/links; kept the labelled product sample; removed prominent coming-soon link | More public links in header/footer | Mobile/desktop browser inspection |
| `src/cwl-planner.html` | Added labelled seven-day sample result, decision caption and guide/method links | Sample could be mistaken for live data if label removed | Demo-labelling test; browser inspection |
| `src/cwl-tracker.html` | Added labelled live/review sample output and methodology links | Simplified sample cannot represent every API state | Demo-labelling test; browser inspection |
| `src/clan-management.html` | Added labelled coordination sample without inventing a health score | Counts are illustrative only | Demo-labelling test; browser inspection |
| `src/about.html` | Added maintenance philosophy, correction path and data limitations without unverified founder claims | Still lacks named builder/origin story | Owner TODO retained below |
| `src/bracket-generator.html` | Updated public-resource navigation; remains noindex and coming soon | Page is still thin by design | Existing/noindex checks; no ad import |
| `src/guides.html` | Added eight original, product-informed guides with examples, mistakes, trade-offs, dates, attribution and related links | English-only; guidance requires future maintenance | New content-quality checks; browser inspection |
| `src/methodology.html` | Added transparent methods for Auto Plan, optimisation, performance, attack/defence, history, missed attacks and bonuses | Exact product rules can evolve | JSON-LD/build checks; mobile browser inspection |
| `src/changelog.html` | Added factual public changelog based on shipped changes | Must be updated with releases | Route/build metadata checks |
| `src/assets/css/public-resources.css` | Added restrained resource, table, TOC, responsive and overflow styles | Long tables require horizontal scrolling inside their panel | 1265 px and 390 px browser inspection; overflow fix verified |
| `scripts/public-routes.mjs` | Added one public crawl-route source with canonical paths and truthful fixed modification dates | Dates require deliberate updates | Used by build and SEO checker |
| `scripts/build-static.mjs` | Generates robots/sitemap from route config and fails on placeholder domain | Misconfigured `PUBLIC_SITE_URL` now fails closed | Production build passed |
| `scripts/check-seo-output.mjs` | Checks every configured route, metadata, H1, JSON-LD, links, policy HTML, sitemap and ad exclusions | Not executed per owner instruction | Added but deliberately not run |
| `scripts/serve-static.mjs` | Makes clean local paths resolve like production and adds missing MIME types | Development-only routing can still differ from Cloudflare | Local clean routes returned 200 |
| `src/robots.txt` | Replaced placeholder sitemap with production URL | Must remain aligned with route config | Generated build output checked |
| `src/sitemap.xml` | Added Guides, Methodology and Changelog with fixed modification dates | Source copy can drift if build is bypassed | Production build regenerates authoritative output |
| `src/_redirects` | Added permanent `.html` aliases for new resources | Edge precedence needs production check | Worker/source review |
| `worker/index.js` | Added new aliases and direct canonical protocol/host/path redirects | Cloudflare Always Use HTTPS may still pre-empt Worker | Added Worker cases; not executed per instruction |
| `test/frontend/adsense-route-eligibility.test.js` | Ensures excluded routes never import ads and consent/indexability gates remain | Static test cannot inspect AdSense account settings | Added, not executed |
| `test/frontend/public-content-quality.test.js` | Ensures policy HTML, visible-without-JS public pages, demo labels and resource counts | Does not replace visual/manual review | Added, not executed |
| `test/frontend/prelaunch-static.test.js` | Updated robots and sitemap expectations | Existing suite may contain unrelated assumptions | Not executed |
| `test/frontend/worker-proxy.test.js` | Added new aliases and canonical origin cases | Cannot prove edge-rule order | Not executed |

All indexable public pages now omit the `workspace-page-loading` HTML class. Their body therefore remains visible if application JavaScript fails.

## C. Advertisement matrix after remediation

No explicit ad slot exists in the repository. The homepage remains the sole loader candidate, but the external AdSense script loads only when all eligibility checks pass and a certified CMP integration returns explicit advertising consent. No such integration is present in this codebase, so the current local result is no external AdSense script on any route.

| Route or route class | Loader imported | External AdSense script can load now | Ad slot may render | Reason |
|---|---:|---:|---:|---|
| `/` | yes | no, until certified CMP reports consent | no in current code state | Sole meaningful/indexable candidate; central checks require canonical 200 page, sufficient main content and explicit consent |
| `/about` | no | no | no | Trust page kept ad-free |
| `/cwl-planner` | no | no | no | Product explanation and sample, kept conservative during review |
| `/cwl-tracker` | no | no | no | Product explanation and sample, kept conservative during review |
| `/clan-management` | no | no | no | Product explanation and sample, kept conservative during review |
| `/guides` | no | no | no | New content requires crawl/index history before any later eligibility decision |
| `/methodology` | no | no | no | New content requires crawl/index history before any later eligibility decision |
| `/changelog` | no | no | no | Trust/update page |
| privacy/cookies/terms/contact | no | no | no | Legal/support pages deliberately excluded |
| login/register/logout/reset/success | no | no | no | Authentication or confirmation state |
| `/dashboard` | no | no | no | Private/noindex application shell |
| `/app/cwl-planner` | no | no | no | Private/interactive workspace |
| `/app/cwl-planner-drafts` | no | no | no | Private saved content/empty state |
| `/app/cwl-tracker` | no | no | no | Input/API/private state |
| `/app/clan-management` | no | no | no | Private Clan Family data |
| `/app/war-operation-board` | no | no | no | Input/API application state |
| profile/settings overlays | no independent loader | no | no | Inherit denied application shell |
| `/bracket-generator` | no | no | no | noindex/coming soon |
| unfinished bracket workspace | no | no | no | noindex/control-only/unfinished |
| 401/403/404/429/500, loading, skeleton, empty and API-error states | no eligible loader | no | no | Explicitly outside allowlist and rejected by page-state checks |
| redirects and `.html` aliases | no page load before redirect | no | no | Only the final canonical page can be evaluated |

Before enabling even the homepage, configure Auto Ads exclusions so Google cannot insert ads in the interactive sample, navigation, controls or calls to action. Prefer a deliberately reserved publisher slot over unrestricted Auto Ads.

## D. Content inventory after remediation

| Public page | Primary intent / unique value | Original evidence or example | Related links | Indexability | Completion |
|---|---|---|---|---|---|
| `/` | Explain collect-plan-track workflow | Existing labelled multi-clan sample plan | tools, guides, methodology, changelog | index | Complete strong public entry point |
| `/about` | Explain independence, philosophy, corrections and limits | Product maintenance/correction process | methodology, changelog, contact | index | Complete except owner-verified builder story |
| `/cwl-planner` | Explain availability-aware multi-clan planning | Labelled seven-day roster-risk table | Auto Plan method, fair-roster and spreadsheet guides | index | Complete public explanation/demo |
| `/cwl-tracker` | Explain live-to-history review | Labelled score/missed/performance/history table | missed, bonus and multi-season resources | index | Complete public explanation/demo |
| `/clan-management` | Explain shared clan/member/account context | Labelled coordination-gap table | availability guide, planner, limitations | index | Complete public explanation/demo |
| `/guides` | Provide eight practical CWL workflows | Original labelled tables, examples, mistakes and trade-offs | features and methodology throughout | index | Initial eight-guide hub complete |
| `/methodology` | Explain deterministic calculations and limits | Worked sample tables and code-grounded rules | guides and product pages | index | Released-feature methods complete |
| `/changelog` | Show recent shipped behaviour without marketing claims | Commit-grounded release entries | corrections and guides | index | Initial public record complete |
| `/subpages/privacy` | Explain processing, providers, advertising and rights | Full initial HTML; verified contact | cookies/contact/provider links | index | Complete; owner/legal review recommended |
| `/subpages/cookies` | Explain storage, ads and consent choices | Full initial HTML | privacy, Google settings, contact | index | Complete text; certified CMP still TODO |
| `/subpages/terms` | Set responsible-use and limitation terms | Full initial HTML | privacy/cookies/contact/fan policy | index | Complete; owner/legal review recommended |
| `/subpages/contact` | Provide support, privacy and security channels | Email plus feedback-form enhancement | policies and corrections | index | Complete |
| `/bracket-generator` | Honest preview of unreleased tool | Clearly marked coming soon | Planner alternative | noindex | Intentionally incomplete and ad-free |

Language note: there are no language-specific URLs. Existing EN/NL/FR/DE/ES choices are client-side preferences on one canonical URL. New guides, methodology, changelog and sample explanations are English source content; no duplicate locale URLs or unsupported `hreflang` claims were added.

## E. Tests and validation

The owner explicitly said the final tests were unnecessary. The full unit/integration suite was therefore not run, and no passing claim is made for it.

| Validation | Exact result |
|---|---|
| Unit tests | **Skipped by owner instruction** |
| Integration/Worker tests | **Skipped by owner instruction** |
| Production build | `npm.cmd run build` passed; static application copied to `dist`, with generated robots/sitemap |
| Diff whitespace check | `git diff --check` returned no errors; only Git line-ending notices were shown |
| Live pre-change crawl/status checks | Normal, Googlebot Smartphone, AdsBot-Google and Mediapartners-Google matched across audited routes; public/config files 200, unknown route 404 |
| Post-change browser checks | Guides at 1265 px: 1 H1, 8 articles, 5 nav links, no overflow. At 390 px: public menu visible, TOC/table contained. Methodology overflow was found, fixed, then verified at `scrollWidth === clientWidth` |
| Policy/browser checks | Privacy: 1 H1 and 11 sections; cookies: 1 H1 and 7 sections; no loading gate, no horizontal overflow, no AdSense network script |
| Homepage browser check | 1 H1, canonical present, no loading gate, no external AdSense script, no console warnings/errors |
| Sitemap validation script | Added/updated but **not executed** |
| Structured-data validation script | JSON parsing checks added but **not executed** |
| Broken-link validation script | Internal target checks added but **not executed** |
| AdSense exclusion tests | Added but **not executed**; direct source scan found `Data/ads.js` only in `src/index.html` |
| Lighthouse/Core Web Vitals | **Not run** |
| Production-like Cloudflare preview | Local clean-route static preview used; remote Cloudflare preview **not run** |

## F. Remaining owner input

These values were intentionally not invented:

- **TODO(owner):** confirm the builder name and wording that may appear publicly.
- **TODO(owner):** confirm whether the origin story may state that ClashPanel came from personally managing a large Clash of Clans community, and confirm any approximate community size.
- **TODO(owner):** confirm the current public contact address remains `support.clashpanel@gmail.com`.
- **TODO(owner):** confirm AdSense publisher ID `pub-7361256415342967` is the intended owner ID.
- **TODO(owner):** configure and verify a Google-certified CMP for EEA/UK/Switzerland, then expose an explicit `ClashToolsCMP.hasAdvertisingConsent()` decision and preferences control. Until then ads stay disabled.
- **TODO(owner):** decide whether to keep all ads disabled through re-review or later enable one deliberately reserved homepage slot after Auto Ads exclusions are configured.
- **TODO(owner):** supply or approve anonymised screenshots from the current application if real UI images should supplement the controlled static demos. No screenshot is required for the current demos to remain useful.
- **TODO(owner):** verify Search Console property/canonical selection, coverage reasons, manual actions and security issues.
- **TODO(owner):** change/verify the Cloudflare HTTP+`www` redirect rule so every variant reaches the final apex HTTPS clean URL in one hop; current live HTTP `www` behaviour is two hops.
- **TODO(owner/legal review):** review privacy, cookie and terms wording before deployment; this work is a technical/content implementation, not legal advice.

## Search Console and AdSense review-readiness checklist

1. Review and approve the owner/legal TODOs above.
2. Deploy only the confirmed files; do not include the separate Clan Family working tree.
3. Verify `https://clashpanel.com` as the canonical hostname and correct the remaining two-hop HTTP `www` edge rule.
4. Verify all sitemap URLs return 200, show the expected initial HTML and have one canonical/H1.
5. Submit `https://clashpanel.com/sitemap.xml` in Search Console.
6. Inspect `/`, `/cwl-planner`, `/cwl-tracker`, `/clan-management`, `/guides` and `/methodology` as live URLs.
7. Request indexing for the improved primary pages after the deployment is stable.
8. Compare Googlebot-rendered HTML with the same visible core content; do not create crawler-specific responses.
9. Review excluded-page indexing reasons and confirm private/noindex routes are absent from the sitemap.
10. Confirm no manual action or security issue is present.
11. Confirm the external AdSense script is absent on every excluded route and remains absent everywhere until certified consent is configured.
12. Confirm the cookie-preferences control can be reopened after a choice and that refusing optional consent does not block public content.
13. Verify `ads.txt` on apex and `www` variants returns the exact approved publisher record as plain text.
14. Allow the new and improved pages to be crawled and indexed; check their actual titles/descriptions in Search results.
15. Only then request another AdSense review. Do not purchase traffic, click ads, incentivise engagement or use bots.

# Manual Checks Before Starting the ClashPanel Redesign

This file contains only the work that still needs a real local/browser check.

---

# A. Branch/base check — mandatory

Before giving the master prompt to Sol:

1. open the local repository;
2. fetch all branches;
3. confirm which branch contains the latest asset work from the other chat;
4. compare it with the broad functional branch;
5. ensure the redesign starts from a branch that includes:
   - current public/i18n/accessibility fixes;
   - Advanced Stats;
   - expanded Achievements;
   - Minigames;
   - current War Board functionality;
   - real Bracket engine;
   - the new asset library;
   - removal of GitHub Actions CI if that is your chosen repo state.

Do not blindly start from `master`.

---

# B. Review FUNCTIONAL_CONTRACT.md

You only need to answer:

- Is there any obscure feature I missed?
- Is anything listed that you intentionally removed already?
- Are Friends still active?
- Is JSON import/export still intentionally supported in CWL Tracker?
- Is the Bracket engine currently meant to be considered live/stable internally?
- Are there any admin/permission actions in Clan Family not described?
- Are there any Planner actions hidden in context menus/popovers that are missing?

If yes, add one sentence to the relevant section.

---

# C. Review UI_STATE_MATRIX.md

Check for states that depend on your real backend knowledge:

- exact Advanced Stats lifecycle states;
- exact "no CWL" backend response;
- War Board private-war/unavailable behavior;
- Clan Family permission levels;
- Achievement source statuses;
- profile verification states.

No redesign work is needed here—just correct any wrong label/state.

---

# D. Integrate fixture mode locally

This is the most technical manual/local step.

Ask Codex/Sol to:

1. inspect real data-boundary functions;
2. create a development-only fixture adapter;
3. map the scenario IDs from `src/fixtures/redesign/scenarios.json`;
4. ensure the adapter is impossible to activate in production;
5. render each important fixture once.

You do NOT need to hand-write all JSON yourself.

After integration, manually check:
- fixture URL opens;
- fixture badge appears;
- production URL does not use fixture data;
- no real user data is in fixture files.

---

# E. Capture baseline screenshots

Use `BASELINE_SCREENSHOT_PLAN.md`.

Prefer automation with Playwright/browser tooling.

Your manual role:
1. make sure local login/session is available where needed;
2. make sure fixture mode works;
3. approve browser access if Codex asks;
4. visually confirm screenshots are of the intended state.

You should not need to take dozens of screenshots by hand.

---

# F. Add local verify command

Copy `scripts/redesign/verify-redesign.mjs` into the repo.

Add to `package.json`:

```json
"verify:redesign": "node scripts/redesign/verify-redesign.mjs"
```

Optional full mode:

```text
node scripts/redesign/verify-redesign.mjs --full
```

Then run:

```text
npm run verify:redesign
```

Manual check:
- it exits with code 0 before redesign;
- no GitHub Actions workflow is created;
- it does not deploy anything;
- warnings are understood before starting.

---

# G. Asset check

Because assets were prepared in another chat, manually verify:

- the asset branch is actually merged/included in the redesign base;
- `manifest.json` paths resolve;
- no required assets are Git-LFS placeholders unless deployment supports them;
- WebP/SVG files render locally;
- filename casing matches exactly;
- source/provenance file exists;
- no sensitive/temporary download files are committed.

---

# H. Final preflight

Before starting Sol/Luna, you should be able to say YES to:

```text
[ ] Correct broad functional base branch selected
[ ] Asset work included
[ ] GitHub Actions CI remains disabled
[ ] FUNCTIONAL_CONTRACT reviewed
[ ] UI_STATE_MATRIX reviewed
[ ] Fixture adapter works locally
[ ] Baseline screenshots captured
[ ] npm run verify:redesign passes
[ ] Existing production build still succeeds
[ ] No production deployment was triggered
```

Once these are true, stop preparing and start the redesign.

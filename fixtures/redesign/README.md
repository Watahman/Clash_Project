# ClashPanel Redesign Fixture Specification

## Important

The runtime catalog at `src/fixtures/redesign/scenarios.json` contains **reference fixtures**, not drop-in mocks.

Why:
- ClashPanel currently combines frontend state, Supabase/backend responses, live Clash/API data and local persistence.
- A fixture that merely looks plausible can be more dangerous than useful if it bypasses real adapters.

Use these files to define reproducible states.
Then connect them to the real application through a thin **development-only fixture adapter**.

Never enable fixture mode in production.

---

# Recommended dev interface

Preferred URL form:

```text
?cpFixture=<scenario-id>
```

Examples:

```text
/app/cwl-planner?cpFixture=planner-large
/app/cwl-tracker?cpFixture=cwl-active
/app/advanced-stats?fixture=stats-partial
```

Alternative:

```text
localStorage.CLASHPANEL_FIXTURE = "planner-large"
```

URL is preferred because screenshots become reproducible.

---

# Adapter rules

A fixture adapter should:

1. run only in localhost/dev/explicit preview builds;
2. be tree-shakeable/removable or hard-disabled in production;
3. feed the same view-model/data-boundary functions used by real data;
4. never change production API code paths;
5. display a visible `Fixture mode` badge;
6. reject unknown fixture IDs;
7. support deterministic dates/IDs;
8. avoid real user data.

---

# Scenario catalog

## Planner

- `planner-empty`
- `planner-normal`
- `planner-large`
- `planner-multi-clan`
- `planner-conflicts`
- `planner-poll-partial`
- `planner-auto-preview`
- `planner-optimize`

## CWL Tracker

- `cwl-no-source`
- `cwl-active`
- `cwl-direct-clan`
- `cwl-no-current`
- `cwl-partial`
- `cwl-complete`
- `cwl-history`

## War Board

- `war-no-current`
- `war-preparation`
- `war-live`
- `war-finished`
- `war-missed-attacks`
- `war-active-cwl`

## Clan Family

- `family-empty`
- `family-member`
- `family-admin`
- `family-active-poll`
- `family-poll-partial`
- `family-audit-issues`
- `family-large`

## Advanced Stats

- `stats-no-account`
- `stats-not-tracking`
- `stats-initializing`
- `stats-active`
- `stats-paused`
- `stats-degraded`
- `stats-error`
- `stats-partial`
- `stats-no-attacks`
- `stats-rich-90d`

## Achievements

- `achievements-no-account`
- `achievements-new`
- `achievements-mid`
- `achievements-rich`
- `achievements-missing-source`
- `achievements-import-valid`
- `achievements-import-invalid`

## Minigames

- `entity-fresh`
- `entity-mid`
- `entity-won`
- `entity-lost`
- `higher-lower-fresh`
- `higher-lower-correct`
- `higher-lower-final`

## Bracket

- `bracket-4`
- `bracket-8`
- `bracket-12-byes`
- `bracket-32`
- `bracket-complete`

---

# Determinism

Fixtures should use:
- fixed player/clan tags reserved for fixtures;
- fixed timestamps;
- fixed random seeds for shuffled brackets/minigames where possible;
- fixed current date override where the UI depends on "today";
- no network requests unless the fixture explicitly tests failure/loading behavior.

---

# Privacy

Never copy a real production user's:
- email;
- auth token;
- player token;
- private family join code;
- notification content;
- Supabase identifiers.

Synthetic names/tags only.

---

# Acceptance

A fixture is only considered integrated after:
1. the real page opens with its fixture ID;
2. the expected state appears;
3. real production mode is unchanged;
4. build output does not accidentally enable fixture mode.

# Advanced Stats production-readiness audit

Audit baseline: 2026-09-11, Development checkout at `3b075dd` (the current
branch is `Development`); the compact changes audited here include the
`c829134d` implementation ancestor. This document describes the data contract
visible in the repository, the verified upstream contract, and the live
database checks completed against the Supabase project **Tools for clash**
(`cibxpltbmvjadfnnfqom`). It does not claim that a new application revision has
received production traffic.

## Evidence boundary

The checkout contains the compact collector/read path and the migration chain.
Live verification was completed against the Tools for clash Supabase project.
The following migrations were applied successfully:

- `20260911000307_advanced_stats_loot_and_army_compaction_foundation.sql`;
- `20260911000309_advanced_stats_loot_and_army_compaction_writes.sql`;
- `20260911000311_advanced_stats_loot_and_army_compaction_reads.sql`; and
- `20260911000312_advanced_stats_army_dictionary_fk_index.sql`.

The live schema/RLS/privilege/RPC check passed: 7 compact tables, 26
functions, and 19 required migrations were present. Browser access to the
schema, tables, and RPCs was denied as intended; service-role access is
required. Transactional smoke tests, including rollback, also passed. The
live snapshot and its limits are recorded below.

The implementation described below is present as an uncommitted Development
worktree change. It passed local unit, contract, build, and browser validation;
the four migrations above also passed live schema and transactional smoke
verification.

## End-to-end data flow

```text
ClashKing V2 HTTP API
  -> ClashKingV2AdvancedStatsSource (scope windows, season/day resolution)
  -> ClashKingV2AdvancedStatsParser (attack-only normalized observations)
  -> local watermark/checkpoint and stable event fingerprint
  -> save_advanced_stats_compact_page_v1 (one page, one transaction)
  -> event receipts + scope/day, unit/day, and army/day compact tables
  -> compact SQL read RPCs and achievement projections
  -> authenticated Java read service
  -> Advanced Stats page (five sections requested in parallel)
```

The source adapter uses a local UTC league-history cache and a per-scope
watermark. It reports `PARTIAL` when an upstream route has no cursor, total,
or completeness signal. A page is capped at 500 events. The collector stores
no full upstream response; the durable event identity is the receipt key and
the durable analytical state is the compact aggregate.

Typed ClashKing failures now survive the compact collector path. HTTP 429,
upstream 5xx, and transport timeouts therefore reach the scheduler's intended
rate-limit/outage backoff instead of becoming generic failures.

## Source and consumer matrix

| Scope / purpose | Current upstream route and request | Upstream fields used by the parser | Durable representation | Known boundary |
| --- | --- | --- | --- | --- |
| Normal attack history | `/v2/player/{playerTag}/battlelog/history` with an optional UTC `time[after]`/`time[before]` window | `battleTime`, `stars`, `destructionPercentage`, `lootedResources.gold/elixir/darkElixir`, nullable `shareCode`; opponent, Town Hall, attack side, and compatibility aliases are also accepted | `NORMAL` event receipt; `scope_daily`; conditional `scope_unit_daily` and `scope_army_daily` | Stored battle history has no documented cursor/total in the adapter. The upstream history is rolling and has no stable battle identifier in the inspected schema; available source-issued or legacy event keys remain part of the fingerprint, while rows with no usable key retain an inherent residual risk. |
| Ranked season | `/v2/player/{playerTag}/ranked/{seasonId}/battlelog`; `/v2/player/{playerTag}/league/history` resolves the active season unless overridden | Response envelope has `attacks[]` and `defenses[]`; attacks include `time`, own/opponent Town Hall, stars, destruction, loot, nullable `shareCode`, and trophies. League history supplies `mode`, `seasonId`, and league metadata | `RANKED` receipts and aggregates partitioned by `season_key`; small source/provenance metadata in scope state | Only attacks are retained. No cursor/total/completeness is exposed to the adapter. The OpenAPI contract calls the path value `seasonId` and declares it a string, while current code's season validation accepts numeric Unix-seconds only. Live ranked-season smoke coverage passed for the supported worker format and season boundaries. |
| Legend-day history | `/v2/player/{playerTag}/legend/{day}/battlelog`; day comes from `/v2/dates/current` (`legend`) | `attacks[]` include time, own/opponent Town Hall, stars, destruction, loot, nullable `shareCode`, and trophies; `defenses[]` are available upstream but are not used for attack metrics | Merged into the `RANKED` season partition as attack receipts and compact aggregates | The source fetches the current Legend day, not an independently complete historical range. Missed/delayed polling can leave coverage partial. |
| War attacks | `/v2/player/{tag}/war/attacks` with UTC window, optional `type`, and `limit` (adapter page size 500) | `war_id`, `warEndTime`, `warType`, `side`, attacker/defender identities and Town Halls, stars, destruction, duration, attack order | `WAR` receipts keyed by canonical war identity/side/order; `scope_daily` | Attack/defense orientation is normalized from `side`. The route documents no loot or army payload, so War contributes to neither reliable loot nor unit/army metrics. `warEndTime` is a bucket timestamp, not claimed as exact attack time. |
| Current date metadata | `/v2/dates/current` | Required `season`, `raid`, `legend`, and `clan-games` strings | Not stored as battle data; used to resolve the Legend day and season context | This is control metadata, not an attack source. |
| Compact read path | Supabase compact RPCs called by the Java read repository | Aggregated attacks, stars, destruction, star buckets, three loot totals, units, armies, and UTC daily trends | Read-only projections from compact tables; raw battle history returns `unsupported: raw_attack_history_not_retained` | The legacy read document still describes retained raw attacks and is stale for this path; it must not be used as a current contract. |

The upstream contract was checked against the [ClashKing OpenAPI document](https://api.clashk.ing/openapi.json)
and its [interactive API documentation](https://api.clashk.ing/docs). ClashKing
states that its statistics are collected by polling the Official API, are not
perfect, and should be credited; this is an upstream provenance limitation, not
a guarantee of completeness.

## Current repository model versus intended storage

“Current” below means what is present in the Development source and migration
chain. The compact schema and its new loot/army migrations are also confirmed
live in the Tools for clash project as described in the verification snapshot.

### Historical/raw model

`20260807_001_advanced_stats_foundation.sql` defines the original raw model:
`advanced_stats_battles`, `advanced_stats_battle_units`, tracker-level unit and
army totals, `advanced_stats_daily`, and tracking gaps. It carries raw battle
columns and one row per unit observation. The current compact read repository
does not use that model as its normal write path.

### Compact source-of-truth model

The additive compact migrations define:

- `advanced_stats_tracking` for owner/player lifecycle and lease state;
- `advanced_stats_scope_state` for `NORMAL`, `WAR`, and `RANKED` checkpoints,
  capability, coverage, provenance, and bootstrap status;
- `advanced_stats_event_receipts` with the dedupe primary key
  `(tracking_id, scope, season_key, event_fingerprint)`;
- `advanced_stats_scope_daily` for attack counts, stars, destruction, star
  buckets, legacy resource totals, and separate reliable loot rollups;
- `advanced_stats_scope_unit_daily` for normalized unit usage; and
- `advanced_stats_scope_army_daily` for normalized army hashes and rollups; and
- `advanced_stats_army_dictionary` for one content-addressed display JSON per
  army hash instead of one repeated JSON document per tracker/day row.

The intended durable model retains derived observations and receipt identities,
not complete upstream JSON. Army display JSON is retained once in the global
dictionary, and provenance is bounded metadata. Raw attack history is therefore
not a supported read contract after the cutover migration; the compatibility
read returns an explicit unsupported result.

Historical legacy loot columns remain untouched but are never projected as
reliable loot. Historical receipts are ineligible for enrichment because their
old zero-normalized state cannot be reconstructed safely. Only post-migration
events with explicit `lootAvailable=true` populate `reliable_*` totals, known
attack counts, and per-resource bests. A new receipt first seen without loot can
be enriched exactly once when its stable fingerprint later carries real loot.

The live checks in this update cover the compact schema, its RPCs, privileges,
and transactional behavior. They do not change the separate cutover contract:
the cutover migration contains a transactional `DROP TABLE IF EXISTS` for the
raw tables, with a five-second lock timeout and a 90-second statement timeout.
Raw-table retention is therefore still governed by the recorded migration
history and is not inferred from the compact-table snapshot below.

## Safe migration semantics

The repository's migration sequence expresses the following safety contract.
The four new migrations listed in the evidence boundary were applied to the
live Tools for clash project, and their schema/RLS/privilege/RPC and
transactional smoke checks passed:

1. Add compact tables, scope state, indexes, RLS, and service-role grants
   without deleting the raw model.
2. Add `season_key` to ranked receipts and aggregate keys. The season-aware
   wrappers reject a write whose season does not match the active ranked state;
   the first activation resets the ranked checkpoint rather than mixing
   seasons.
3. Run the V2 collector with the batched page RPC. The page is limited to 500;
   receipt primary keys make retries idempotent; expected cursor/watermark
   values are checked while the scope row is locked; checkpoint, bootstrap
   progress, and the page's writes commit in one transaction.
4. Verify compact reads, dedupe/retry behavior, scope coverage, and any needed
   backfill/reconciliation before removing raw storage. A failed bootstrap can
   be retried without deleting compact statistics. Live verification confirmed
   scopes, dedupe, loot enrichment including zero loot, compact aggregates,
   checkpoints, ranked seasons, bootstrap, and read RPCs.
5. Apply the cutover only after that verification. It drops the raw tables in a
   transaction and leaves an explicit unsupported compatibility read. This is
   not a reversible data migration once the raw rows are removed.

Tracker deletion is expected to cascade compact data and remove only the
Advanced Stats-derived achievement metrics; unrelated achievement progress is
preserved. The live transactional smoke coverage included rollback and the
compact deletion/checkpoint path; unrelated achievement progress remains
outside this audit's write surface.

## Request, query, and scheduler budgets

These are code-derived upper bounds/configuration values, not observed
production traffic:

| Area | Bound in the repository | Implication |
| --- | --- | --- |
| Scheduler batch | At most 25 due trackers per poll; 600-second lease | A single poll does not claim an unbounded player set. |
| Poll cadence | Active trackers default to 15 minutes; idle/backoff defaults to 30 minutes, with rate-limit/outage backoff | Retry pressure is bounded, but actual scheduler invocation and 429 rates are unknown. |
| Upstream fetches | One Normal request + one War request + up to four Ranked-related requests (league history, current dates, ranked season, Legend day) when no cache/override applies | A full three-scope pass is at most six HTTP requests per tracker by current control flow; cache/season override can reduce this. |
| Collection pages | Incremental: one page per scope. Bootstrap: at most 20 pages per scope, across three scopes | Worst-case bootstrap is 60 pages/tracker, each at most 500 upstream events. |
| Compact writes | One `save_advanced_stats_compact_page_v1` RPC per page; event dedupe and aggregate updates run in the page transaction | Retries do not require one write RPC per event in the active collector path. Exact REST round trips for state loading are not measured here. |
| Read fan-out | Overview: 9 compact RPCs (3 scopes × overview/units/armies); units: 4; armies: 3; trends: 3 | The initial page loader requests overview, units, armies, trends, and battles in parallel. Raw battles performs no raw-table read and reports unsupported. |
| API page limits | Armies default 20/max 100; raw battles default 25/max 100 but the current repository returns unsupported | Limits bound response size, not upstream completeness. |

The Java collector filters non-attacks before persistence. Consequently, the
receipt and all displayed loot/star metrics represent accepted attacks, not a
count of every upstream row.

## Live Tools for clash verification snapshot

The following measurements were taken against Supabase project
`cibxpltbmvjadfnnfqom` before and after applying the four migrations listed in
the evidence boundary. This is a small current dataset, not a growth baseline.
The byte values are `pg_total_relation_size`-style physical relation sizes and
include the relation's indexes where applicable.

| Relation | Before: rows / bytes | After: rows / bytes | Note |
| --- | ---: | ---: | --- |
| `advanced_stats_event_receipts` | 80 / 131072 | 80 / 155648 | Existing receipts preserved; reliable loot/enrichment fields added. |
| `advanced_stats_scope_army_daily` | 6 / 106496 | 6 / 122880 | Includes the new 16 KB army-dictionary foreign-key index. |
| `advanced_stats_scope_daily` | 53 / 98304 | 53 / 98304 | Row count and measured size unchanged in this snapshot. |
| `advanced_stats_scope_state` | 3 / 131072 | 3 / 131072 | Checkpoints and scope state preserved. |
| `advanced_stats_scope_unit_daily` | 28 / 114688 | 28 / 114688 | Row count and measured size unchanged in this snapshot. |
| `advanced_stats_tracking` | 1 / 147456 | 1 / 147456 | Tracking state preserved. |
| `advanced_stats_army_dictionary` | n/a | 6 / 32768 | New deduplicated army display rows. |

Live smoke verification passed for all three scopes, receipt dedupe, missing-
loot enrichment, explicit zero-loot handling, compact aggregates, checkpoints,
ranked-season boundaries, bootstrap, and compact read RPCs. The transaction
rollback path also passed. Browser/schema/table/RPC access remained denied;
service-role access is required by design.

## Storage-growth estimate (planning only)

The live snapshot below is small and current, so it is not a representative
growth benchmark. The following scenario remains explicitly an assumption for
capacity planning, not a product metric:

- four unique accepted attacks per tracker per day across all scopes;
- eight distinct normalized unit keys per attack;
- one new army hash per attack;
- one daily row for each of the three scopes; and
- approximate physical footprint, including a typical row/index/JSON allowance
  but excluding bloat, backups, replicas, and operational overhead:
  receipt `0.20–0.35 KB`, unit-day `0.25–0.60 KB`, army-day `0.8–2.0 KB`,
  scope-day `0.25–0.50 KB`.

Before army-dictionary normalization, that gives approximately `13–30 KB per
tracker per day`, or `0.38–0.90 MB per 30-day month`:

| Tracked players | Estimated compact growth/month | Status |
| ---: | ---: | --- |
| 100 | 38–90 MB | assumption-based, not measured |
| 1,000 | 0.38–0.90 GB | assumption-based, not measured |
| 10,000 | 3.8–9.0 GB | assumption-based, not measured |

If four attacks occur in each scope rather than across all scopes, multiply the
attack-driven portion by roughly three. Distinct-unit and distinct-army
cardinality, JSON size, index fill factor, and receipt retention are the main
uncertainties. The old raw model would add raw attack rows and per-unit rows.
The live before/after snapshot is too small to replace these planning
assumptions with a representative growth rate.

The new dictionary removes roughly `0.4–1.6 KB` of repeated army JSON per
applicable army/day row, while receipt loot state adds an estimated
`0.03–0.07 KB` per event. For a typical repeated-army workload this yields an
estimated **5–20% reduction in ongoing compact-table growth**. If nearly every
army hash is unique, the net reduction approaches 0%. This range covers only
the incremental compact-schema change and must be replaced with live relation
and index measurements after migration.

## Upstream and contract limitations

- ClashKing is a polled/derived source. Its OpenAPI explicitly says the stats
  are not perfect; outages, delayed polling, upstream corrections, and missed
  Legend days can create partial coverage.
- The inspected history and war routes expose no cursor/total/completeness
  contract used by this adapter. Local watermarks are a checkpoint, not proof
  that the upstream range is complete.
- Ranked and Legend use different route shapes and are merged into the ranked
  scope. The current OpenAPI uses `{seasonId}` and `attacks`/`defenses`; older
  repository documentation mentions `{season}` and `battlelogs`. The current
  route/field contract must remain the source of truth.
- OpenAPI types the path `seasonId` as a string, while the current worker source
  requires a positive numeric Unix-seconds value. The resolver follows the
  worker contract, uses league history for discovery, caches only successful
  resolutions, and treats transient discovery failures as retryable.
- `shareCode` is nullable and the inspected normal/ranked/Legend responses do
  not guarantee an army composition. Missing share code/army data means no
  unit or army observation is available.
- War's inspected item schema does not include loot. War observations therefore
  carry `lootAvailable=false` and cannot enter reliable loot rollups.
- Upstream numerical schemas allow non-finite forms in places. The parser/domain
  must reject `NaN` and infinities rather than persist or display them.
- Duration and some trophy fields are available upstream but are not part of
  the current compact analytical contract. Raw JSON is not retained for later
  replay or forensic reconstruction.
- Stable upstream keys are preferred. Known source prefixes are canonicalized;
  an unknown or legacy source-issued key remains part of the fingerprint so
  repeated battles against the same opponent cannot collapse. Mutable loot and
  outcome fields are excluded, so later enrichment keeps the same identity.
  Ranked and Legend share the canonical ranked identity to block overlap
  double-counting.

## Implemented UI and read contract

The authenticated page shows Total Loot Farmed as separate Gold, Elixir and
Dark Elixir totals, averages, and per-resource bests, plus a loot trend. It
never creates a combined economic score. All values are server-side aggregates
and remain unavailable when no attack in the selected tracked period has
explicit reliable loot. Existing data remains visible with a stale/degraded
warning on transient tracking failures.

The repository has no dedicated Home Village resource-token WebPs; the UI uses
the existing local Gold, Elixir, and Dark Elixir storage WebPs rather than
adding or fetching images. Desktop and 390x844 mobile layouts were inspected
locally in light and dark themes. Loading, empty, partial, and degraded states
are also covered by fixture/contract tests. The fixture battle timeline is only
a presentation harness; production raw history remains explicitly unsupported.

## Verification sources and update checklist

Repository evidence to re-check with line-level links in a release review:

- `src/Java/advancedstats/ClashKingV2AdvancedStatsRoutes.java`
- `src/Java/advancedstats/ClashKingV2AdvancedStatsSource.java`
- `src/Java/advancedstats/ClashKingV2AdvancedStatsParser.java`
- `src/Java/advancedstats/AdvancedStatsCompactEventFingerprint.java`
- `src/Java/advancedstats/AdvancedStatsBatchedCompactRepository.java`
- `src/Java/advancedstats/AdvancedStatsCompactReadAggregator.java`
- `src/Java/AdvancedStatsInternalPoll.java`
- `src/Java/SUPABASE_AdvancedStats.java`
- `src/assets/js/pages/advanced-stats-data-loader.js`
- `database/migrations/20260807_001_advanced_stats_foundation.sql`
- `database/migrations/20260814204723_advanced_stats_compact_source_of_truth.sql`
- `database/migrations/20260815090000_advanced_stats_ranked_season_schema.sql`
- `database/migrations/20260815090200_advanced_stats_ranked_season_write_contract.sql`
- `database/migrations/20260824200428_clashking_v2_compact_cutover.sql`
- `database/migrations/20260829184000_advanced_stats_batched_collection.sql`
- `database/migrations/20260829192000_advanced_stats_retry_failed_bootstrap.sql`
- `database/migrations/20260911000307_advanced_stats_loot_and_army_compaction_foundation.sql`
- `database/migrations/20260911000309_advanced_stats_loot_and_army_compaction_writes.sql`
- `database/migrations/20260911000311_advanced_stats_loot_and_army_compaction_reads.sql`
- `database/migrations/20260911000312_advanced_stats_army_dictionary_fk_index.sql`

External references:

- [ClashKing OpenAPI](https://api.clashk.ing/openapi.json)
- [ClashKing API docs](https://api.clashk.ing/docs)
- [ClashKing API repository](https://github.com/ClashKingInc/ClashKingAPI)
- [ClashKing API-audit notes](https://github.com/ClashKingInc/ClashKingApp/blob/main/api-audit.md)
- [Supercell Fan Content Policy](https://supercell.com/fan-content-policy)

### Live post-verification update

Live verification completed on 2026-09-11 against Supabase project Tools for
clash (`cibxpltbmvjadfnnfqom`). Foundation, writes, reads, and the army
dictionary foreign-key index migrations applied successfully. The schema/RLS/
privilege/RPC check passed with 7 tables, 26 functions, and 19 required
migrations. Browser access to schema, tables, and RPCs was denied as intended;
service-role access is required.

The transactional smoke suite passed, including rollback. It verified all
three scopes, dedupe, missing-loot enrichment, explicit zero-loot handling,
compact aggregates, checkpoints, ranked-season boundaries, bootstrap, and read
RPCs. The compact read/bootstrap contracts therefore have live evidence in
addition to the repository tests.

An advisor finding for the missing army-dictionary foreign-key index was fixed
by `20260911000312_advanced_stats_army_dictionary_fk_index.sql`. Other advisor
findings were pre-existing or outside this task's scope and are not represented
as new regressions here.

The live size snapshot is intentionally small:

| Relation | Before: rows / bytes | After: rows / bytes |
| --- | ---: | ---: |
| `advanced_stats_event_receipts` | 80 / 131072 | 80 / 155648 |
| `advanced_stats_scope_army_daily` | 6 / 106496 | 6 / 122880 |
| `advanced_stats_scope_daily` | 53 / 98304 | 53 / 98304 |
| `advanced_stats_scope_state` | 3 / 131072 | 3 / 131072 |
| `advanced_stats_scope_unit_daily` | 28 / 114688 | 28 / 114688 |
| `advanced_stats_tracking` | 1 / 147456 | 1 / 147456 |
| `advanced_stats_army_dictionary` | n/a | 6 / 32768 |

The army-daily post-migration size includes the new 16 KB foreign-key index.
These measurements confirm migration behavior for the current dataset, but do
not replace the planning estimate: retain the expected **5–20%** incremental
compact-growth reduction for typical repeated-army workloads, with close to 0%
in the nearly-all-unique-army worst case. A larger representative dataset is
still required for a production capacity claim.

This update confirms live database readiness for the applied migrations and
compact contracts. It does not assert a deployed application revision,
traffic assignment, observed scheduler rates, or production rollout status.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = (name) => readFileSync(`database/migrations/${name}`, 'utf8');

describe('Advanced Stats compact database contract', () => {
    const schema = migration('20260814204723_advanced_stats_compact_source_of_truth.sql');
    const backfill = migration('20260814205008_advanced_stats_compact_backfill.sql');
    const writes = migration('20260814205010_advanced_stats_compact_rpc_contract.sql');
    const reads = migration('20260814205225_advanced_stats_compact_reads.sql');
    const bootstrap = migration('20260814205443_advanced_stats_compact_bootstrap.sql');
    const capabilities = migration('20260814205530_advanced_stats_compact_capabilities.sql');
    const seasonSchema = migration('20260815090000_advanced_stats_ranked_season_schema.sql');
    const seasonSwitch = migration('20260815090100_advanced_stats_ranked_season_switch.sql');
    const seasonCompat = migration('20260815090150_advanced_stats_ranked_season_v1_compat.sql');
    const seasonWrites = migration('20260815090200_advanced_stats_ranked_season_write_contract.sql');
    const seasonOverview = migration('20260815090300_advanced_stats_ranked_season_overview_read.sql');
    const seasonUnits = migration('20260815090400_advanced_stats_ranked_season_units_read.sql');
    const seasonArmies = migration('20260815090500_advanced_stats_ranked_season_armies_read.sql');
    const seasonTrends = migration('20260815090600_advanced_stats_ranked_season_trends_read.sql');
    const compactionFoundation = migration('20260911000307_advanced_stats_loot_and_army_compaction_foundation.sql');
    const compactionWrites = migration('20260911000309_advanced_stats_loot_and_army_compaction_writes.sql');
    const compactionReads = migration('20260911000311_advanced_stats_loot_and_army_compaction_reads.sql');
    const compactionIndex = migration('20260911000312_advanced_stats_army_dictionary_fk_index.sql');
    const lifetime = migration('20260912103406_advanced_stats_lifetime_dashboard.sql');
    const compaction = [compactionFoundation, compactionWrites, compactionReads, compactionIndex].join('\n');

    it('defines scope-aware compact state and daily aggregates with RLS', () => {
        for (const table of [
            'advanced_stats_scope_state',
            'advanced_stats_event_receipts',
            'advanced_stats_scope_unit_daily',
            'advanced_stats_scope_army_daily',
            'advanced_stats_scope_daily'
        ]) {
            expect(schema).toContain(`create table if not exists public.${table}`);
            expect(schema).toContain(`alter table public.${table} enable row level security`);
            expect(schema).toContain(`revoke all on table public.${table} from public, anon, authenticated`);
        }
        expect(schema).toContain("scope in ('NORMAL', 'WAR', 'RANKED')");
        expect(schema).toContain("coverage_status text not null default 'PARTIAL'");
        expect(schema).toContain('bootstrap_progress');
        expect(schema).toContain('bootstrap_error_message');
    });

    it('backfills existing processed rows without deleting legacy data', () => {
        expect(backfill).toContain('advanced_stats_battles');
        expect(backfill).toContain('advanced_stats_event_receipts');
        expect(backfill).toContain('advanced_stats_scope_unit_daily');
        expect(backfill).toContain('advanced_stats_scope_army_daily');
        expect(backfill).toContain('advanced_stats_scope_daily');
        expect(backfill).toContain('on conflict (tracking_id, scope, event_fingerprint) do nothing');
        expect(backfill).toContain("'sourceId', 'OFFICIAL_BATTLELOG'");
        expect(backfill).toContain("then 'RANKED'");
        expect(backfill).toContain("when 'RANKED' then 'UNAVAILABLE'");
        expect(backfill).toContain('latest.event_at > state.source_watermark_at');
        expect(backfill).not.toContain("'sourceId', 'CLASHKING'");
        expect(backfill).not.toMatch(/\bdrop\s+(table|column)\b/i);
        expect(backfill).not.toMatch(/\bdelete\s+from\b/i);
    });

    it('keeps compact RPCs invoker-only and backend-only', () => {
        for (const sql of [writes, reads, bootstrap, capabilities, seasonSchema, seasonSwitch,
            seasonCompat, seasonWrites, seasonOverview, seasonUnits, seasonArmies, seasonTrends]) {
            expect(sql).toContain('security invoker');
            expect(sql).not.toMatch(/security\s+definer/i);
            expect(sql).toContain('revoke all on function');
            expect(sql).toContain('grant execute on function');
            expect(sql).toContain('to service_role');
        }
        expect(writes).toContain('save_advanced_stats_compact_event_v1');
        expect(writes).toContain('advanced_stats_event_receipts');
        expect(reads).toContain('read_advanced_stats_compact_overview_v1');
        expect(reads).toContain('read_advanced_stats_compact_trends_v1');
        expect(bootstrap).toContain('update_advanced_stats_bootstrap_v1');
        expect(capabilities).toContain('record_advanced_stats_scope_capability_v1');
        expect(writes).toContain('p_expected_cursor');
        expect(writes).toContain('source checkpoint changed');
        expect(writes).toContain('if not found then');
        expect(bootstrap).toContain('p_expected_cursor');
        expect(bootstrap).toContain('source checkpoint changed');
        expect(schema).toContain('capability_status');
        expect(schema).toContain('coverage_status');
    });

    it('isolates ranked seasons while retaining legacy rows', () => {
        expect(seasonSchema).toContain('source_season_key text not null default');
        expect(seasonSchema).toContain('season_key text not null default');
        expect(seasonSchema).toContain('primary key (tracking_id, scope, season_key');
        expect(seasonSchema).toContain('rankedSeasonKey');
        expect(seasonSchema).not.toMatch(/security\s+definer/i);
        expect(seasonSwitch).toContain('switch_advanced_stats_ranked_season_v1');
        expect(seasonSwitch).toContain('source_cursor = null');
        expect(seasonSwitch).toContain("bootstrap_status = 'PENDING'");
        expect(seasonCompat).toContain('on conflict (tracking_id, scope, season_key, event_fingerprint)');
        expect(seasonCompat).toContain('save_advanced_stats_compact_event_v1');
        expect(seasonWrites).toContain('save_advanced_stats_compact_event_v2');
        expect(seasonWrites).toContain('update_advanced_stats_scope_poll_v2');
        expect(seasonWrites).toContain('p_ranked_season_key');
        expect(seasonOverview).toContain('read_advanced_stats_compact_overview_v2');
        expect(seasonOverview).toContain('case when p_season_key is null');
        expect(seasonUnits).toContain('read_advanced_stats_compact_units_v2');
        expect(seasonArmies).toContain('read_advanced_stats_compact_armies_v2');
        expect(seasonTrends).toContain('read_advanced_stats_compact_trends_v2');
    });

    it('keeps running and pending bootstrap scopes ahead of partial/unsupported', () => {
        expect(bootstrap).toContain("when bool_or(bootstrap_status = 'RUNNING') then 'RUNNING'");
        expect(bootstrap).toContain("when bool_or(bootstrap_status in ('PENDING', 'NOT_STARTED')) then 'PENDING'");
        expect(bootstrap.indexOf("when bool_or(bootstrap_status = 'RUNNING')")).toBeLessThan(
            bootstrap.indexOf("when bool_or(bootstrap_status = 'PARTIAL')"));
    });

    it('compacts armies and aggregates only explicitly known loot server-side', () => {
        expect(compaction).toContain('create table if not exists public.advanced_stats_army_dictionary');
        expect(compaction).toContain('insert into public.advanced_stats_army_dictionary');
        expect(compaction).toContain('validate constraint advanced_stats_scope_army_daily_army_dictionary_fkey');
        expect(compaction).toContain('advanced_stats_scope_army_daily_army_hash_idx');
        expect(compaction).toContain('drop column if exists normalized_army_json');
        expect(compaction).toContain('loot_known_attacks bigint not null default 0');
        expect(compaction).toContain('reliable_gold_looted bigint not null default 0');
        expect(compaction).toContain('reliable_elixir_looted bigint not null default 0');
        expect(compaction).toContain('reliable_dark_elixir_looted bigint not null default 0');
        expect(compaction).toContain('best_gold_looted bigint');
        expect(compaction).toContain('best_elixir_looted bigint');
        expect(compaction).toContain('best_dark_elixir_looted bigint');
        expect(compaction).toContain('p_loot_available boolean');
        expect(compactionWrites).toContain('v_state.source_cursor is distinct from p_expected_cursor');
        expect(compactionWrites).toContain('v_state.source_watermark_at is distinct from p_expected_watermark_at');
        expect(compactionWrites).toContain('v_state.source_watermark_key is distinct from p_expected_watermark_key');
        expect(compactionWrites).toContain('source checkpoint changed during collection');
        expect(compaction).toContain('loot_enrichment_eligible boolean not null default false');
        expect(compaction).toContain('loot_totals_applied boolean not null default false');
        expect(compactionFoundation).toContain('set loot_enrichment_eligible = false');
        expect(compactionFoundation).not.toContain('set loot_totals_applied = true');
        expect(compactionFoundation).toContain('advanced_stats_event_receipts_loot_enrichment_state_check');
        expect(compactionFoundation).not.toContain('set loot_known_attacks = attacks');
        expect(compaction).toContain("'lootEnriched', v_loot_enriched");
        expect(compaction).toContain("jsonb_typeof(v_event->'lootAvailable')");
        expect(compaction).toContain("case when v_loot_available then v_loot_gold else 0 end");
        expect(compaction).toContain('goldLootAverage');
        expect(compaction).toContain('elixirLootAverage');
        expect(compaction).toContain('darkElixirLootAverage');
        expect(compaction).toContain('averageGoldLooted');
        expect(compaction).toContain('averageElixirLooted');
        expect(compaction).toContain('averageDarkElixirLooted');
        expect(compaction).toContain('goldLootBest');
        expect(compaction).toContain('elixirLootBest');
        expect(compaction).toContain('darkElixirLootBest');
        expect(compaction).toContain('bestGoldLooted');
        expect(compaction).toContain('bestElixirLooted');
        expect(compaction).toContain('bestDarkElixirLooted');
        expect(compaction).toContain('lootAttackCount');
        expect(compaction).not.toMatch(/combined|combinedScore|lootScore|economicScore/i);
        expect(compaction).not.toMatch(/security\s+definer/i);
        expect(compaction).toContain('grant execute on function');
        expect(compaction).toContain('to service_role');
        expect(compactionWrites).toContain('reliable_gold_looted = reliable_gold_looted + v_loot_gold');
        expect(compactionWrites).toContain('and loot_enrichment_eligible = true');
        expect(compactionWrites).toContain('loot_known_attacks = loot_known_attacks + 1');
        expect(compactionReads).toContain('sum(reliable_gold_looted)');
        expect(compactionReads).not.toContain('sum(gold_looted)');
        expect(compactionReads).toContain("'averageGoldLooted'");
    });

    it('keeps schema verification and smoke coverage compact-only after raw cutover', () => {
        const schemaCheck = readFileSync('scripts/check-advanced-stats-schema.sql', 'utf8');
        const compactSmoke = readFileSync('scripts/smoke-test-advanced-stats-compact.sql', 'utf8');
        const smokeRunner = readFileSync('scripts/smoke-test-advanced-stats-db.mjs', 'utf8');
        expect(schemaCheck).toContain("'advanced_stats_army_dictionary'");
        expect(schemaCheck).toContain("'public.save_advanced_stats_compact_event_v3");
        expect(schemaCheck).toContain("'advanced_stats_loot_and_army_compaction_foundation'");
        expect(schemaCheck).toContain("'advanced_stats_loot_and_army_compaction_writes'");
        expect(schemaCheck).toContain("'advanced_stats_loot_and_army_compaction_reads'");
        expect(schemaCheck).toContain("'advanced_stats_army_dictionary_fk_index'");
        expect(schemaCheck).toContain("'reliable_gold_looted'");
        expect(schemaCheck).toContain("'loot_totals_applied'");
        expect(schemaCheck).not.toContain("'advanced_stats_battles'");
        expect(schemaCheck).not.toContain("'public.save_advanced_stats_battle_v");
        expect(compactSmoke).toContain('save_advanced_stats_compact_event_v3');
        expect(compactSmoke).toContain('read_advanced_stats_lifetime_v1');
        expect(compactSmoke).toContain('loot_known_attacks');
        expect(compactSmoke).not.toContain('advanced_stats_battles');
        expect(smokeRunner).toContain("'smoke-test-advanced-stats-compact.sql'");
    });

    it('defines a backend-only all-time lifetime read model from compact aggregates', () => {
        expect(lifetime).toContain('read_advanced_stats_lifetime_v1(uuid)');
        expect(lifetime).toContain('language sql');
        expect(lifetime).toContain('stable');
        expect(lifetime).toContain('security invoker');
        expect(lifetime).not.toMatch(/security\s+definer/i);
        expect(lifetime).toContain('set search_path = public, pg_temp');
        for (const table of [
            'advanced_stats_scope_daily',
            'advanced_stats_scope_unit_daily',
            'advanced_stats_scope_army_daily',
            'advanced_stats_army_dictionary'
        ]) {
            expect(lifetime).toContain(`public.${table}`);
        }
        expect(lifetime).toContain('count(distinct stat_date)');
        expect(lifetime).toContain("date_trunc('month', stat_date)::date");
        expect(lifetime).not.toContain('dictionary.normalized_army_json');
        expect(lifetime).toContain("('regular'::text, 'NORMAL'::text)");
        expect(lifetime).toContain("('competitive'::text, 'WAR'::text)");
        expect(lifetime).toContain("('competitive'::text, 'RANKED'::text)");
        expect(lifetime).toContain("'minimumSample', 5");
        expect(lifetime).toContain("'sampleSize', star_known_attacks");
        expect(lifetime).toContain('where star_known_attacks >= 5');
        expect(lifetime).toContain("'minimumPerformanceSample', 5");
        expect(lifetime).toContain('raw_attack_sequence_unavailable');
        expect(lifetime).toContain("'stars', case when totals.star_known_attacks < totals.attacks");
        expect(lifetime).toContain("'code', 'star_coverage_partial'");
        expect(lifetime).toContain("'perfectAttacks', null::jsonb");
        expect(lifetime).toContain("'bestThreeStarStreak', null::jsonb");
        expect(lifetime).toContain("'currentThreeStarStreak', null::jsonb");
        expect(lifetime).toContain("'totalStars', case when totals.star_known_attacks = 0 then null::bigint else totals.total_stars end");
        expect(lifetime).toContain("'totalDestruction', null::numeric");
        expect(lifetime).not.toContain('total_destruction');
        expect(lifetime).toContain("'averageDestruction', null::numeric");
        expect(lifetime).not.toMatch(/order by total_stars::numeric \/ nullif\(star_known_attacks, 0\) desc nulls last,[\s\S]*total_destruction/);
        expect(lifetime).not.toMatch(/order by total_stars::numeric \/ nullif\(battle_count, 0\) desc nulls last,[\s\S]*total_destruction/);
        expect(lifetime).toContain('create or replace function public.read_advanced_stats_compact_trends_v1');
        expect(lifetime).toContain('create or replace function public.read_advanced_stats_compact_trends_v2');
        expect(lifetime).toContain("'sampleSize', p.sample_size");
        expect(lifetime).toContain("'averageStars', round(p.total_stars::numeric / nullif(p.sample_size, 0), 2)");
        expect(lifetime).toContain("'threeStarRate', round(100.0 * p.three_star_attacks");
        expect(lifetime).toContain("'averageDestruction', null::numeric");
        expect(lifetime).toContain('destruction_coverage_unavailable');
        expect(lifetime).not.toContain('advanced_stats_battles');
        expect(lifetime).toContain('revoke all on function public.read_advanced_stats_lifetime_v1(uuid)');
        expect(lifetime).toContain('grant execute on function public.read_advanced_stats_lifetime_v1(uuid)');
        expect(lifetime).toContain('to service_role');
    });
});

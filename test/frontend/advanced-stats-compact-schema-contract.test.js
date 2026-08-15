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
});

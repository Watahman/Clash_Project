-- Finish the ClashKing V2 cutover and remove the superseded raw battle store.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '90s';

-- Existing compact rows already contain the adapter identity in provenance.
-- Only relabel rows with explicit V2 evidence; legacy rows remain identifiable.
update public.advanced_stats_scope_state
set source_provider = 'CLASHKING_V2',
    source_id = 'clashking-v2',
    source_adapter_version = coalesce(
        nullif(source_provenance->>'adapterVersion', ''),
        source_adapter_version
    ),
    updated_at = now()
where lower(coalesce(source_provenance->>'sourceId', '')) = 'clashking-v2';

-- The tracker lifecycle remains shared by the compact collector. Closing a gap
-- no longer creates a separate history row after the raw store is retired.
create or replace function public.complete_advanced_stats_poll_v1(
    p_tracking_id uuid,
    p_worker_id text,
    p_now timestamptz,
    p_next_poll_at timestamptz,
    p_bootstrap_completed boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    tracker public.advanced_stats_tracking%rowtype;
begin
    select * into tracker
    from public.advanced_stats_tracking
    where id = p_tracking_id
      and locked_by = btrim(p_worker_id)
    for update;

    if not found then
        raise exception 'advanced stats poll lease is no longer owned';
    end if;

    update public.advanced_stats_tracking
    set status = 'ACTIVE',
        bootstrap_completed_at = case
            when p_bootstrap_completed then coalesce(bootstrap_completed_at, p_now)
            else bootstrap_completed_at
        end,
        last_successful_poll_at = p_now,
        next_poll_at = p_next_poll_at,
        consecutive_failures = 0,
        gap_started_at = null,
        gap_reason = null,
        data_complete_since = case
            when tracker.gap_started_at is not null then p_now
            else coalesce(data_complete_since, tracking_started_at)
        end,
        locked_until = null,
        locked_by = null,
        updated_at = p_now
    where id = tracker.id;

    return jsonb_build_object(
        'trackingId', tracker.id,
        'status', 'ACTIVE',
        'nextPollAt', p_next_poll_at,
        'gapClosed', tracker.gap_started_at is not null
    );
end
$$;

revoke all on function public.complete_advanced_stats_poll_v1(
    uuid, text, timestamptz, timestamptz, boolean
) from public, anon, authenticated;
grant execute on function public.complete_advanced_stats_poll_v1(
    uuid, text, timestamptz, timestamptz, boolean
) to service_role;

-- Achievement metrics now use the same compact source as every V2 read model.
create or replace function public.read_advanced_stats_achievement_metrics_v1(
    p_tracking_id uuid
) returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
with totals as (
    select
        coalesce(sum(d.attacks), 0)::bigint as attack_count,
        coalesce(sum(d.total_stars), 0)::bigint as star_count,
        coalesce(sum(d.three_star_attacks), 0)::bigint as three_star_count,
        max(d.stat_date) as latest_stat_date
    from public.advanced_stats_scope_daily d
    where d.tracking_id = p_tracking_id
)
select jsonb_build_object(
    'sourceTimestamp', case
        when totals.latest_stat_date is null then null
        else floor(extract(epoch from (
            totals.latest_stat_date::timestamp at time zone 'UTC'
        )))::bigint
    end,
    'metrics', jsonb_build_object(
        'tracked_attack_count', totals.attack_count,
        'tracked_star_count', totals.star_count,
        'tracked_three_star_count', totals.three_star_count
    )
)
from totals;
$$;

revoke all on function public.read_advanced_stats_achievement_metrics_v1(uuid)
    from public, anon, authenticated;
grant execute on function public.read_advanced_stats_achievement_metrics_v1(uuid)
    to service_role;

create or replace function public.read_advanced_stats_broad_achievement_metrics_v1(
    p_user_id uuid,
    p_player_tag text
) returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
with tracking as (
    select t.id
    from public.advanced_stats_tracking t
    where t.user_id = p_user_id
      and t.player_tag = p_player_tag
), totals as (
    select
        coalesce(sum(d.attacks), 0)::bigint as attacks,
        coalesce(sum(d.total_stars), 0)::bigint as stars,
        coalesce(sum(d.three_star_attacks), 0)::bigint as threes,
        coalesce(sum(d.two_star_attacks), 0)::bigint as twos,
        coalesce(sum(d.one_star_attacks), 0)::bigint as ones,
        coalesce(sum(d.zero_star_attacks), 0)::bigint as zeroes,
        coalesce(sum(d.gold_looted), 0)::bigint as gold,
        coalesce(sum(d.elixir_looted), 0)::bigint as elixir,
        coalesce(sum(d.dark_elixir_looted), 0)::bigint as dark_elixir,
        count(distinct d.stat_date) filter (where d.attacks > 0)::bigint as active_days
    from public.advanced_stats_scope_daily d
    join tracking t on t.id = d.tracking_id
)
select jsonb_build_object(
    'available', exists(select 1 from tracking),
    'metrics', jsonb_build_object(
        'tracked_attack_count', totals.attacks,
        'tracked_star_count', totals.stars,
        'tracked_three_star_count', totals.threes,
        'tracked_two_star_count', totals.twos,
        'tracked_one_star_count', totals.ones,
        'tracked_zero_star_count', totals.zeroes,
        'tracked_gold_looted', totals.gold,
        'tracked_elixir_looted', totals.elixir,
        'tracked_dark_elixir_looted', totals.dark_elixir,
        'tracked_active_days', totals.active_days
    )
)
from totals;
$$;

revoke all on function public.read_advanced_stats_broad_achievement_metrics_v1(uuid, text)
    from public, anon, authenticated;
grant execute on function public.read_advanced_stats_broad_achievement_metrics_v1(uuid, text)
    to service_role;

-- Remove every overload of the raw ingestion and raw read RPCs before their
-- backing tables. Compact V2 RPCs have different names and remain untouched.
do $$
declare
    legacy record;
begin
    for legacy in
        select p.oid::regprocedure as signature
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in (
              'save_advanced_stats_battle_v1',
              'save_advanced_stats_battle_v2',
              'save_advanced_stats_battle_v3',
              'save_advanced_stats_battle_v4',
              'record_advanced_stats_parser_error_v1',
              'record_advanced_stats_parser_error_v2',
              'record_advanced_stats_parser_error_v3',
              'read_advanced_stats_overview_v1',
              'read_advanced_stats_units_v1',
              'read_advanced_stats_armies_v1',
              'read_advanced_stats_battles_v1',
              'read_advanced_stats_trends_v1'
          )
    loop
        execute format('drop function %s', legacy.signature);
    end loop;
end
$$;

-- A short-lived compatibility response prevents an older frontend build from
-- failing while the deployment and migration are rolled out independently.
create function public.read_advanced_stats_battles_v1(
    p_tracking_id uuid,
    p_from timestamptz default null,
    p_limit integer default 50,
    p_cursor_time timestamptz default null,
    p_cursor_id uuid default null
) returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
select jsonb_build_object(
    'items', '[]'::jsonb,
    'hasMore', false,
    'unsupported', true,
    'reason', 'raw_attack_history_not_retained'
);
$$;

revoke all on function public.read_advanced_stats_battles_v1(
    uuid, timestamptz, integer, timestamptz, uuid
) from public, anon, authenticated;
grant execute on function public.read_advanced_stats_battles_v1(
    uuid, timestamptz, integer, timestamptz, uuid
) to service_role;

drop table if exists public.advanced_stats_battle_units;
drop table if exists public.advanced_stats_battles;
drop table if exists public.advanced_stats_unit_totals;
drop table if exists public.advanced_stats_army_totals;
drop table if exists public.advanced_stats_daily;
drop table if exists public.advanced_stats_tracking_gaps;

commit;

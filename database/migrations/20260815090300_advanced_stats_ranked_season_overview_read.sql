-- Season-aware compact overview.  The v1 read RPC remains as a dual-read
-- compatibility path; backend compact reads use this active-season contract.

create or replace function public.read_advanced_stats_compact_overview_v2(
    p_tracking_id uuid,
    p_scope text,
    p_from timestamptz default null,
    p_season_key text default null
) returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
with normalized as (
    select upper(btrim(p_scope)) as scope
), scope_state as (
    select s.*
      from public.advanced_stats_scope_state s, normalized n
     where s.tracking_id = p_tracking_id and s.scope = n.scope
), selected as (
    select n.scope,
           case when n.scope = 'RANKED'
                then public.normalize_advanced_stats_ranked_season_key_v1(
                    n.scope, case when p_season_key is null then coalesce(s.source_season_key, '')
                                  else btrim(p_season_key) end)
                else public.normalize_advanced_stats_ranked_season_key_v1(n.scope, '')
           end as season_key
      from normalized n left join scope_state s on true
), filtered_daily as (
    select d.*
      from public.advanced_stats_scope_daily d, selected x
     where d.tracking_id = p_tracking_id and d.scope = x.scope and d.season_key = x.season_key
       and (p_from is null or d.stat_date >= (p_from at time zone 'UTC')::date)
), totals as (
    select coalesce(sum(attacks), 0)::bigint as attacks,
           coalesce(sum(total_stars), 0)::bigint as total_stars,
           coalesce(sum(total_destruction), 0)::numeric as total_destruction,
           coalesce(sum(three_star_attacks), 0)::bigint as three_stars,
           coalesce(sum(gold_looted), 0)::bigint as gold_looted,
           coalesce(sum(elixir_looted), 0)::bigint as elixir_looted,
           coalesce(sum(dark_elixir_looted), 0)::bigint as dark_elixir_looted
      from filtered_daily
), unit_rank as (
    select u.unit_key, max(u.unit_name) as unit_name, u.category,
           sum(u.total_quantity)::bigint as total_quantity,
           sum(u.battles_present)::bigint as battles_present,
           case when u.category in ('TROOP', 'SUPER_TROOP') then 'FAVORITE_TROOP'
                when u.category = 'SPELL' then 'FAVORITE_SPELL'
                when u.category = 'SIEGE' then 'FAVORITE_SIEGE' else u.category end as favorite_group,
           row_number() over (
               partition by case when u.category in ('TROOP', 'SUPER_TROOP') then 'FAVORITE_TROOP'
                    when u.category = 'SPELL' then 'FAVORITE_SPELL'
                    when u.category = 'SIEGE' then 'FAVORITE_SIEGE' else u.category end
               order by sum(u.total_quantity) desc, sum(u.battles_present) desc, u.unit_key
           ) as rn
      from public.advanced_stats_scope_unit_daily u, selected x
     where u.tracking_id = p_tracking_id and u.scope = x.scope and u.season_key = x.season_key
       and (p_from is null or u.stat_date >= (p_from at time zone 'UTC')::date)
     group by u.unit_key, u.category
), army_rank as (
    select a.army_hash, (array_agg(a.normalized_army_json order by a.normalized_army_json))[1] as normalized_army_json,
           sum(a.battle_count)::bigint as battle_count, sum(a.total_stars)::bigint as total_stars,
           sum(a.total_destruction)::numeric as total_destruction
      from public.advanced_stats_scope_army_daily a, selected x
     where a.tracking_id = p_tracking_id and a.scope = x.scope and a.season_key = x.season_key
       and (p_from is null or a.stat_date >= (p_from at time zone 'UTC')::date)
     group by a.army_hash
     order by sum(a.battle_count) desc, sum(a.total_stars) desc, a.army_hash
     limit 1
), tracking as (
    select t.* from public.advanced_stats_tracking t where t.id = p_tracking_id
)
select jsonb_build_object(
    'scope', (select scope from selected),
    'seasonKey', (select season_key from selected),
    'granularity', 'UTC_DAY',
    'tracking', jsonb_build_object(
        'status', tracking.status, 'trackingStartedAt', tracking.tracking_started_at,
        'lastSuccessfulPollAt', tracking.last_successful_poll_at,
        'dataCompleteSince', tracking.data_complete_since, 'bootstrapStatus', tracking.bootstrap_status,
        'bootstrapProgress', tracking.bootstrap_progress, 'bootstrapProcessed', tracking.bootstrap_processed,
        'bootstrapTotal', tracking.bootstrap_total, 'bootstrapErrorCode', tracking.bootstrap_error_code,
        'bootstrapErrorMessage', tracking.bootstrap_error_message, 'bootstrapUpdatedAt', tracking.bootstrap_updated_at,
        'source', jsonb_build_object(
            'provider', scope_state.source_provider, 'sourceId', scope_state.source_id,
            'adapterVersion', scope_state.source_adapter_version,
            'capabilityStatus', scope_state.capability_status, 'coverageStatus', scope_state.coverage_status,
            'coverageUpdatedAt', scope_state.coverage_updated_at, 'cursor', scope_state.source_cursor,
            'watermarkAt', scope_state.source_watermark_at, 'watermarkKey', scope_state.source_watermark_key,
            'seasonKey', (select season_key from selected), 'provenance', scope_state.source_provenance,
            'lastSuccessfulPollAt', scope_state.last_successful_poll_at,
            'lastErrorAt', scope_state.last_error_at, 'lastErrorCode', scope_state.last_error_code,
            'lastErrorMessage', scope_state.last_error_message, 'updatedAt', scope_state.updated_at
        )
    ),
    'summary', jsonb_build_object(
        'attacks', totals.attacks,
        'averageStars', case when totals.attacks = 0 then 0 else round(totals.total_stars::numeric / totals.attacks, 2) end,
        'averageDestruction', case when totals.attacks = 0 then 0 else round(totals.total_destruction / totals.attacks, 2) end,
        'threeStarRate', case when totals.attacks = 0 then 0 else round(100.0 * totals.three_stars / totals.attacks, 2) end,
        'goldLooted', totals.gold_looted, 'elixirLooted', totals.elixir_looted,
        'darkElixirLooted', totals.dark_elixir_looted
    ),
    'favorites', jsonb_build_object(
        'troop', (select jsonb_build_object('key', unit_key, 'name', unit_name, 'category', category,
            'totalQuantity', total_quantity, 'battlesPresent', battles_present) from unit_rank
            where favorite_group = 'FAVORITE_TROOP' and rn = 1),
        'spell', (select jsonb_build_object('key', unit_key, 'name', unit_name, 'category', category,
            'totalQuantity', total_quantity, 'battlesPresent', battles_present) from unit_rank
            where favorite_group = 'FAVORITE_SPELL' and rn = 1),
        'siege', (select jsonb_build_object('key', unit_key, 'name', unit_name, 'category', category,
            'totalQuantity', total_quantity, 'battlesPresent', battles_present) from unit_rank
            where favorite_group = 'FAVORITE_SIEGE' and rn = 1),
        'army', (select jsonb_build_object('armyHash', army_hash, 'army', normalized_army_json,
            'battleCount', battle_count,
            'averageStars', case when battle_count = 0 then 0 else round(total_stars::numeric / battle_count, 2) end,
            'averageDestruction', case when battle_count = 0 then 0 else round(total_destruction / battle_count, 2) end)
            from army_rank)
    )
)
from tracking left join scope_state on scope_state.tracking_id = tracking.id cross join totals;
$$;

revoke all on function public.read_advanced_stats_compact_overview_v2(uuid,text,timestamptz,text)
    from public, anon, authenticated;
grant execute on function public.read_advanced_stats_compact_overview_v2(uuid,text,timestamptz,text)
    to service_role;

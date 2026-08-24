-- Advanced Stats compact read contract.
-- Daily read models intentionally expose derived data only; no raw attack
-- payload or opponent metadata is required for this source-of-truth path.

create or replace function public.read_advanced_stats_compact_overview_v1(
    p_tracking_id uuid,
    p_scope text,
    p_from timestamptz default null
) returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
with normalized as (
    select upper(btrim(p_scope)) as scope
), filtered_daily as (
    select d.*
      from public.advanced_stats_scope_daily d, normalized n
     where d.tracking_id = p_tracking_id
       and d.scope = n.scope
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
           case
               when u.category in ('TROOP', 'SUPER_TROOP') then 'FAVORITE_TROOP'
               when u.category = 'SPELL' then 'FAVORITE_SPELL'
               when u.category = 'SIEGE' then 'FAVORITE_SIEGE'
               else u.category
           end as favorite_group,
           row_number() over (
               partition by case
                   when u.category in ('TROOP', 'SUPER_TROOP') then 'FAVORITE_TROOP'
                   when u.category = 'SPELL' then 'FAVORITE_SPELL'
                   when u.category = 'SIEGE' then 'FAVORITE_SIEGE'
                   else u.category
               end
               order by sum(u.total_quantity) desc, sum(u.battles_present) desc, u.unit_key
           ) as rn
      from public.advanced_stats_scope_unit_daily u, normalized n
     where u.tracking_id = p_tracking_id
       and u.scope = n.scope
       and (p_from is null or u.stat_date >= (p_from at time zone 'UTC')::date)
     group by u.unit_key, u.category
), army_rank as (
    select a.army_hash, (array_agg(a.normalized_army_json order by a.normalized_army_json))[1] as normalized_army_json,
           sum(a.battle_count)::bigint as battle_count,
           sum(a.total_stars)::bigint as total_stars,
           sum(a.total_destruction)::numeric as total_destruction
      from public.advanced_stats_scope_army_daily a, normalized n
     where a.tracking_id = p_tracking_id
       and a.scope = n.scope
       and (p_from is null or a.stat_date >= (p_from at time zone 'UTC')::date)
     group by a.army_hash
     order by sum(a.battle_count) desc, sum(a.total_stars) desc, a.army_hash
     limit 1
), tracking as (
    select t.* from public.advanced_stats_tracking t where t.id = p_tracking_id
), state as (
    select s.* from public.advanced_stats_scope_state s, normalized n
     where s.tracking_id = p_tracking_id and s.scope = n.scope
)
select jsonb_build_object(
    'scope', (select scope from normalized),
    'granularity', 'UTC_DAY',
    'tracking', jsonb_build_object(
        'status', tracking.status,
        'trackingStartedAt', tracking.tracking_started_at,
        'lastSuccessfulPollAt', tracking.last_successful_poll_at,
        'dataCompleteSince', tracking.data_complete_since,
        'bootstrapStatus', tracking.bootstrap_status,
        'bootstrapProgress', tracking.bootstrap_progress,
        'bootstrapProcessed', tracking.bootstrap_processed,
        'bootstrapTotal', tracking.bootstrap_total,
        'bootstrapErrorCode', tracking.bootstrap_error_code,
        'bootstrapErrorMessage', tracking.bootstrap_error_message,
        'bootstrapUpdatedAt', tracking.bootstrap_updated_at,
        'source', jsonb_build_object(
            'provider', state.source_provider,
            'sourceId', state.source_id,
            'adapterVersion', state.source_adapter_version,
            'capabilityStatus', state.capability_status,
            'coverageStatus', state.coverage_status,
            'coverageUpdatedAt', state.coverage_updated_at,
            'cursor', state.source_cursor,
            'watermarkAt', state.source_watermark_at,
            'watermarkKey', state.source_watermark_key,
            'provenance', state.source_provenance,
            'lastSuccessfulPollAt', state.last_successful_poll_at,
            'lastErrorAt', state.last_error_at,
            'lastErrorCode', state.last_error_code,
            'lastErrorMessage', state.last_error_message,
            'updatedAt', state.updated_at
        )
    ),
    'summary', jsonb_build_object(
        'attacks', totals.attacks,
        'averageStars', case when totals.attacks = 0 then 0 else round(totals.total_stars::numeric / totals.attacks, 2) end,
        'averageDestruction', case when totals.attacks = 0 then 0 else round(totals.total_destruction / totals.attacks, 2) end,
        'threeStarRate', case when totals.attacks = 0 then 0 else round(100.0 * totals.three_stars / totals.attacks, 2) end,
        'goldLooted', totals.gold_looted,
        'elixirLooted', totals.elixir_looted,
        'darkElixirLooted', totals.dark_elixir_looted
    ),
    'favorites', jsonb_build_object(
        'troop', (select jsonb_build_object('key', unit_key, 'name', unit_name, 'category', category, 'totalQuantity', total_quantity, 'battlesPresent', battles_present) from unit_rank where favorite_group = 'FAVORITE_TROOP' and rn = 1),
        'spell', (select jsonb_build_object('key', unit_key, 'name', unit_name, 'category', category, 'totalQuantity', total_quantity, 'battlesPresent', battles_present) from unit_rank where favorite_group = 'FAVORITE_SPELL' and rn = 1),
        'siege', (select jsonb_build_object('key', unit_key, 'name', unit_name, 'category', category, 'totalQuantity', total_quantity, 'battlesPresent', battles_present) from unit_rank where favorite_group = 'FAVORITE_SIEGE' and rn = 1),
        'army', (select jsonb_build_object(
            'armyHash', army_hash,
            'army', normalized_army_json,
            'battleCount', battle_count,
            'averageStars', case when battle_count = 0 then 0 else round(total_stars::numeric / battle_count, 2) end,
            'averageDestruction', case when battle_count = 0 then 0 else round(total_destruction / battle_count, 2) end
        ) from army_rank)
    )
)
from tracking left join state on state.tracking_id = tracking.id cross join totals;
$$;

create or replace function public.read_advanced_stats_compact_units_v1(
    p_tracking_id uuid,
    p_scope text,
    p_from timestamptz default null,
    p_category text default null
) returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
with normalized as (select upper(btrim(p_scope)) as scope), total_battles as (
    select coalesce(sum(d.attacks), 0)::numeric as value
      from public.advanced_stats_scope_daily d, normalized n
     where d.tracking_id = p_tracking_id and d.scope = n.scope
       and (p_from is null or d.stat_date >= (p_from at time zone 'UTC')::date)
), grouped as (
    select u.unit_key, max(u.unit_name) as unit_name, u.category,
           sum(u.total_quantity)::bigint as total_quantity,
           sum(u.battles_present)::bigint as battles_present,
           min(u.stat_date) as first_seen_at, max(u.stat_date) as last_seen_at
      from public.advanced_stats_scope_unit_daily u, normalized n
     where u.tracking_id = p_tracking_id and u.scope = n.scope
       and (p_from is null or u.stat_date >= (p_from at time zone 'UTC')::date)
       and (p_category is null or upper(p_category) = 'ALL' or u.category = upper(p_category))
     group by u.unit_key, u.category
)
select coalesce(jsonb_agg(jsonb_build_object(
    'key', g.unit_key, 'name', g.unit_name, 'category', g.category,
    'totalQuantity', g.total_quantity, 'battlesPresent', g.battles_present,
    'usageRate', case when tb.value = 0 then 0 else round(100.0 * g.battles_present / tb.value, 2) end,
    'firstSeenAt', g.first_seen_at, 'lastSeenAt', g.last_seen_at
) order by g.total_quantity desc, g.battles_present desc, g.unit_key), '[]'::jsonb)
from grouped g cross join total_battles tb;
$$;

create or replace function public.read_advanced_stats_compact_armies_v1(
    p_tracking_id uuid,
    p_scope text,
    p_from timestamptz default null,
    p_limit integer default 20
) returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
with normalized as (select upper(btrim(p_scope)) as scope), grouped as (
    select a.army_hash, (array_agg(a.normalized_army_json order by a.normalized_army_json))[1] as normalized_army_json,
           sum(a.battle_count)::bigint as battle_count,
           sum(a.total_stars)::bigint as total_stars,
           sum(a.total_destruction)::numeric as total_destruction,
           min(a.stat_date) as first_seen_at, max(a.stat_date) as last_seen_at
      from public.advanced_stats_scope_army_daily a, normalized n
     where a.tracking_id = p_tracking_id and a.scope = n.scope
       and (p_from is null or a.stat_date >= (p_from at time zone 'UTC')::date)
     group by a.army_hash
     order by sum(a.battle_count) desc, sum(a.total_stars) desc, a.army_hash
     limit greatest(1, least(coalesce(p_limit, 20), 100))
)
select coalesce(jsonb_agg(jsonb_build_object(
    'armyHash', army_hash, 'army', normalized_army_json, 'battleCount', battle_count,
    'averageStars', case when battle_count = 0 then 0 else round(total_stars::numeric / battle_count, 2) end,
    'averageDestruction', case when battle_count = 0 then 0 else round(total_destruction / battle_count, 2) end,
    'firstSeenAt', first_seen_at, 'lastSeenAt', last_seen_at
) order by battle_count desc, total_stars desc, army_hash), '[]'::jsonb)
from grouped;
$$;

create or replace function public.read_advanced_stats_compact_trends_v1(
    p_tracking_id uuid,
    p_scope text,
    p_from timestamptz default null
) returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
select coalesce(jsonb_agg(jsonb_build_object(
    'date', d.stat_date,
    'attacks', d.attacks,
    'averageStars', case when d.attacks = 0 then 0 else round(d.total_stars::numeric / d.attacks, 2) end,
    'averageDestruction', case when d.attacks = 0 then 0 else round(d.total_destruction / d.attacks, 2) end,
    'threeStarRate', case when d.attacks = 0 then 0 else round(100.0 * d.three_star_attacks / d.attacks, 2) end,
    'goldLooted', d.gold_looted, 'elixirLooted', d.elixir_looted, 'darkElixirLooted', d.dark_elixir_looted
) order by d.stat_date), '[]'::jsonb)
from public.advanced_stats_scope_daily d
where d.tracking_id = p_tracking_id
  and d.scope = upper(btrim(p_scope))
  and (p_from is null or d.stat_date >= (p_from at time zone 'UTC')::date);
$$;

revoke all on function public.read_advanced_stats_compact_overview_v1(uuid,text,timestamptz)
    from public, anon, authenticated;
revoke all on function public.read_advanced_stats_compact_units_v1(uuid,text,timestamptz,text)
    from public, anon, authenticated;
revoke all on function public.read_advanced_stats_compact_armies_v1(uuid,text,timestamptz,integer)
    from public, anon, authenticated;
revoke all on function public.read_advanced_stats_compact_trends_v1(uuid,text,timestamptz)
    from public, anon, authenticated;

grant execute on function public.read_advanced_stats_compact_overview_v1(uuid,text,timestamptz) to service_role;
grant execute on function public.read_advanced_stats_compact_units_v1(uuid,text,timestamptz,text) to service_role;
grant execute on function public.read_advanced_stats_compact_armies_v1(uuid,text,timestamptz,integer) to service_role;
grant execute on function public.read_advanced_stats_compact_trends_v1(uuid,text,timestamptz) to service_role;

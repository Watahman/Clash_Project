-- Season-aware unit aggregates.

create or replace function public.read_advanced_stats_compact_units_v2(
    p_tracking_id uuid,
    p_scope text,
    p_from timestamptz default null,
    p_category text default null,
    p_season_key text default null
) returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
with normalized as (select upper(btrim(p_scope)) as scope), scope_state as (
    select s.* from public.advanced_stats_scope_state s, normalized n
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
), total_battles as (
    select coalesce(sum(d.attacks), 0)::numeric as value
      from public.advanced_stats_scope_daily d, selected x
     where d.tracking_id = p_tracking_id and d.scope = x.scope and d.season_key = x.season_key
       and (p_from is null or d.stat_date >= (p_from at time zone 'UTC')::date)
), grouped as (
    select u.unit_key, max(u.unit_name) as unit_name, u.category,
           sum(u.total_quantity)::bigint as total_quantity,
           sum(u.battles_present)::bigint as battles_present,
           min(u.stat_date) as first_seen_at, max(u.stat_date) as last_seen_at
      from public.advanced_stats_scope_unit_daily u, selected x
     where u.tracking_id = p_tracking_id and u.scope = x.scope and u.season_key = x.season_key
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

revoke all on function public.read_advanced_stats_compact_units_v2(uuid,text,timestamptz,text,text)
    from public, anon, authenticated;
grant execute on function public.read_advanced_stats_compact_units_v2(uuid,text,timestamptz,text,text)
    to service_role;

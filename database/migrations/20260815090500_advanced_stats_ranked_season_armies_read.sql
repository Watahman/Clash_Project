-- Season-aware favorite-army aggregates.

create or replace function public.read_advanced_stats_compact_armies_v2(
    p_tracking_id uuid,
    p_scope text,
    p_from timestamptz default null,
    p_limit integer default 20,
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
), grouped as (
    select a.army_hash, (array_agg(a.normalized_army_json order by a.normalized_army_json))[1] as normalized_army_json,
           sum(a.battle_count)::bigint as battle_count, sum(a.total_stars)::bigint as total_stars,
           sum(a.total_destruction)::numeric as total_destruction,
           min(a.stat_date) as first_seen_at, max(a.stat_date) as last_seen_at
      from public.advanced_stats_scope_army_daily a, selected x
     where a.tracking_id = p_tracking_id and a.scope = x.scope and a.season_key = x.season_key
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

revoke all on function public.read_advanced_stats_compact_armies_v2(uuid,text,timestamptz,integer,text)
    from public, anon, authenticated;
grant execute on function public.read_advanced_stats_compact_armies_v2(uuid,text,timestamptz,integer,text)
    to service_role;

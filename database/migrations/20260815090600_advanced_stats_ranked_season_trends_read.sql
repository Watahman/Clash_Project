-- Season-aware daily trend aggregates.

create or replace function public.read_advanced_stats_compact_trends_v2(
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
)
select coalesce(jsonb_agg(jsonb_build_object(
    'date', d.stat_date,
    'attacks', d.attacks,
    'averageStars', case when d.attacks = 0 then 0 else round(d.total_stars::numeric / d.attacks, 2) end,
    'averageDestruction', case when d.attacks = 0 then 0 else round(d.total_destruction / d.attacks, 2) end,
    'threeStarRate', case when d.attacks = 0 then 0 else round(100.0 * d.three_star_attacks / d.attacks, 2) end,
    'goldLooted', d.gold_looted, 'elixirLooted', d.elixir_looted, 'darkElixirLooted', d.dark_elixir_looted
) order by d.stat_date), '[]'::jsonb)
from public.advanced_stats_scope_daily d, selected x
where d.tracking_id = p_tracking_id and d.scope = x.scope and d.season_key = x.season_key
  and (p_from is null or d.stat_date >= (p_from at time zone 'UTC')::date);
$$;

revoke all on function public.read_advanced_stats_compact_trends_v2(uuid,text,timestamptz,text)
    from public, anon, authenticated;
grant execute on function public.read_advanced_stats_compact_trends_v2(uuid,text,timestamptz,text)
    to service_role;

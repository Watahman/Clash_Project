-- Keep trend buckets aligned with the exact read-period boundary.
-- The first/last UTC day may therefore represent a partial day, but no attacks
-- from outside the requested 7d/30d/90d window are included.

create or replace function public.read_advanced_stats_trends_v1(
    p_tracking_id uuid,
    p_from timestamptz default null
) returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
with filtered as (
    select (coalesce(b.battle_timestamp, b.observed_at) at time zone 'UTC')::date as stat_date,
           b.stars,
           b.destruction_percentage,
           b.loot_gold,
           b.loot_elixir,
           b.loot_dark_elixir
      from public.advanced_stats_battles b
     where b.tracking_id = p_tracking_id
       and b.is_attack = true
       and b.processing_status = 'PROCESSED'
       and (p_from is null or coalesce(b.battle_timestamp, b.observed_at) >= p_from)
), grouped as (
    select stat_date,
           count(*)::bigint as attacks,
           coalesce(sum(stars), 0)::bigint as total_stars,
           coalesce(sum(destruction_percentage), 0)::numeric as total_destruction,
           count(*) filter (where stars = 3)::bigint as three_star_attacks,
           coalesce(sum(loot_gold), 0)::bigint as gold_looted,
           coalesce(sum(loot_elixir), 0)::bigint as elixir_looted,
           coalesce(sum(loot_dark_elixir), 0)::bigint as dark_elixir_looted
      from filtered
     group by stat_date
)
select coalesce(jsonb_agg(
    jsonb_build_object(
        'date', g.stat_date,
        'attacks', g.attacks,
        'averageStars', case when g.attacks = 0 then 0 else round(g.total_stars::numeric / g.attacks, 2) end,
        'averageDestruction', case when g.attacks = 0 then 0 else round(g.total_destruction / g.attacks, 2) end,
        'threeStarRate', case when g.attacks = 0 then 0 else round(100.0 * g.three_star_attacks / g.attacks, 2) end,
        'goldLooted', g.gold_looted,
        'elixirLooted', g.elixir_looted,
        'darkElixirLooted', g.dark_elixir_looted
    ) order by g.stat_date
), '[]'::jsonb)
from grouped g;
$$;

revoke all on function public.read_advanced_stats_trends_v1(uuid, timestamptz)
    from public, anon, authenticated;
grant execute on function public.read_advanced_stats_trends_v1(uuid, timestamptz)
    to service_role;

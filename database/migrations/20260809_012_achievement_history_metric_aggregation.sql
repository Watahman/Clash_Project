-- Aggregate compact achievement history records according to the semantics of
-- each metric. Counters add across records; per-record peaks use MAX; ranking
-- progress uses the lowest positive observed rank.
create or replace function public.read_achievement_source_metrics_v1(
    p_user_id uuid,
    p_player_tag text
) returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
with expanded as (
    select
        case e.key
            when 'war_recorded_wars' then 'war_current_participation'
            when 'war_recorded_attacks' then 'war_current_attacks'
            when 'war_recorded_stars' then 'war_current_stars'
            when 'war_recorded_destruction' then 'war_current_destruction'
            when 'war_recorded_three_stars' then 'war_current_three_stars'
            when 'war_recorded_two_stars' then 'war_current_two_stars'
            when 'war_recorded_uphit_three_stars' then 'war_current_uphit_three_stars'
            else e.key
        end as metric,
        (e.value #>> '{}')::numeric as value
    from public.achievement_source_records r
    cross join lateral jsonb_each(r.metrics) e
    where r.user_id = p_user_id
      and r.player_tag = p_player_tag
      and jsonb_typeof(e.value) = 'number'
), metric_rows as (
    select
        metric,
        case
            when metric like 'war_current_%'
              or metric in (
                  'raid_weekend_loot',
                  'legend_best_season_trophies'
              )
                then max(value)::bigint
            when metric in (
                'legend_best_season_rank',
                'ranking_best_global_rank'
            )
                then (min(value) filter (where value > 0))::bigint
            else sum(value)::bigint
        end as value
    from expanded
    group by metric
)
select coalesce(
    jsonb_object_agg(metric, value) filter (where value is not null),
    '{}'::jsonb
)
from metric_rows;
$$;

revoke all on function public.read_achievement_source_metrics_v1(uuid, text)
    from public, anon, authenticated;
grant execute on function public.read_achievement_source_metrics_v1(uuid, text)
    to service_role;

-- Regular-war card metrics describe the best value achieved in one observed war,
-- while CWL/history counters are cumulative across records.
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
    select e.key as metric, (e.value #>> '{}')::numeric as value
    from public.achievement_source_records r
    cross join lateral jsonb_each(r.metrics) e
    where r.user_id = p_user_id
      and r.player_tag = p_player_tag
      and jsonb_typeof(e.value) = 'number'
), metric_rows as (
    select
        metric,
        case
            when metric like 'war_current_%' then max(value)::bigint
            else sum(value)::bigint
        end as value
    from expanded
    group by metric
)
select coalesce(jsonb_object_agg(metric, value), '{}'::jsonb)
from metric_rows;
$$;

revoke all on function public.read_achievement_source_metrics_v1(uuid, text)
    from public, anon, authenticated;
grant execute on function public.read_achievement_source_metrics_v1(uuid, text)
    to service_role;

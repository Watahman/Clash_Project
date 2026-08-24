-- Phase 7: connect Advanced Stats to Advanced Achievements without a second battle-log collector.
-- All functions remain backend/service-role only. Java resolves ownership before Stats tracking is created.

create or replace function public.read_advanced_stats_achievement_metrics_v1(
    p_tracking_id uuid
) returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
with filtered as (
    select
        b.stars,
        coalesce(b.battle_timestamp, b.observed_at) as effective_at
    from public.advanced_stats_battles b
    where b.tracking_id = p_tracking_id
      and b.is_attack = true
      and b.processing_status = 'PROCESSED'
), totals as (
    select
        count(*)::bigint as tracked_attack_count,
        coalesce(sum(stars), 0)::bigint as tracked_star_count,
        count(*) filter (where stars = 3)::bigint as tracked_three_star_count,
        max(effective_at) as latest_battle_at
    from filtered
)
select jsonb_build_object(
    'sourceTimestamp', case
        when totals.latest_battle_at is null then null
        else floor(extract(epoch from totals.latest_battle_at))::bigint
    end,
    'metrics', jsonb_build_object(
        'tracked_attack_count', totals.tracked_attack_count,
        'tracked_star_count', totals.tracked_star_count,
        'tracked_three_star_count', totals.tracked_three_star_count
    )
)
from totals;
$$;

revoke all on function public.read_advanced_stats_achievement_metrics_v1(uuid)
    from public, anon, authenticated;
grant execute on function public.read_advanced_stats_achievement_metrics_v1(uuid)
    to service_role;

create or replace function public.reconcile_advanced_stats_achievement_progress_v1(
    p_user_id uuid,
    p_player_tag text,
    p_source_timestamp bigint,
    p_progress jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_item jsonb;
    v_metric text;
    v_was_unlocked boolean;
    v_new_unlocks integer := 0;
    v_rows integer := 0;
begin
    if p_user_id is null or p_player_tag is null or p_source_timestamp is null then
        raise exception 'Missing required Advanced Stats achievement data';
    end if;
    if p_source_timestamp <= 0 then
        raise exception 'Invalid Advanced Stats achievement source timestamp';
    end if;

    for v_item in
        select value from jsonb_array_elements(coalesce(p_progress, '[]'::jsonb))
    loop
        v_metric := v_item->>'metric';
        if v_metric not in (
            'tracked_attack_count',
            'tracked_star_count',
            'tracked_three_star_count'
        ) then
            raise exception 'Unsupported Advanced Stats achievement metric: %', coalesce(v_metric, '<null>');
        end if;

        select unlocked
          into v_was_unlocked
          from public.achievement_progress
         where user_id = p_user_id
           and player_tag = p_player_tag
           and achievement_key = v_item->>'achievement_key'
           and tier = (v_item->>'tier')::smallint;

        if coalesce(v_was_unlocked, false) = false
           and coalesce((v_item->>'unlocked')::boolean, false) = true then
            v_new_unlocks := v_new_unlocks + 1;
        end if;

        insert into public.achievement_progress (
            user_id, player_tag, achievement_key, family_key, title, description,
            category, rarity, tier, xp, metric, progress, target, unlocked,
            unlocked_at, source_timestamp, updated_at
        ) values (
            p_user_id,
            p_player_tag,
            v_item->>'achievement_key',
            v_item->>'family_key',
            v_item->>'title',
            v_item->>'description',
            v_item->>'category',
            v_item->>'rarity',
            (v_item->>'tier')::smallint,
            (v_item->>'xp')::integer,
            v_metric,
            greatest((v_item->>'progress')::bigint, 0),
            (v_item->>'target')::bigint,
            coalesce((v_item->>'unlocked')::boolean, false),
            case
                when coalesce((v_item->>'unlocked')::boolean, false) then now()
                else null
            end,
            p_source_timestamp,
            now()
        )
        on conflict (user_id, player_tag, achievement_key, tier) do update
            set family_key = excluded.family_key,
                title = excluded.title,
                description = excluded.description,
                category = excluded.category,
                rarity = excluded.rarity,
                xp = excluded.xp,
                metric = excluded.metric,
                progress = greatest(public.achievement_progress.progress, excluded.progress),
                target = excluded.target,
                unlocked = public.achievement_progress.unlocked or excluded.unlocked,
                unlocked_at = case
                    when public.achievement_progress.unlocked_at is not null
                        then public.achievement_progress.unlocked_at
                    when excluded.unlocked
                        then now()
                    else null
                end,
                source_timestamp = greatest(public.achievement_progress.source_timestamp, excluded.source_timestamp),
                updated_at = now();

        v_rows := v_rows + 1;
    end loop;

    return jsonb_build_object(
        'rows', v_rows,
        'newUnlocks', v_new_unlocks,
        'savedAt', now()
    );
end;
$$;

revoke all on function public.reconcile_advanced_stats_achievement_progress_v1(uuid, text, bigint, jsonb)
    from public, anon, authenticated;
grant execute on function public.reconcile_advanced_stats_achievement_progress_v1(uuid, text, bigint, jsonb)
    to service_role;

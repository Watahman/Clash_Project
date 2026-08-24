-- Keep destructive Advanced Stats deletion semantically complete.
-- The three metrics below are sourced exclusively from persisted Advanced Stats battles.
-- Deleting tracking therefore removes both the tracking/history row (whose children cascade)
-- and the derived Advanced Achievement progress so a later restart begins from zero.

create or replace function public.delete_advanced_stats_tracking_v1(
    p_user_id uuid,
    p_player_tag text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_tracking_id uuid;
    v_achievement_rows integer := 0;
begin
    if p_user_id is null or p_player_tag is null or btrim(p_player_tag) = '' then
        raise exception 'Missing required Advanced Stats delete identity';
    end if;

    delete from public.achievement_progress
     where user_id = p_user_id
       and player_tag = p_player_tag
       and metric in (
           'tracked_attack_count',
           'tracked_star_count',
           'tracked_three_star_count'
       );
    get diagnostics v_achievement_rows = row_count;

    delete from public.advanced_stats_tracking
     where user_id = p_user_id
       and player_tag = p_player_tag
    returning id into v_tracking_id;

    return jsonb_build_object(
        'deleted', v_tracking_id is not null,
        'trackingId', v_tracking_id,
        'achievementRowsDeleted', v_achievement_rows
    );
end;
$$;

revoke all on function public.delete_advanced_stats_tracking_v1(uuid, text)
    from public, anon, authenticated;
grant execute on function public.delete_advanced_stats_tracking_v1(uuid, text)
    to service_role;

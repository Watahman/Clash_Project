-- Explicit ranked-season rotation.  Previous season aggregates stay intact;
-- only the active ranked cursor and bootstrap window are reset.

create or replace function public.switch_advanced_stats_ranked_season_v1(
    p_tracking_id uuid,
    p_player_tag text,
    p_worker_id text,
    p_expected_season_key text,
    p_new_season_key text,
    p_now timestamptz
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    v_expected text := public.normalize_advanced_stats_ranked_season_key_v1('RANKED', p_expected_season_key);
    v_new text := public.normalize_advanced_stats_ranked_season_key_v1('RANKED', p_new_season_key);
    v_state public.advanced_stats_scope_state%rowtype;
    v_changed boolean := false;
begin
    if p_tracking_id is null or btrim(coalesce(p_player_tag, '')) = ''
       or btrim(coalesce(p_worker_id, '')) = '' or p_now is null then
        raise exception 'Advanced Stats ranked-season identity is required';
    end if;
    if v_new = '' then
        raise exception 'A new ranked season key is required';
    end if;

    perform 1
      from public.advanced_stats_tracking tracking
     where tracking.id = p_tracking_id
       and tracking.player_tag = p_player_tag
       and tracking.status in ('INITIALIZING', 'ACTIVE', 'DEGRADED')
       and tracking.locked_by = btrim(p_worker_id)
       and tracking.locked_until > p_now
     for update;
    if not found then
        raise exception 'Advanced Stats poll lease is no longer active';
    end if;

    insert into public.advanced_stats_scope_state (tracking_id, scope)
    values (p_tracking_id, 'RANKED')
    on conflict (tracking_id, scope) do nothing;

    select state.*
      into v_state
      from public.advanced_stats_scope_state state
     where state.tracking_id = p_tracking_id
       and state.scope = 'RANKED'
     for update;

    if coalesce(v_state.source_season_key, '') <> v_expected then
        raise exception 'Advanced Stats ranked season changed; retry with latest season key';
    end if;
    if v_expected = v_new then
        return jsonb_build_object(
            'trackingId', p_tracking_id,
            'scope', 'RANKED',
            'seasonKey', v_new,
            'changed', false,
            'updatedAt', p_now
        );
    end if;

    update public.advanced_stats_scope_state
       set source_season_key = v_new,
           source_cursor = null,
           source_watermark_at = null,
           source_watermark_key = null,
           source_provenance = jsonb_build_object(
               'rankedSeasonKey', v_new,
               'seasonRotationAt', p_now,
               'previousRankedSeasonKey', nullif(v_expected, '')
           ),
           capability_status = 'PARTIAL',
           coverage_status = 'PARTIAL',
           coverage_updated_at = p_now,
           last_error_at = null,
           last_error_code = null,
           last_error_message = null,
           bootstrap_status = 'PENDING',
           bootstrap_progress = 0,
           bootstrap_processed = 0,
           bootstrap_total = null,
           bootstrap_error_code = null,
           bootstrap_error_message = null,
           bootstrap_started_at = null,
           bootstrap_completed_at = null,
           updated_at = p_now
     where tracking_id = p_tracking_id and scope = 'RANKED';
    v_changed := true;

    update public.advanced_stats_tracking
       set bootstrap_status = 'PENDING',
           bootstrap_progress = 0,
           bootstrap_total = null,
           bootstrap_error_code = null,
           bootstrap_error_message = null,
           bootstrap_started_at = null,
           bootstrap_completed_at = null,
           bootstrap_updated_at = p_now,
           updated_at = p_now
     where id = p_tracking_id;

    return jsonb_build_object(
        'trackingId', p_tracking_id,
        'scope', 'RANKED',
        'seasonKey', v_new,
        'changed', v_changed,
        'updatedAt', p_now
    );
end;
$$;

revoke all on function public.switch_advanced_stats_ranked_season_v1(
    uuid,text,text,text,text,timestamptz
) from public, anon, authenticated;
grant execute on function public.switch_advanced_stats_ranked_season_v1(
    uuid,text,text,text,text,timestamptz
) to service_role;

-- Allow the authenticated start action to turn a failed historical bootstrap into
-- an immediately due retry without deleting already collected compact statistics.

create or replace function public.retry_advanced_stats_tracking_v1(
    p_user_id uuid,
    p_player_tag text,
    p_now timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_tracker public.advanced_stats_tracking%rowtype;
    v_retried boolean := false;
begin
    if p_user_id is null or btrim(coalesce(p_player_tag, '')) = '' or p_now is null then
        raise exception 'Advanced Stats retry identity is required';
    end if;

    select * into v_tracker
      from public.advanced_stats_tracking
     where user_id = p_user_id
       and player_tag = btrim(p_player_tag)
     for update;

    if not found then
        return jsonb_build_object('retried', false, 'reason', 'NOT_FOUND');
    end if;

    if coalesce(v_tracker.bootstrap_status, 'PENDING') <> 'FAILED'
       or v_tracker.status not in ('INITIALIZING', 'ACTIVE', 'DEGRADED') then
        return jsonb_build_object(
            'retried', false,
            'trackingId', v_tracker.id,
            'status', v_tracker.status,
            'bootstrapStatus', v_tracker.bootstrap_status
        );
    end if;

    update public.advanced_stats_scope_state
       set bootstrap_status = 'PENDING',
           bootstrap_progress = 0,
           bootstrap_total = null,
           bootstrap_error_code = null,
           bootstrap_error_message = null,
           bootstrap_completed_at = null,
           last_error_at = null,
           last_error_code = null,
           last_error_message = null,
           updated_at = p_now
     where tracking_id = v_tracker.id
       and bootstrap_status = 'FAILED';

    update public.advanced_stats_tracking
       set status = 'INITIALIZING',
           bootstrap_status = 'PENDING',
           bootstrap_progress = 0,
           bootstrap_processed = coalesce((
               select sum(scope.bootstrap_processed)
                 from public.advanced_stats_scope_state scope
                where scope.tracking_id = v_tracker.id
           ), 0),
           bootstrap_total = null,
           bootstrap_error_code = null,
           bootstrap_error_message = null,
           bootstrap_completed_at = null,
           bootstrap_updated_at = p_now,
           next_poll_at = p_now,
           consecutive_failures = 0,
           locked_until = null,
           locked_by = null,
           updated_at = p_now
     where id = v_tracker.id;

    v_retried := true;
    return jsonb_build_object(
        'retried', v_retried,
        'trackingId', v_tracker.id,
        'status', 'INITIALIZING',
        'bootstrapStatus', 'PENDING',
        'nextPollAt', p_now
    );
end;
$$;

revoke all on function public.retry_advanced_stats_tracking_v1(uuid, text, timestamptz) from public;
revoke all on function public.retry_advanced_stats_tracking_v1(uuid, text, timestamptz) from anon;
revoke all on function public.retry_advanced_stats_tracking_v1(uuid, text, timestamptz) from authenticated;
grant execute on function public.retry_advanced_stats_tracking_v1(uuid, text, timestamptz) to service_role;

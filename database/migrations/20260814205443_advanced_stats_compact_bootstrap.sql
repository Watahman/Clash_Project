-- Advanced Stats compact bootstrap progress contract.
-- This is an invoker function; service_role grants are explicit below.

create or replace function public.update_advanced_stats_bootstrap_v1(
    p_tracking_id uuid,
    p_player_tag text,
    p_scope text,
    p_worker_id text,
    p_status text,
    p_progress smallint,
    p_processed bigint,
    p_total bigint,
    p_error_code text,
    p_error_message text,
    p_now timestamptz
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    v_scope text := upper(btrim(p_scope));
    v_status text := upper(btrim(p_status));
    v_overall_status text;
    v_overall_progress smallint;
    v_overall_processed bigint;
    v_overall_total bigint;
    v_overall_error_code text;
    v_overall_error_message text;
begin
    if v_scope not in ('NORMAL', 'WAR', 'RANKED') then
        raise exception 'Unsupported Advanced Stats scope: %', p_scope;
    end if;
    if v_status not in ('NOT_STARTED', 'PENDING', 'RUNNING', 'COMPLETE', 'PARTIAL', 'FAILED', 'UNSUPPORTED') then
        raise exception 'Unsupported Advanced Stats bootstrap status: %', p_status;
    end if;
    if p_progress is null or p_progress not between 0 and 100 then
        raise exception 'Advanced Stats bootstrap progress must be between 0 and 100';
    end if;
    if p_processed is null or p_processed < 0
       or (p_total is not null and (p_total < 0 or p_processed > p_total)) then
        raise exception 'Invalid Advanced Stats bootstrap counts';
    end if;
    if p_now is null or btrim(coalesce(p_worker_id, '')) = '' then
        raise exception 'Advanced Stats bootstrap identity is required';
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
    values (p_tracking_id, v_scope)
    on conflict (tracking_id, scope) do nothing;

    update public.advanced_stats_scope_state state
       set bootstrap_status = v_status,
           bootstrap_progress = p_progress,
           bootstrap_processed = p_processed,
           bootstrap_total = p_total,
           bootstrap_error_code = case when v_status in ('FAILED', 'PARTIAL') then nullif(left(p_error_code, 128), '') else null end,
           bootstrap_error_message = case when v_status in ('FAILED', 'PARTIAL') then nullif(left(p_error_message, 2048), '') else null end,
           bootstrap_started_at = case
               when v_status = 'RUNNING' then coalesce(state.bootstrap_started_at, p_now)
               else state.bootstrap_started_at
           end,
           bootstrap_completed_at = case
               when v_status = 'COMPLETE' then coalesce(state.bootstrap_completed_at, p_now)
               when v_status in ('FAILED', 'PARTIAL') then null
               else state.bootstrap_completed_at
           end,
           updated_at = p_now
     where state.tracking_id = p_tracking_id and state.scope = v_scope;

    with aggregate as (
        select tracking_id,
                case
                    when bool_or(bootstrap_status = 'FAILED') then 'FAILED'
                    when bool_or(bootstrap_status = 'RUNNING') then 'RUNNING'
                    when bool_or(bootstrap_status in ('PENDING', 'NOT_STARTED')) then 'PENDING'
                    when bool_and(bootstrap_status = 'COMPLETE') then 'COMPLETE'
                    when bool_and(bootstrap_status = 'UNSUPPORTED') then 'UNSUPPORTED'
                    when bool_and(bootstrap_status in ('COMPLETE', 'UNSUPPORTED')) then 'PARTIAL'
                    when bool_or(bootstrap_status = 'PARTIAL') then 'PARTIAL'
                    else 'PENDING'
                end as overall_status,
               round(avg(bootstrap_progress))::smallint as overall_progress,
               sum(bootstrap_processed)::bigint as overall_processed,
               case when bool_and(bootstrap_total is not null)
                    then sum(bootstrap_total)::bigint else null end as overall_total,
               max(bootstrap_error_code) as error_code,
               max(bootstrap_error_message) as error_message
          from public.advanced_stats_scope_state
         where tracking_id = p_tracking_id
         group by tracking_id
    )
    select overall_status, overall_progress, overall_processed, overall_total,
           error_code, error_message
      into v_overall_status, v_overall_progress, v_overall_processed, v_overall_total,
           v_overall_error_code, v_overall_error_message
      from aggregate;

    update public.advanced_stats_tracking tracking
       set bootstrap_status = v_overall_status,
           bootstrap_progress = v_overall_progress,
           bootstrap_processed = v_overall_processed,
           bootstrap_total = v_overall_total,
           bootstrap_error_code = case when v_overall_status in ('FAILED', 'PARTIAL') then v_overall_error_code else null end,
           bootstrap_error_message = case when v_overall_status in ('FAILED', 'PARTIAL') then v_overall_error_message else null end,
           bootstrap_started_at = case
               when v_overall_status in ('RUNNING', 'COMPLETE', 'PARTIAL', 'FAILED')
                   then coalesce(tracking.bootstrap_started_at, p_now)
               else tracking.bootstrap_started_at
           end,
           bootstrap_completed_at = case
               when v_overall_status = 'COMPLETE' then coalesce(tracking.bootstrap_completed_at, p_now)
               else tracking.bootstrap_completed_at
           end,
           bootstrap_updated_at = p_now,
           updated_at = p_now
     where tracking.id = p_tracking_id;

    return jsonb_build_object(
        'trackingId', p_tracking_id,
        'scope', v_scope,
        'status', v_status,
        'progress', p_progress,
        'processed', p_processed,
        'total', p_total,
        'overallStatus', v_overall_status,
        'overallProgress', v_overall_progress,
        'updatedAt', p_now
    );
end;
$$;

create or replace function public.update_advanced_stats_scope_poll_v1(
    p_tracking_id uuid,
    p_player_tag text,
    p_scope text,
    p_worker_id text,
    p_now timestamptz,
    p_success boolean,
    p_expected_cursor text,
    p_expected_watermark_at timestamptz,
    p_expected_watermark_key text,
    p_source_cursor text,
    p_source_watermark_at timestamptz,
    p_source_watermark_key text,
    p_source_provenance jsonb,
    p_error_code text,
    p_error_message text
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    v_scope text := upper(btrim(p_scope));
    v_provenance jsonb := coalesce(p_source_provenance, '{}'::jsonb);
    v_incoming_watermark_key text;
    v_state public.advanced_stats_scope_state%rowtype;
    v_accept_source_checkpoint boolean := false;
begin
    if v_scope not in ('NORMAL', 'WAR', 'RANKED') then
        raise exception 'Unsupported Advanced Stats scope: %', p_scope;
    end if;
    if p_now is null or btrim(coalesce(p_worker_id, '')) = '' then
        raise exception 'Advanced Stats poll state identity is required';
    end if;
    if jsonb_typeof(v_provenance) <> 'object' then
        raise exception 'Advanced Stats source provenance must be a JSON object';
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
    values (p_tracking_id, v_scope)
    on conflict (tracking_id, scope) do nothing;

    select state.*
      into v_state
      from public.advanced_stats_scope_state state
     where state.tracking_id = p_tracking_id
       and state.scope = v_scope
     for update;

    if coalesce(p_expected_cursor, '') <> coalesce(v_state.source_cursor, '')
       or p_expected_watermark_at is distinct from v_state.source_watermark_at
       or coalesce(p_expected_watermark_key, '') <> coalesce(v_state.source_watermark_key, '') then
        raise exception 'Advanced Stats source checkpoint changed; retry with latest cursor';
    end if;

    v_incoming_watermark_key := coalesce(p_source_watermark_key, p_source_cursor, '');
    v_accept_source_checkpoint := coalesce(p_success, false)
        and (
            p_source_cursor is not null
            or p_source_watermark_at is not null
            or p_source_watermark_key is not null
        )
        and (
            v_state.source_watermark_at is null
            or (
                p_source_watermark_at is not null
                and (
                    p_source_watermark_at > v_state.source_watermark_at
                    or (
                        p_source_watermark_at = v_state.source_watermark_at
                        and v_incoming_watermark_key >= coalesce(v_state.source_watermark_key, '')
                    )
                )
            )
        );

    update public.advanced_stats_scope_state state
       set last_attempted_poll_at = p_now,
           last_successful_poll_at = case when p_success then p_now else state.last_successful_poll_at end,
           last_error_at = case when p_success then null else p_now end,
           last_error_code = case when p_success then null else nullif(left(p_error_code, 128), '') end,
           last_error_message = case when p_success then null else nullif(left(p_error_message, 2048), '') end,
           source_cursor = case when v_accept_source_checkpoint then coalesce(p_source_cursor, state.source_cursor) else state.source_cursor end,
           source_watermark_at = case
               when v_accept_source_checkpoint and p_source_watermark_at is not null then p_source_watermark_at
               else state.source_watermark_at
           end,
           source_watermark_key = case
               when v_accept_source_checkpoint then coalesce(p_source_watermark_key, p_source_cursor, state.source_watermark_key)
               else state.source_watermark_key
           end,
           source_provenance = case
               when v_accept_source_checkpoint and v_provenance <> '{}'::jsonb then v_provenance
               else state.source_provenance
           end,
           updated_at = p_now
     where state.tracking_id = p_tracking_id and state.scope = v_scope;

    return jsonb_build_object(
        'trackingId', p_tracking_id,
        'scope', v_scope,
        'success', coalesce(p_success, false),
        'checkpointAccepted', v_accept_source_checkpoint,
        'updatedAt', p_now
    );
end;
$$;

revoke all on function public.update_advanced_stats_bootstrap_v1(
    uuid,text,text,text,text,smallint,bigint,bigint,text,text,timestamptz
) from public, anon, authenticated;
grant execute on function public.update_advanced_stats_bootstrap_v1(
    uuid,text,text,text,text,smallint,bigint,bigint,text,text,timestamptz
) to service_role;

revoke all on function public.update_advanced_stats_scope_poll_v1(
    uuid,text,text,text,timestamptz,boolean,text,timestamptz,text,text,timestamptz,text,jsonb,text,text
) from public, anon, authenticated;
grant execute on function public.update_advanced_stats_scope_poll_v1(
    uuid,text,text,text,timestamptz,boolean,text,timestamptz,text,text,timestamptz,text,jsonb,text,text
) to service_role;

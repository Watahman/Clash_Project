-- Advanced Stats compact per-scope capability and provenance contract.
-- This is an invoker function; service_role grants are explicit below.

create or replace function public.record_advanced_stats_scope_capability_v1(
    p_tracking_id uuid,
    p_player_tag text,
    p_scope text,
    p_worker_id text,
    p_capability_status text,
    p_coverage_status text,
    p_source_id text,
    p_adapter_version text,
    p_source_provenance jsonb,
    p_now timestamptz
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    v_scope text := upper(btrim(p_scope));
    v_capability text := upper(btrim(p_capability_status));
    v_coverage text := upper(btrim(p_coverage_status));
    v_provenance jsonb := coalesce(p_source_provenance, '{}'::jsonb);
begin
    if v_scope not in ('NORMAL', 'WAR', 'RANKED') then
        raise exception 'Unsupported Advanced Stats scope: %', p_scope;
    end if;
    if v_capability not in ('SUPPORTED', 'PARTIAL', 'UNSUPPORTED') then
        raise exception 'Unsupported Advanced Stats capability status: %', p_capability_status;
    end if;
    if v_coverage not in ('COMPLETE', 'PARTIAL', 'UNAVAILABLE') then
        raise exception 'Unsupported Advanced Stats coverage status: %', p_coverage_status;
    end if;
    if p_now is null or btrim(coalesce(p_worker_id, '')) = ''
       or btrim(coalesce(p_source_id, '')) = '' then
        raise exception 'Advanced Stats capability identity is required';
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

    update public.advanced_stats_scope_state state
       set source_provider = case
               when lower(btrim(p_source_id)) like 'clashking%' then 'CLASHKING'
               else state.source_provider
           end,
           source_id = left(btrim(p_source_id), 128),
           source_adapter_version = nullif(left(btrim(p_adapter_version), 128), ''),
           capability_status = v_capability,
           coverage_status = v_coverage,
           coverage_updated_at = p_now,
           source_provenance = case
               when v_provenance = '{}'::jsonb then state.source_provenance
               else state.source_provenance || v_provenance
           end,
           bootstrap_status = case when v_capability = 'UNSUPPORTED' then 'UNSUPPORTED' else state.bootstrap_status end,
           bootstrap_progress = case when v_capability = 'UNSUPPORTED' then 0 else state.bootstrap_progress end,
           bootstrap_completed_at = case when v_capability = 'UNSUPPORTED' then null else state.bootstrap_completed_at end,
           updated_at = p_now
     where state.tracking_id = p_tracking_id and state.scope = v_scope;

    return jsonb_build_object(
        'trackingId', p_tracking_id,
        'scope', v_scope,
        'capabilityStatus', v_capability,
        'coverageStatus', v_coverage,
        'sourceId', p_source_id,
        'updatedAt', p_now
    );
end;
$$;

revoke all on function public.record_advanced_stats_scope_capability_v1(
    uuid,text,text,text,text,text,text,text,jsonb,timestamptz
) from public, anon, authenticated;
grant execute on function public.record_advanced_stats_scope_capability_v1(
    uuid,text,text,text,text,text,text,text,jsonb,timestamptz
) to service_role;

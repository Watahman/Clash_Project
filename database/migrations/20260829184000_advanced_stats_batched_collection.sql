-- Persist one ClashKing history page per Supabase round-trip.
--
-- The existing event_v2 RPC remains the audited single-event write primitive.
-- This page RPC executes that primitive inside one database transaction, then
-- advances the source checkpoint and bootstrap status once. This removes the
-- dominant N HTTP round-trips per page without changing deduplication rules.

create or replace function public.save_advanced_stats_compact_page_v1(
    p_tracking_id uuid,
    p_player_tag text,
    p_scope text,
    p_events jsonb,
    p_observed_at timestamptz,
    p_expected_cursor text,
    p_expected_watermark_at timestamptz,
    p_expected_watermark_key text,
    p_source_cursor text,
    p_source_watermark_at timestamptz,
    p_source_watermark_key text,
    p_source_provenance jsonb,
    p_bootstrap_import boolean,
    p_has_more boolean,
    p_worker_id text
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    v_scope text := upper(btrim(p_scope));
    v_events jsonb := coalesce(p_events, '[]'::jsonb);
    v_provenance jsonb := coalesce(p_source_provenance, '{}'::jsonb);
    v_ranked_season_key text := coalesce(v_provenance->>'rankedSeasonKey', '');
    v_event jsonb;
    v_result jsonb;
    v_inserted bigint := 0;
    v_duplicates bigint := 0;
    v_processed_before bigint := 0;
    v_bootstrap_status text;
    v_bootstrap_progress smallint;
begin
    if p_tracking_id is null or btrim(coalesce(p_player_tag, '')) = '' then
        raise exception 'Advanced Stats compact page identity is required';
    end if;
    if v_scope not in ('NORMAL', 'WAR', 'RANKED') then
        raise exception 'Unsupported Advanced Stats scope: %', p_scope;
    end if;
    if p_observed_at is null or btrim(coalesce(p_worker_id, '')) = '' then
        raise exception 'Advanced Stats compact page worker identity is required';
    end if;
    if jsonb_typeof(v_events) <> 'array' then
        raise exception 'Advanced Stats compact page events must be a JSON array';
    end if;
    if jsonb_array_length(v_events) > 500 then
        raise exception 'Advanced Stats compact page cannot contain more than 500 events';
    end if;
    if jsonb_typeof(v_provenance) <> 'object' then
        raise exception 'Advanced Stats source provenance must be a JSON object';
    end if;

    -- Fail before doing any work when the scheduled collector no longer owns
    -- the tracker. event_v2 performs the same check for each row as a second
    -- safety fence inside the existing write contract.
    perform 1
      from public.advanced_stats_tracking tracking
     where tracking.id = p_tracking_id
       and tracking.player_tag = p_player_tag
       and tracking.status in ('INITIALIZING', 'ACTIVE', 'DEGRADED')
       and tracking.locked_by = btrim(p_worker_id)
       and tracking.locked_until > p_observed_at
     for update;
    if not found then
        raise exception 'Advanced Stats poll lease is no longer active';
    end if;

    insert into public.advanced_stats_scope_state (tracking_id, scope)
    values (p_tracking_id, v_scope)
    on conflict (tracking_id, scope) do nothing;

    select state.bootstrap_processed
      into v_processed_before
      from public.advanced_stats_scope_state state
     where state.tracking_id = p_tracking_id
       and state.scope = v_scope
     for update;

    for v_event in select value from jsonb_array_elements(v_events)
    loop
        if jsonb_typeof(v_event) <> 'object' then
            raise exception 'Advanced Stats compact page event must be an object';
        end if;

        v_result := public.save_advanced_stats_compact_event_v2(
            p_tracking_id,
            p_player_tag,
            v_scope,
            nullif(v_event->>'eventFingerprint', ''),
            nullif(v_event->>'eventAt', '')::timestamptz,
            p_observed_at,
            nullif(v_event->>'stars', '')::smallint,
            nullif(v_event->>'destructionPercentage', '')::numeric,
            coalesce(nullif(v_event->>'lootGold', '')::bigint, 0),
            coalesce(nullif(v_event->>'lootElixir', '')::bigint, 0),
            coalesce(nullif(v_event->>'lootDarkElixir', '')::bigint, 0),
            coalesce(v_event->'units', '[]'::jsonb),
            nullif(v_event->>'armyHash', ''),
            case
                when v_event->'normalizedArmyJson' is null
                  or v_event->'normalizedArmyJson' = 'null'::jsonb then null
                else v_event->'normalizedArmyJson'
            end,
            p_expected_cursor,
            p_expected_watermark_at,
            p_expected_watermark_key,
            p_source_cursor,
            p_source_watermark_at,
            p_source_watermark_key,
            v_provenance,
            coalesce(p_bootstrap_import, false),
            v_ranked_season_key,
            p_worker_id
        );

        if coalesce((v_result->>'inserted')::boolean, false) then
            v_inserted := v_inserted + 1;
        elsif coalesce((v_result->>'duplicate')::boolean, false) then
            v_duplicates := v_duplicates + 1;
        end if;
    end loop;

    perform public.update_advanced_stats_scope_poll_v2(
        p_tracking_id,
        p_player_tag,
        v_scope,
        p_worker_id,
        p_observed_at,
        true,
        p_expected_cursor,
        p_expected_watermark_at,
        p_expected_watermark_key,
        p_source_cursor,
        p_source_watermark_at,
        p_source_watermark_key,
        v_provenance,
        null,
        null,
        v_ranked_season_key
    );

    if coalesce(p_bootstrap_import, false) then
        -- Bootstrap completion and history coverage are different concepts.
        -- ClashKing V2 has bounded/no-cursor history routes, so the collector
        -- can finish importing the available page while coverage stays PARTIAL.
        v_bootstrap_status := case when coalesce(p_has_more, false) then 'RUNNING' else 'COMPLETE' end;
        v_bootstrap_progress := case when v_bootstrap_status = 'COMPLETE' then 100 else 0 end;

        perform public.update_advanced_stats_bootstrap_v1(
            p_tracking_id,
            p_player_tag,
            v_scope,
            p_worker_id,
            v_bootstrap_status,
            v_bootstrap_progress,
            coalesce(v_processed_before, 0) + v_inserted,
            null,
            '',
            '',
            p_observed_at
        );
    end if;

    return jsonb_build_object(
        'trackingId', p_tracking_id,
        'scope', v_scope,
        'events', jsonb_array_length(v_events),
        'inserted', v_inserted,
        'duplicates', v_duplicates,
        'checkpointAdvanced', true,
        'bootstrapStatus', case
            when coalesce(p_bootstrap_import, false) then v_bootstrap_status
            else null
        end
    );
end;
$$;

revoke all on function public.save_advanced_stats_compact_page_v1(
    uuid,text,text,jsonb,timestamptz,text,timestamptz,text,text,timestamptz,text,jsonb,boolean,boolean,text
) from public, anon, authenticated;
grant execute on function public.save_advanced_stats_compact_page_v1(
    uuid,text,text,jsonb,timestamptz,text,timestamptz,text,text,timestamptz,text,jsonb,boolean,boolean,text
) to service_role;

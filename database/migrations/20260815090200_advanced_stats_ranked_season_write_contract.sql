-- Season-aware write wrappers.  v1 remains available for legacy callers; v2
-- supplies the season explicitly and delegates the existing compact write logic.

create or replace function public.prepare_advanced_stats_ranked_season_v1(
    p_tracking_id uuid,
    p_player_tag text,
    p_scope text,
    p_requested_season_key text,
    p_now timestamptz
) returns text
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    v_scope text := upper(btrim(p_scope));
    v_requested text := public.normalize_advanced_stats_ranked_season_key_v1(
        v_scope, p_requested_season_key);
    v_state public.advanced_stats_scope_state%rowtype;
    v_active text;
begin
    if p_tracking_id is null or btrim(coalesce(p_player_tag, '')) = '' or p_now is null then
        raise exception 'Advanced Stats ranked-season state identity is required';
    end if;

    insert into public.advanced_stats_scope_state (tracking_id, scope)
    values (p_tracking_id, v_scope)
    on conflict (tracking_id, scope) do nothing;

    select state.* into v_state
      from public.advanced_stats_scope_state state
     where state.tracking_id = p_tracking_id and state.scope = v_scope
     for update;

    if v_scope <> 'RANKED' then
        return '';
    end if;

    v_active := coalesce(v_state.source_season_key, '');
    if v_requested = '' then
        v_requested := v_active;
    end if;
    if v_active <> '' and v_requested <> v_active then
        raise exception 'Advanced Stats ranked season changed; switch the active season first';
    end if;
    if v_active = '' and v_requested <> '' then
        update public.advanced_stats_scope_state
           set source_season_key = v_requested,
               source_cursor = null,
               source_watermark_at = null,
               source_watermark_key = null,
               source_provenance = source_provenance || jsonb_build_object(
                   'rankedSeasonKey', v_requested
               ),
               updated_at = p_now
         where tracking_id = p_tracking_id and scope = v_scope;
    end if;
    return v_requested;
end;
$$;

create or replace function public.save_advanced_stats_compact_event_v2(
    p_tracking_id uuid,
    p_player_tag text,
    p_scope text,
    p_event_fingerprint text,
    p_event_at timestamptz,
    p_observed_at timestamptz,
    p_stars smallint,
    p_destruction_percentage numeric,
    p_loot_gold bigint,
    p_loot_elixir bigint,
    p_loot_dark_elixir bigint,
    p_units jsonb,
    p_army_hash text,
    p_normalized_army_json jsonb,
    p_expected_cursor text,
    p_expected_watermark_at timestamptz,
    p_expected_watermark_key text,
    p_source_cursor text,
    p_source_watermark_at timestamptz,
    p_source_watermark_key text,
    p_source_provenance jsonb,
    p_bootstrap_import boolean,
    p_ranked_season_key text,
    p_worker_id text
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    v_scope text := upper(btrim(p_scope));
    v_season_key text;
    v_requested_season_key text := nullif(btrim(coalesce(p_ranked_season_key, '')), '');
    v_provenance_season_key text := nullif(btrim(coalesce(p_source_provenance->>'rankedSeasonKey', '')), '');
    v_provenance jsonb := coalesce(p_source_provenance, '{}'::jsonb);
begin
    if jsonb_typeof(v_provenance) <> 'object' then
        raise exception 'Advanced Stats source provenance must be a JSON object';
    end if;
    if v_scope = 'RANKED'
       and v_provenance_season_key is not null
       and v_requested_season_key is not null
       and v_provenance_season_key <> v_requested_season_key then
        raise exception 'Advanced Stats ranked provenance season does not match the write season';
    end if;
    v_season_key := public.prepare_advanced_stats_ranked_season_v1(
        p_tracking_id, p_player_tag, v_scope, coalesce(v_requested_season_key, v_provenance_season_key, ''),
        coalesce(p_observed_at, now()));
    if v_season_key <> '' then
        v_provenance := v_provenance || jsonb_build_object('rankedSeasonKey', v_season_key);
    end if;
    return public.save_advanced_stats_compact_event_v1(
        p_tracking_id, p_player_tag, v_scope, p_event_fingerprint, p_event_at,
        p_observed_at, p_stars, p_destruction_percentage, p_loot_gold, p_loot_elixir,
        p_loot_dark_elixir, p_units, p_army_hash, p_normalized_army_json,
        p_expected_cursor, p_expected_watermark_at, p_expected_watermark_key,
        p_source_cursor, p_source_watermark_at, p_source_watermark_key,
        v_provenance, p_bootstrap_import, p_worker_id);
end;
$$;

create or replace function public.update_advanced_stats_scope_poll_v2(
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
    p_error_message text,
    p_ranked_season_key text
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    v_scope text := upper(btrim(p_scope));
    v_season_key text;
    v_requested_season_key text := nullif(btrim(coalesce(p_ranked_season_key, '')), '');
    v_provenance_season_key text := nullif(btrim(coalesce(p_source_provenance->>'rankedSeasonKey', '')), '');
    v_provenance jsonb := coalesce(p_source_provenance, '{}'::jsonb);
begin
    if jsonb_typeof(v_provenance) <> 'object' then
        raise exception 'Advanced Stats source provenance must be a JSON object';
    end if;
    if v_scope = 'RANKED'
       and v_provenance_season_key is not null
       and v_requested_season_key is not null
       and v_provenance_season_key <> v_requested_season_key then
        raise exception 'Advanced Stats ranked provenance season does not match the poll season';
    end if;
    v_season_key := public.prepare_advanced_stats_ranked_season_v1(
        p_tracking_id, p_player_tag, v_scope,
        coalesce(v_requested_season_key, v_provenance_season_key, ''), p_now);
    if v_season_key <> '' then
        v_provenance := v_provenance || jsonb_build_object('rankedSeasonKey', v_season_key);
    end if;
    return public.update_advanced_stats_scope_poll_v1(
        p_tracking_id, p_player_tag, v_scope, p_worker_id, p_now, p_success,
        p_expected_cursor, p_expected_watermark_at, p_expected_watermark_key,
        p_source_cursor, p_source_watermark_at, p_source_watermark_key,
        v_provenance, p_error_code, p_error_message);
end;
$$;

revoke all on function public.prepare_advanced_stats_ranked_season_v1(uuid,text,text,text,timestamptz)
    from public, anon, authenticated;
grant execute on function public.prepare_advanced_stats_ranked_season_v1(uuid,text,text,text,timestamptz)
    to service_role;
revoke all on function public.save_advanced_stats_compact_event_v2(
    uuid,text,text,text,timestamptz,timestamptz,smallint,numeric,bigint,bigint,bigint,
    jsonb,text,jsonb,text,timestamptz,text,text,timestamptz,text,jsonb,boolean,text,text
) from public, anon, authenticated;
grant execute on function public.save_advanced_stats_compact_event_v2(
    uuid,text,text,text,timestamptz,timestamptz,smallint,numeric,bigint,bigint,bigint,
    jsonb,text,jsonb,text,timestamptz,text,text,timestamptz,text,jsonb,boolean,text,text
) to service_role;
revoke all on function public.update_advanced_stats_scope_poll_v2(
    uuid,text,text,text,timestamptz,boolean,text,timestamptz,text,text,timestamptz,text,jsonb,text,text,text
) from public, anon, authenticated;
grant execute on function public.update_advanced_stats_scope_poll_v2(
    uuid,text,text,text,timestamptz,boolean,text,timestamptz,text,text,timestamptz,text,jsonb,text,text,text
) to service_role;

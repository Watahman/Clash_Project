-- Advanced Stats compact writes and page ingestion with loot enrichment.
--
-- All writes remain transactional and service-role-only through existing RPC
-- grants. Historical receipts stay immutable for reliable loot; only
-- post-migration missing-loot receipts can be enriched once.

begin;

-- New event primitive.  The v1/v2 wrappers below deliberately remain stable
-- for existing service callers and treat their historically mandatory loot
-- arguments as known.  Page ingestion is the only path that can mark loot
-- unavailable without changing its public RPC shape.
create or replace function public.save_advanced_stats_compact_event_v3(
    p_tracking_id uuid,
    p_player_tag text,
    p_scope text,
    p_event_fingerprint text,
    p_event_at timestamptz,
    p_observed_at timestamptz,
    p_stars smallint,
    p_destruction_percentage numeric,
    p_loot_available boolean,
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
    v_event_at timestamptz := coalesce(p_event_at, p_observed_at, now());
    v_watermark_at timestamptz := coalesce(p_source_watermark_at, v_event_at);
    v_event_date date;
    v_unit jsonb;
    v_unit_key text;
    v_unit_name text;
    v_category text;
    v_event_fingerprint text;
    v_provenance jsonb := coalesce(p_source_provenance, '{}'::jsonb);
    v_state public.advanced_stats_scope_state%rowtype;
    v_state_season text;
    v_season_key text;
    v_provenance_season text := nullif(btrim(v_provenance->>'rankedSeasonKey'), '');
    v_loot_available boolean := coalesce(p_loot_available, false);
    v_loot_gold bigint := greatest(coalesce(p_loot_gold, 0), 0);
    v_loot_elixir bigint := greatest(coalesce(p_loot_elixir, 0), 0);
    v_loot_dark_elixir bigint := greatest(coalesce(p_loot_dark_elixir, 0), 0);
    v_receipt_loot_available boolean;
    v_receipt_event_at timestamptz;
    v_receipt_totals_applied boolean;
    v_loot_enriched boolean := false;
begin
    if p_tracking_id is null or btrim(coalesce(p_player_tag, '')) = '' then
        raise exception 'Advanced Stats compact event identity is required';
    end if;
    if v_scope not in ('NORMAL', 'WAR', 'RANKED') then
        raise exception 'Unsupported Advanced Stats scope: %', p_scope;
    end if;
    if p_event_fingerprint is null or p_event_fingerprint !~ '^[0-9a-fA-F]{64}$' then
        raise exception 'Invalid Advanced Stats event fingerprint';
    end if;
    if btrim(coalesce(p_worker_id, '')) = '' then
        raise exception 'Advanced Stats worker id is required';
    end if;
    if p_stars is not null and p_stars not between 0 and 3 then
        raise exception 'Advanced Stats stars must be between 0 and 3';
    end if;
    if p_destruction_percentage is not null and p_destruction_percentage not between 0 and 100 then
        raise exception 'Advanced Stats destruction must be between 0 and 100';
    end if;
    if jsonb_typeof(coalesce(p_units, '[]'::jsonb)) <> 'array' then
        raise exception 'Advanced Stats units must be a JSON array';
    end if;
    if (p_army_hash is null) <> (p_normalized_army_json is null) then
        raise exception 'Advanced Stats army hash and payload must be supplied together';
    end if;
    if p_army_hash is not null and p_army_hash !~ '^[0-9a-fA-F]{64}$' then
        raise exception 'Invalid Advanced Stats army hash';
    end if;
    if jsonb_typeof(v_provenance) <> 'object' then
        raise exception 'Advanced Stats source provenance must be a JSON object';
    end if;
    if v_scope <> 'RANKED' and v_provenance_season is not null then
        raise exception 'A ranked season provenance key is only valid for the RANKED scope';
    end if;

    perform 1
      from public.advanced_stats_tracking tracking
     where tracking.id = p_tracking_id and tracking.player_tag = p_player_tag
       and tracking.status in ('INITIALIZING', 'ACTIVE', 'DEGRADED')
       and tracking.locked_by = btrim(p_worker_id) and tracking.locked_until > now()
     for update;
    if not found then
        raise exception 'Advanced Stats poll lease is no longer active';
    end if;

    insert into public.advanced_stats_scope_state (tracking_id, scope)
    values (p_tracking_id, v_scope)
    on conflict (tracking_id, scope) do nothing;
    select state.* into v_state
      from public.advanced_stats_scope_state state
     where state.tracking_id = p_tracking_id and state.scope = v_scope
     for update;

    if v_state.source_cursor is distinct from p_expected_cursor
       or v_state.source_watermark_at is distinct from p_expected_watermark_at
       or v_state.source_watermark_key is distinct from p_expected_watermark_key then
        raise exception 'Advanced Stats source checkpoint changed during collection';
    end if;

    v_state_season := coalesce(v_state.source_season_key, '');
    if v_scope = 'RANKED' then
        if v_provenance_season is not null and v_state_season <> ''
           and v_provenance_season <> v_state_season then
            raise exception 'Advanced Stats ranked provenance season does not match the active season';
        end if;
        v_season_key := public.normalize_advanced_stats_ranked_season_key_v1(
            v_scope, coalesce(nullif(btrim(p_ranked_season_key), ''), v_provenance_season, v_state_season, ''));
        if v_state_season <> '' and v_season_key <> v_state_season then
            raise exception 'Advanced Stats ranked season changed; switch the active season first';
        end if;
        if v_state_season = '' and v_season_key <> '' then
            update public.advanced_stats_scope_state
               set source_season_key = v_season_key,
                   source_provenance = source_provenance || jsonb_build_object('rankedSeasonKey', v_season_key),
                   updated_at = now()
             where tracking_id = p_tracking_id and scope = v_scope;
        end if;
    else
        v_season_key := public.normalize_advanced_stats_ranked_season_key_v1(v_scope, '');
    end if;

    v_event_date := (v_event_at at time zone 'UTC')::date;
    insert into public.advanced_stats_event_receipts (
        tracking_id, scope, season_key, event_fingerprint, event_at,
        source_cursor, source_watermark_at, source_watermark_key, bootstrap_import,
        loot_available, loot_gold, loot_elixir, loot_dark_elixir,
        loot_totals_applied, loot_enrichment_eligible
    ) values (
        p_tracking_id, v_scope, v_season_key, p_event_fingerprint, v_event_at,
        p_source_cursor, v_watermark_at, coalesce(p_source_watermark_key, p_event_fingerprint),
        coalesce(p_bootstrap_import, false), v_loot_available,
        case when v_loot_available then v_loot_gold end,
        case when v_loot_available then v_loot_elixir end,
        case when v_loot_available then v_loot_dark_elixir end,
        v_loot_available,
        not v_loot_available
    ) on conflict (tracking_id, scope, season_key, event_fingerprint) do nothing
    returning event_fingerprint into v_event_fingerprint;

    if not found then
        if v_loot_available then
            select r.loot_available, r.event_at, r.loot_totals_applied
              into v_receipt_loot_available, v_receipt_event_at, v_receipt_totals_applied
              from public.advanced_stats_event_receipts r
             where r.tracking_id = p_tracking_id and r.scope = v_scope
               and r.season_key = v_season_key and r.event_fingerprint = p_event_fingerprint
             for update;
             if not coalesce(v_receipt_loot_available, false)
                and not coalesce(v_receipt_totals_applied, false)
                and exists (
                    select 1 from public.advanced_stats_event_receipts r
                     where r.tracking_id = p_tracking_id and r.scope = v_scope
                       and r.season_key = v_season_key and r.event_fingerprint = p_event_fingerprint
                       and r.loot_enrichment_eligible
                ) then
                update public.advanced_stats_event_receipts
                       set loot_available = true, loot_gold = v_loot_gold,
                       loot_elixir = v_loot_elixir, loot_dark_elixir = v_loot_dark_elixir,
                       loot_totals_applied = true,
                       loot_enrichment_eligible = false
                 where tracking_id = p_tracking_id and scope = v_scope
                 and season_key = v_season_key and event_fingerprint = p_event_fingerprint
                   and loot_available = false
                   and loot_totals_applied = false
                   and loot_enrichment_eligible = true;
                if found then
                    -- Use the original receipt day.  A later overlapping poll
                    -- may provide a different fallback timestamp, but it must
                    -- enrich the original daily bucket exactly once.
                    v_event_date := (v_receipt_event_at at time zone 'UTC')::date;
                    update public.advanced_stats_scope_daily
                       set reliable_gold_looted = reliable_gold_looted + v_loot_gold,
                           reliable_elixir_looted = reliable_elixir_looted + v_loot_elixir,
                           reliable_dark_elixir_looted = reliable_dark_elixir_looted + v_loot_dark_elixir,
                           loot_known_attacks = loot_known_attacks + 1,
                           best_gold_looted = case when best_gold_looted is null then v_loot_gold
                               else greatest(best_gold_looted, v_loot_gold) end,
                           best_elixir_looted = case when best_elixir_looted is null then v_loot_elixir
                               else greatest(best_elixir_looted, v_loot_elixir) end,
                           best_dark_elixir_looted = case when best_dark_elixir_looted is null then v_loot_dark_elixir
                               else greatest(best_dark_elixir_looted, v_loot_dark_elixir) end,
                           updated_at = now()
                     where tracking_id = p_tracking_id and scope = v_scope
                       and season_key = v_season_key and stat_date = v_event_date;
                    if not found then
                        raise exception 'Advanced Stats duplicate loot enrichment has no daily row';
                    end if;
                    v_loot_enriched := true;
                end if;
            end if;
        end if;
        update public.advanced_stats_scope_state
           set last_attempted_poll_at = coalesce(p_observed_at, now()), updated_at = now()
         where tracking_id = p_tracking_id and scope = v_scope;
        return jsonb_build_object('inserted', false, 'duplicate', true, 'scope', v_scope,
            'seasonKey', v_season_key, 'eventFingerprint', p_event_fingerprint,
            'lootEnriched', v_loot_enriched);
    end if;

    for v_unit in select value from jsonb_array_elements(coalesce(p_units, '[]'::jsonb)) loop
        v_unit_key := nullif(btrim(v_unit->>'unit_key'), '');
        v_unit_name := nullif(btrim(v_unit->>'unit_name'), '');
        v_category := upper(btrim(coalesce(v_unit->>'category', '')));
        if v_unit_key is null or char_length(v_unit_key) > 96
           or v_unit_name is null or char_length(v_unit_name) > 128 then
            raise exception 'Invalid Advanced Stats compact unit identity';
        end if;
        if v_category not in ('TROOP', 'SPELL', 'SIEGE', 'SUPER_TROOP', 'CLAN_CASTLE_TROOP',
                              'CLAN_CASTLE_SPELL', 'HERO', 'PET', 'EQUIPMENT') then
            raise exception 'Unsupported Advanced Stats unit category: %', v_category;
        end if;
        if coalesce((v_unit->>'quantity')::bigint, 0) <= 0 then
            raise exception 'Advanced Stats compact unit quantity must be positive';
        end if;
        insert into public.advanced_stats_scope_unit_daily (
            tracking_id, scope, season_key, stat_date, unit_key, unit_name, category,
            total_quantity, battles_present
        ) values (
            p_tracking_id, v_scope, v_season_key, v_event_date, v_unit_key, v_unit_name, v_category,
            (v_unit->>'quantity')::bigint, 1
        ) on conflict (tracking_id, scope, season_key, stat_date, category, unit_key) do update
            set unit_name = excluded.unit_name,
                total_quantity = public.advanced_stats_scope_unit_daily.total_quantity + excluded.total_quantity,
                battles_present = public.advanced_stats_scope_unit_daily.battles_present + 1,
                updated_at = now();
    end loop;

    if p_army_hash is not null then
        insert into public.advanced_stats_army_dictionary (army_hash, normalized_army_json)
        values (p_army_hash, p_normalized_army_json)
        on conflict (army_hash) do nothing;
        insert into public.advanced_stats_scope_army_daily (
            tracking_id, scope, season_key, stat_date, army_hash,
            battle_count, total_stars, total_destruction
        ) values (
            p_tracking_id, v_scope, v_season_key, v_event_date, p_army_hash,
            1, greatest(coalesce(p_stars, 0), 0), greatest(coalesce(p_destruction_percentage, 0), 0)
        ) on conflict (tracking_id, scope, season_key, stat_date, army_hash) do update
            set battle_count = public.advanced_stats_scope_army_daily.battle_count + 1,
                total_stars = public.advanced_stats_scope_army_daily.total_stars + excluded.total_stars,
                total_destruction = public.advanced_stats_scope_army_daily.total_destruction + excluded.total_destruction,
                updated_at = now();
    end if;

    insert into public.advanced_stats_scope_daily (
        tracking_id, scope, season_key, stat_date, attacks, total_stars, total_destruction,
        three_star_attacks, two_star_attacks, one_star_attacks, zero_star_attacks,
        reliable_gold_looted, reliable_elixir_looted, reliable_dark_elixir_looted,
        loot_known_attacks,
        best_gold_looted, best_elixir_looted, best_dark_elixir_looted
    ) values (
        p_tracking_id, v_scope, v_season_key, v_event_date, 1,
        greatest(coalesce(p_stars, 0), 0), greatest(coalesce(p_destruction_percentage, 0), 0),
        case when p_stars = 3 then 1 else 0 end, case when p_stars = 2 then 1 else 0 end,
        case when p_stars = 1 then 1 else 0 end, case when p_stars = 0 then 1 else 0 end,
        case when v_loot_available then v_loot_gold else 0 end,
        case when v_loot_available then v_loot_elixir else 0 end,
        case when v_loot_available then v_loot_dark_elixir else 0 end,
        case when v_loot_available then 1 else 0 end,
        case when v_loot_available then v_loot_gold end,
        case when v_loot_available then v_loot_elixir end,
        case when v_loot_available then v_loot_dark_elixir end
    ) on conflict (tracking_id, scope, season_key, stat_date) do update
        set attacks = public.advanced_stats_scope_daily.attacks + 1,
            total_stars = public.advanced_stats_scope_daily.total_stars + excluded.total_stars,
            total_destruction = public.advanced_stats_scope_daily.total_destruction + excluded.total_destruction,
            three_star_attacks = public.advanced_stats_scope_daily.three_star_attacks + excluded.three_star_attacks,
            two_star_attacks = public.advanced_stats_scope_daily.two_star_attacks + excluded.two_star_attacks,
            one_star_attacks = public.advanced_stats_scope_daily.one_star_attacks + excluded.one_star_attacks,
            zero_star_attacks = public.advanced_stats_scope_daily.zero_star_attacks + excluded.zero_star_attacks,
            reliable_gold_looted = public.advanced_stats_scope_daily.reliable_gold_looted + excluded.reliable_gold_looted,
            reliable_elixir_looted = public.advanced_stats_scope_daily.reliable_elixir_looted + excluded.reliable_elixir_looted,
            reliable_dark_elixir_looted = public.advanced_stats_scope_daily.reliable_dark_elixir_looted + excluded.reliable_dark_elixir_looted,
            loot_known_attacks = public.advanced_stats_scope_daily.loot_known_attacks + excluded.loot_known_attacks,
            best_gold_looted = case when excluded.best_gold_looted is null then public.advanced_stats_scope_daily.best_gold_looted
                when public.advanced_stats_scope_daily.best_gold_looted is null then excluded.best_gold_looted
                else greatest(public.advanced_stats_scope_daily.best_gold_looted, excluded.best_gold_looted) end,
            best_elixir_looted = case when excluded.best_elixir_looted is null then public.advanced_stats_scope_daily.best_elixir_looted
                when public.advanced_stats_scope_daily.best_elixir_looted is null then excluded.best_elixir_looted
                else greatest(public.advanced_stats_scope_daily.best_elixir_looted, excluded.best_elixir_looted) end,
            best_dark_elixir_looted = case when excluded.best_dark_elixir_looted is null then public.advanced_stats_scope_daily.best_dark_elixir_looted
                when public.advanced_stats_scope_daily.best_dark_elixir_looted is null then excluded.best_dark_elixir_looted
                else greatest(public.advanced_stats_scope_daily.best_dark_elixir_looted, excluded.best_dark_elixir_looted) end,
            updated_at = now();

    update public.advanced_stats_scope_state
       set last_attempted_poll_at = coalesce(p_observed_at, now()), updated_at = now()
     where tracking_id = p_tracking_id and scope = v_scope;
    update public.advanced_stats_tracking
       set battles_processed = battles_processed + 1, updated_at = now()
     where id = p_tracking_id;
    return jsonb_build_object('inserted', true, 'duplicate', false, 'scope', v_scope,
        'seasonKey', v_season_key, 'eventFingerprint', p_event_fingerprint,
        'eventDate', v_event_date, 'lootAvailable', v_loot_available);
end;
$$;

revoke all on function public.save_advanced_stats_compact_event_v3(
    uuid,text,text,text,timestamptz,timestamptz,smallint,numeric,boolean,bigint,bigint,bigint,
    jsonb,text,jsonb,text,timestamptz,text,text,timestamptz,text,jsonb,boolean,text,text
) from public, anon, authenticated;
grant execute on function public.save_advanced_stats_compact_event_v3(
    uuid,text,text,text,timestamptz,timestamptz,smallint,numeric,boolean,bigint,bigint,bigint,
    jsonb,text,jsonb,text,timestamptz,text,text,timestamptz,text,jsonb,boolean,text,text
) to service_role;

create or replace function public.save_advanced_stats_compact_event_v1(
    p_tracking_id uuid, p_player_tag text, p_scope text, p_event_fingerprint text,
    p_event_at timestamptz, p_observed_at timestamptz, p_stars smallint,
    p_destruction_percentage numeric, p_loot_gold bigint, p_loot_elixir bigint,
    p_loot_dark_elixir bigint, p_units jsonb, p_army_hash text,
    p_normalized_army_json jsonb, p_expected_cursor text,
    p_expected_watermark_at timestamptz, p_expected_watermark_key text,
    p_source_cursor text, p_source_watermark_at timestamptz,
    p_source_watermark_key text, p_source_provenance jsonb,
    p_bootstrap_import boolean, p_worker_id text
) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp
as $$
begin
    return public.save_advanced_stats_compact_event_v3(
        p_tracking_id, p_player_tag, p_scope, p_event_fingerprint, p_event_at,
        p_observed_at, p_stars, p_destruction_percentage, true, p_loot_gold,
        p_loot_elixir, p_loot_dark_elixir, p_units, p_army_hash,
        p_normalized_army_json, p_expected_cursor, p_expected_watermark_at,
        p_expected_watermark_key, p_source_cursor, p_source_watermark_at,
        p_source_watermark_key, p_source_provenance, p_bootstrap_import,
        null, p_worker_id);
end;
$$;

revoke all on function public.save_advanced_stats_compact_event_v1(
    uuid,text,text,text,timestamptz,timestamptz,smallint,numeric,bigint,bigint,bigint,
    jsonb,text,jsonb,text,timestamptz,text,text,timestamptz,text,jsonb,boolean,text
) from public, anon, authenticated;
grant execute on function public.save_advanced_stats_compact_event_v1(
    uuid,text,text,text,timestamptz,timestamptz,smallint,numeric,bigint,bigint,bigint,
    jsonb,text,jsonb,text,timestamptz,text,text,timestamptz,text,jsonb,boolean,text
) to service_role;

create or replace function public.save_advanced_stats_compact_event_v2(
    p_tracking_id uuid, p_player_tag text, p_scope text, p_event_fingerprint text,
    p_event_at timestamptz, p_observed_at timestamptz, p_stars smallint,
    p_destruction_percentage numeric, p_loot_gold bigint, p_loot_elixir bigint,
    p_loot_dark_elixir bigint, p_units jsonb, p_army_hash text,
    p_normalized_army_json jsonb, p_expected_cursor text,
    p_expected_watermark_at timestamptz, p_expected_watermark_key text,
    p_source_cursor text, p_source_watermark_at timestamptz,
    p_source_watermark_key text, p_source_provenance jsonb,
    p_bootstrap_import boolean, p_ranked_season_key text, p_worker_id text
) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
    v_scope text := upper(btrim(p_scope));
    v_season_key text;
    v_provenance jsonb := coalesce(p_source_provenance, '{}'::jsonb);
begin
    v_season_key := public.prepare_advanced_stats_ranked_season_v1(
        p_tracking_id, p_player_tag, v_scope,
        coalesce(nullif(btrim(p_ranked_season_key), ''), nullif(btrim(v_provenance->>'rankedSeasonKey'), ''), ''),
        coalesce(p_observed_at, now()));
    if v_season_key <> '' then
        v_provenance := v_provenance || jsonb_build_object('rankedSeasonKey', v_season_key);
    end if;
    return public.save_advanced_stats_compact_event_v3(
        p_tracking_id, p_player_tag, v_scope, p_event_fingerprint, p_event_at,
        p_observed_at, p_stars, p_destruction_percentage, true, p_loot_gold,
        p_loot_elixir, p_loot_dark_elixir, p_units, p_army_hash,
        p_normalized_army_json, p_expected_cursor, p_expected_watermark_at,
        p_expected_watermark_key, p_source_cursor, p_source_watermark_at,
        p_source_watermark_key, v_provenance, p_bootstrap_import,
        v_season_key, p_worker_id);
end;
$$;

revoke all on function public.save_advanced_stats_compact_event_v2(
    uuid,text,text,text,timestamptz,timestamptz,smallint,numeric,bigint,bigint,bigint,
    jsonb,text,jsonb,text,timestamptz,text,text,timestamptz,text,jsonb,boolean,text,text
) from public, anon, authenticated;
grant execute on function public.save_advanced_stats_compact_event_v2(
    uuid,text,text,text,timestamptz,timestamptz,smallint,numeric,bigint,bigint,bigint,
    jsonb,text,jsonb,text,timestamptz,text,text,timestamptz,text,jsonb,boolean,text,text
) to service_role;

-- Page ingestion now carries the source's explicit loot availability bit.
create or replace function public.save_advanced_stats_compact_page_v1(
    p_tracking_id uuid, p_player_tag text, p_scope text, p_events jsonb,
    p_observed_at timestamptz, p_expected_cursor text,
    p_expected_watermark_at timestamptz, p_expected_watermark_key text,
    p_source_cursor text, p_source_watermark_at timestamptz,
    p_source_watermark_key text, p_source_provenance jsonb,
    p_bootstrap_import boolean, p_has_more boolean, p_worker_id text
) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp
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
    v_loot_available boolean;
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

    perform 1
      from public.advanced_stats_tracking tracking
     where tracking.id = p_tracking_id and tracking.player_tag = p_player_tag
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
    select state.bootstrap_processed into v_processed_before
      from public.advanced_stats_scope_state state
     where state.tracking_id = p_tracking_id and state.scope = v_scope
     for update;

    for v_event in select value from jsonb_array_elements(v_events) loop
        if jsonb_typeof(v_event) <> 'object' then
            raise exception 'Advanced Stats compact page event must be an object';
        end if;
        if v_event ? 'lootAvailable'
           and jsonb_typeof(v_event->'lootAvailable') not in ('boolean', 'null') then
            raise exception 'Advanced Stats lootAvailable must be a boolean';
        end if;
        v_loot_available := case when jsonb_typeof(v_event->'lootAvailable') = 'boolean'
            then (v_event->>'lootAvailable')::boolean else false end;
        v_result := public.save_advanced_stats_compact_event_v3(
            p_tracking_id, p_player_tag, v_scope,
            nullif(v_event->>'eventFingerprint', ''), nullif(v_event->>'eventAt', '')::timestamptz,
            p_observed_at, nullif(v_event->>'stars', '')::smallint,
            nullif(v_event->>'destructionPercentage', '')::numeric, v_loot_available,
            nullif(v_event->>'lootGold', '')::bigint,
            nullif(v_event->>'lootElixir', '')::bigint,
            nullif(v_event->>'lootDarkElixir', '')::bigint,
            coalesce(v_event->'units', '[]'::jsonb), nullif(v_event->>'armyHash', ''),
            case when v_event->'normalizedArmyJson' is null
                   or v_event->'normalizedArmyJson' = 'null'::jsonb then null
                 else v_event->'normalizedArmyJson' end,
            p_expected_cursor, p_expected_watermark_at, p_expected_watermark_key,
            p_source_cursor, p_source_watermark_at, p_source_watermark_key,
            v_provenance, coalesce(p_bootstrap_import, false), v_ranked_season_key, p_worker_id);
        if coalesce((v_result->>'inserted')::boolean, false) then
            v_inserted := v_inserted + 1;
        elsif coalesce((v_result->>'duplicate')::boolean, false) then
            v_duplicates := v_duplicates + 1;
        end if;
    end loop;

    perform public.update_advanced_stats_scope_poll_v2(
        p_tracking_id, p_player_tag, v_scope, p_worker_id, p_observed_at, true,
        p_expected_cursor, p_expected_watermark_at, p_expected_watermark_key,
        p_source_cursor, p_source_watermark_at, p_source_watermark_key,
        v_provenance, null, null, v_ranked_season_key);

    if coalesce(p_bootstrap_import, false) then
        v_bootstrap_status := case when coalesce(p_has_more, false) then 'RUNNING' else 'COMPLETE' end;
        v_bootstrap_progress := case when v_bootstrap_status = 'COMPLETE' then 100 else 0 end;
        perform public.update_advanced_stats_bootstrap_v1(
            p_tracking_id, p_player_tag, v_scope, p_worker_id, v_bootstrap_status,
            v_bootstrap_progress, coalesce(v_processed_before, 0) + v_inserted,
            null, '', '', p_observed_at);
    end if;

    return jsonb_build_object('trackingId', p_tracking_id, 'scope', v_scope,
        'events', jsonb_array_length(v_events), 'inserted', v_inserted,
        'duplicates', v_duplicates, 'checkpointAdvanced', true,
        'bootstrapStatus', case when coalesce(p_bootstrap_import, false)
            then v_bootstrap_status else null end);
end;
$$;

revoke all on function public.save_advanced_stats_compact_page_v1(
    uuid,text,text,jsonb,timestamptz,text,timestamptz,text,text,timestamptz,text,jsonb,boolean,boolean,text
) from public, anon, authenticated;
grant execute on function public.save_advanced_stats_compact_page_v1(
    uuid,text,text,jsonb,timestamptz,text,timestamptz,text,text,timestamptz,text,jsonb,boolean,boolean,text
) to service_role;


commit;

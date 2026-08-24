-- Advanced Stats compact ClashKing write contract.
--
-- These functions intentionally run as SECURITY INVOKER.  The backend calls
-- them with service_role, while tracking/player/lease checks remain enforced
-- in the function body.  No privilege escalation is needed.
-- Event writes keep the page checkpoint in receipts only; the poll RPC commits
-- one expected/monotonic checkpoint after the whole page is persisted.

create or replace function public.save_advanced_stats_compact_event_v1(
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
    if p_destruction_percentage is not null
       and p_destruction_percentage not between 0 and 100 then
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

    perform 1
      from public.advanced_stats_tracking tracking
     where tracking.id = p_tracking_id
       and tracking.player_tag = p_player_tag
       and tracking.status in ('INITIALIZING', 'ACTIVE', 'DEGRADED')
       and tracking.locked_by = btrim(p_worker_id)
       and tracking.locked_until > now()
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

    insert into public.advanced_stats_event_receipts (
        tracking_id, scope, event_fingerprint, event_at,
        source_cursor, source_watermark_at, source_watermark_key,
        bootstrap_import
    ) values (
        p_tracking_id, v_scope, p_event_fingerprint, v_event_at,
        p_source_cursor, v_watermark_at,
        coalesce(p_source_watermark_key, p_event_fingerprint),
        coalesce(p_bootstrap_import, false)
    )
    on conflict (tracking_id, scope, event_fingerprint) do nothing
    returning event_fingerprint into v_event_fingerprint;

    if not found then
        update public.advanced_stats_scope_state state
           set last_attempted_poll_at = coalesce(p_observed_at, now()),
               updated_at = now()
         where state.tracking_id = p_tracking_id and state.scope = v_scope;
        return jsonb_build_object(
            'inserted', false,
            'duplicate', true,
            'scope', v_scope,
            'eventFingerprint', p_event_fingerprint
        );
    end if;

    v_event_date := (v_event_at at time zone 'UTC')::date;
    for v_unit in select value from jsonb_array_elements(coalesce(p_units, '[]'::jsonb)) loop
        v_unit_key := nullif(btrim(v_unit->>'unit_key'), '');
        v_unit_name := nullif(btrim(v_unit->>'unit_name'), '');
        v_category := upper(btrim(coalesce(v_unit->>'category', '')));
        if v_unit_key is null or char_length(v_unit_key) > 96
           or v_unit_name is null or char_length(v_unit_name) > 128 then
            raise exception 'Invalid Advanced Stats compact unit identity';
        end if;
        if v_category not in (
            'TROOP', 'SPELL', 'SIEGE', 'SUPER_TROOP',
            'CLAN_CASTLE_TROOP', 'CLAN_CASTLE_SPELL', 'HERO', 'PET', 'EQUIPMENT'
        ) then
            raise exception 'Unsupported Advanced Stats unit category: %', v_category;
        end if;
        if coalesce((v_unit->>'quantity')::bigint, 0) <= 0 then
            raise exception 'Advanced Stats compact unit quantity must be positive';
        end if;

        insert into public.advanced_stats_scope_unit_daily (
            tracking_id, scope, stat_date, unit_key, unit_name, category,
            total_quantity, battles_present
        ) values (
            p_tracking_id, v_scope, v_event_date, v_unit_key, v_unit_name, v_category,
            (v_unit->>'quantity')::bigint, 1
        )
        on conflict (tracking_id, scope, stat_date, category, unit_key) do update
            set unit_name = excluded.unit_name,
                total_quantity = public.advanced_stats_scope_unit_daily.total_quantity + excluded.total_quantity,
                battles_present = public.advanced_stats_scope_unit_daily.battles_present + 1,
                updated_at = now();
    end loop;

    if p_army_hash is not null then
        insert into public.advanced_stats_scope_army_daily (
            tracking_id, scope, stat_date, army_hash, normalized_army_json,
            battle_count, total_stars, total_destruction
        ) values (
            p_tracking_id, v_scope, v_event_date, p_army_hash, p_normalized_army_json,
            1, greatest(coalesce(p_stars, 0), 0), greatest(coalesce(p_destruction_percentage, 0), 0)
        )
        on conflict (tracking_id, scope, stat_date, army_hash) do update
            set normalized_army_json = excluded.normalized_army_json,
                battle_count = public.advanced_stats_scope_army_daily.battle_count + 1,
                total_stars = public.advanced_stats_scope_army_daily.total_stars + excluded.total_stars,
                total_destruction = public.advanced_stats_scope_army_daily.total_destruction + excluded.total_destruction,
                updated_at = now();
    end if;

    insert into public.advanced_stats_scope_daily (
        tracking_id, scope, stat_date, attacks, total_stars, total_destruction,
        three_star_attacks, two_star_attacks, one_star_attacks, zero_star_attacks,
        gold_looted, elixir_looted, dark_elixir_looted
    ) values (
        p_tracking_id, v_scope, v_event_date, 1,
        greatest(coalesce(p_stars, 0), 0), greatest(coalesce(p_destruction_percentage, 0), 0),
        case when p_stars = 3 then 1 else 0 end,
        case when p_stars = 2 then 1 else 0 end,
        case when p_stars = 1 then 1 else 0 end,
        case when p_stars = 0 then 1 else 0 end,
        greatest(coalesce(p_loot_gold, 0), 0), greatest(coalesce(p_loot_elixir, 0), 0),
        greatest(coalesce(p_loot_dark_elixir, 0), 0)
    )
    on conflict (tracking_id, scope, stat_date) do update
        set attacks = public.advanced_stats_scope_daily.attacks + 1,
            total_stars = public.advanced_stats_scope_daily.total_stars + excluded.total_stars,
            total_destruction = public.advanced_stats_scope_daily.total_destruction + excluded.total_destruction,
            three_star_attacks = public.advanced_stats_scope_daily.three_star_attacks + excluded.three_star_attacks,
            two_star_attacks = public.advanced_stats_scope_daily.two_star_attacks + excluded.two_star_attacks,
            one_star_attacks = public.advanced_stats_scope_daily.one_star_attacks + excluded.one_star_attacks,
            zero_star_attacks = public.advanced_stats_scope_daily.zero_star_attacks + excluded.zero_star_attacks,
            gold_looted = public.advanced_stats_scope_daily.gold_looted + excluded.gold_looted,
            elixir_looted = public.advanced_stats_scope_daily.elixir_looted + excluded.elixir_looted,
            dark_elixir_looted = public.advanced_stats_scope_daily.dark_elixir_looted + excluded.dark_elixir_looted,
            updated_at = now();

    update public.advanced_stats_scope_state state
       set last_attempted_poll_at = coalesce(p_observed_at, now()),
           updated_at = now()
     where state.tracking_id = p_tracking_id and state.scope = v_scope;

    update public.advanced_stats_tracking
       set battles_processed = battles_processed + 1,
           updated_at = now()
     where id = p_tracking_id;

    return jsonb_build_object(
        'inserted', true,
        'duplicate', false,
        'scope', v_scope,
        'eventFingerprint', p_event_fingerprint,
        'eventDate', v_event_date
    );
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

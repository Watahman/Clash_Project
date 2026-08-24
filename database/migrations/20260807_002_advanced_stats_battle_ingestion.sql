-- Transactional Advanced Stats battle ingestion.
-- A battle is the atomic unit: dedupe + detail rows + all aggregates commit together.

create or replace function public.save_advanced_stats_battle_v1(
    p_tracking_id uuid,
    p_player_tag text,
    p_battle_fingerprint text,
    p_battle_timestamp timestamptz,
    p_observed_at timestamptz,
    p_battle_type text,
    p_opponent_player_tag text,
    p_opponent_name text,
    p_opponent_town_hall integer,
    p_player_town_hall integer,
    p_stars smallint,
    p_destruction_percentage numeric,
    p_army_share_code text,
    p_army_data_available boolean,
    p_loot_gold bigint,
    p_loot_elixir bigint,
    p_loot_dark_elixir bigint,
    p_bootstrap_import boolean,
    p_parser_version integer,
    p_units jsonb,
    p_army_hash text,
    p_normalized_army_json jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_battle_id uuid;
    v_existing_status text;
    v_reprocessed boolean := false;
    v_unit jsonb;
    v_seen_at timestamptz := coalesce(p_battle_timestamp, p_observed_at, now());
    v_stat_date date;
begin
    if p_tracking_id is null or p_player_tag is null or p_battle_fingerprint is null then
        raise exception 'Missing required Advanced Stats battle identity';
    end if;
    if length(p_battle_fingerprint) <> 64 then
        raise exception 'Invalid Advanced Stats battle fingerprint';
    end if;
    if not exists (
        select 1
          from public.advanced_stats_tracking tracking
         where tracking.id = p_tracking_id
           and tracking.player_tag = p_player_tag
    ) then
        raise exception 'Advanced Stats tracking row does not match player';
    end if;

    insert into public.advanced_stats_battles (
        tracking_id,
        player_tag,
        battle_fingerprint,
        battle_timestamp,
        battle_type,
        is_attack,
        opponent_player_tag,
        opponent_name,
        opponent_town_hall,
        player_town_hall,
        stars,
        destruction_percentage,
        army_share_code,
        army_data_available,
        loot_gold,
        loot_elixir,
        loot_dark_elixir,
        bootstrap_import,
        processing_status,
        parser_version,
        observed_at
    ) values (
        p_tracking_id,
        p_player_tag,
        p_battle_fingerprint,
        p_battle_timestamp,
        nullif(p_battle_type, ''),
        true,
        nullif(p_opponent_player_tag, ''),
        nullif(p_opponent_name, ''),
        p_opponent_town_hall,
        p_player_town_hall,
        p_stars,
        p_destruction_percentage,
        nullif(p_army_share_code, ''),
        coalesce(p_army_data_available, false),
        greatest(coalesce(p_loot_gold, 0), 0),
        greatest(coalesce(p_loot_elixir, 0), 0),
        greatest(coalesce(p_loot_dark_elixir, 0), 0),
        coalesce(p_bootstrap_import, false),
        'PENDING',
        greatest(coalesce(p_parser_version, 1), 1),
        coalesce(p_observed_at, now())
    )
    on conflict (tracking_id, battle_fingerprint) do nothing
    returning id into v_battle_id;

    if v_battle_id is null then
        select battle.id, battle.processing_status
          into v_battle_id, v_existing_status
          from public.advanced_stats_battles battle
         where battle.tracking_id = p_tracking_id
           and battle.battle_fingerprint = p_battle_fingerprint
         for update;

        if v_existing_status <> 'PARSER_ERROR' then
            return jsonb_build_object('inserted', false, 'reprocessed', false);
        end if;

        v_reprocessed := true;
        delete from public.advanced_stats_battle_units where battle_id = v_battle_id;
        update public.advanced_stats_battles
           set battle_timestamp = p_battle_timestamp,
               battle_type = nullif(p_battle_type, ''),
               opponent_player_tag = nullif(p_opponent_player_tag, ''),
               opponent_name = nullif(p_opponent_name, ''),
               opponent_town_hall = p_opponent_town_hall,
               player_town_hall = p_player_town_hall,
               stars = p_stars,
               destruction_percentage = p_destruction_percentage,
               army_share_code = nullif(p_army_share_code, ''),
               army_data_available = coalesce(p_army_data_available, false),
               loot_gold = greatest(coalesce(p_loot_gold, 0), 0),
               loot_elixir = greatest(coalesce(p_loot_elixir, 0), 0),
               loot_dark_elixir = greatest(coalesce(p_loot_dark_elixir, 0), 0),
               bootstrap_import = coalesce(p_bootstrap_import, false),
               processing_status = 'PENDING',
               parser_version = greatest(coalesce(p_parser_version, 1), 1),
               processed_at = null,
               observed_at = least(observed_at, coalesce(p_observed_at, now()))
         where id = v_battle_id;
    end if;

    for v_unit in
        select value from jsonb_array_elements(coalesce(p_units, '[]'::jsonb))
    loop
        if coalesce((v_unit->>'quantity')::integer, 0) <= 0 then
            raise exception 'Advanced Stats unit quantity must be positive';
        end if;

        insert into public.advanced_stats_battle_units (
            battle_id,
            unit_key,
            unit_name,
            category,
            quantity,
            unit_level
        ) values (
            v_battle_id,
            v_unit->>'unit_key',
            v_unit->>'unit_name',
            v_unit->>'category',
            (v_unit->>'quantity')::integer,
            nullif(v_unit->>'unit_level', '')::integer
        );

        insert into public.advanced_stats_unit_totals (
            tracking_id,
            unit_key,
            unit_name,
            category,
            total_quantity,
            battles_present,
            first_seen_at,
            last_seen_at
        ) values (
            p_tracking_id,
            v_unit->>'unit_key',
            v_unit->>'unit_name',
            v_unit->>'category',
            (v_unit->>'quantity')::integer,
            1,
            v_seen_at,
            v_seen_at
        )
        on conflict (tracking_id, category, unit_key) do update
            set unit_name = excluded.unit_name,
                total_quantity = public.advanced_stats_unit_totals.total_quantity + excluded.total_quantity,
                battles_present = public.advanced_stats_unit_totals.battles_present + 1,
                first_seen_at = least(public.advanced_stats_unit_totals.first_seen_at, excluded.first_seen_at),
                last_seen_at = greatest(public.advanced_stats_unit_totals.last_seen_at, excluded.last_seen_at),
                updated_at = now();
    end loop;

    if coalesce(p_army_data_available, false)
       and p_army_hash is not null
       and length(p_army_hash) = 64
       and p_normalized_army_json is not null then
        insert into public.advanced_stats_army_totals (
            tracking_id,
            army_hash,
            normalized_army_json,
            battle_count,
            total_stars,
            total_destruction,
            first_seen_at,
            last_seen_at
        ) values (
            p_tracking_id,
            p_army_hash,
            p_normalized_army_json,
            1,
            greatest(coalesce(p_stars, 0), 0),
            greatest(coalesce(p_destruction_percentage, 0), 0),
            v_seen_at,
            v_seen_at
        )
        on conflict (tracking_id, army_hash) do update
            set normalized_army_json = excluded.normalized_army_json,
                battle_count = public.advanced_stats_army_totals.battle_count + 1,
                total_stars = public.advanced_stats_army_totals.total_stars + excluded.total_stars,
                total_destruction = public.advanced_stats_army_totals.total_destruction + excluded.total_destruction,
                first_seen_at = least(public.advanced_stats_army_totals.first_seen_at, excluded.first_seen_at),
                last_seen_at = greatest(public.advanced_stats_army_totals.last_seen_at, excluded.last_seen_at),
                updated_at = now();
    end if;

    v_stat_date := (v_seen_at at time zone 'UTC')::date;
    insert into public.advanced_stats_daily (
        tracking_id,
        stat_date,
        attacks,
        total_stars,
        total_destruction,
        three_star_attacks,
        two_star_attacks,
        one_star_attacks,
        zero_star_attacks,
        gold_looted,
        elixir_looted,
        dark_elixir_looted
    ) values (
        p_tracking_id,
        v_stat_date,
        1,
        greatest(coalesce(p_stars, 0), 0),
        greatest(coalesce(p_destruction_percentage, 0), 0),
        case when p_stars = 3 then 1 else 0 end,
        case when p_stars = 2 then 1 else 0 end,
        case when p_stars = 1 then 1 else 0 end,
        case when p_stars = 0 then 1 else 0 end,
        greatest(coalesce(p_loot_gold, 0), 0),
        greatest(coalesce(p_loot_elixir, 0), 0),
        greatest(coalesce(p_loot_dark_elixir, 0), 0)
    )
    on conflict (tracking_id, stat_date) do update
        set attacks = public.advanced_stats_daily.attacks + 1,
            total_stars = public.advanced_stats_daily.total_stars + excluded.total_stars,
            total_destruction = public.advanced_stats_daily.total_destruction + excluded.total_destruction,
            three_star_attacks = public.advanced_stats_daily.three_star_attacks + excluded.three_star_attacks,
            two_star_attacks = public.advanced_stats_daily.two_star_attacks + excluded.two_star_attacks,
            one_star_attacks = public.advanced_stats_daily.one_star_attacks + excluded.one_star_attacks,
            zero_star_attacks = public.advanced_stats_daily.zero_star_attacks + excluded.zero_star_attacks,
            gold_looted = public.advanced_stats_daily.gold_looted + excluded.gold_looted,
            elixir_looted = public.advanced_stats_daily.elixir_looted + excluded.elixir_looted,
            dark_elixir_looted = public.advanced_stats_daily.dark_elixir_looted + excluded.dark_elixir_looted,
            updated_at = now();

    update public.advanced_stats_battles
       set processing_status = 'PROCESSED',
           processed_at = now()
     where id = v_battle_id;

    update public.advanced_stats_tracking
       set battles_processed = battles_processed + 1,
           updated_at = now()
     where id = p_tracking_id;

    return jsonb_build_object(
        'inserted', true,
        'reprocessed', v_reprocessed,
        'battleId', v_battle_id
    );
end;
$$;

create or replace function public.record_advanced_stats_parser_error_v1(
    p_tracking_id uuid,
    p_player_tag text,
    p_battle_fingerprint text,
    p_battle_timestamp timestamptz,
    p_observed_at timestamptz,
    p_battle_type text,
    p_opponent_player_tag text,
    p_opponent_name text,
    p_opponent_town_hall integer,
    p_player_town_hall integer,
    p_stars smallint,
    p_destruction_percentage numeric,
    p_army_share_code text,
    p_loot_gold bigint,
    p_loot_elixir bigint,
    p_loot_dark_elixir bigint,
    p_bootstrap_import boolean,
    p_parser_version integer
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_battle_id uuid;
begin
    if not exists (
        select 1
          from public.advanced_stats_tracking tracking
         where tracking.id = p_tracking_id
           and tracking.player_tag = p_player_tag
    ) then
        raise exception 'Advanced Stats tracking row does not match player';
    end if;

    insert into public.advanced_stats_battles (
        tracking_id,
        player_tag,
        battle_fingerprint,
        battle_timestamp,
        battle_type,
        is_attack,
        opponent_player_tag,
        opponent_name,
        opponent_town_hall,
        player_town_hall,
        stars,
        destruction_percentage,
        army_share_code,
        army_data_available,
        loot_gold,
        loot_elixir,
        loot_dark_elixir,
        bootstrap_import,
        processing_status,
        parser_version,
        observed_at
    ) values (
        p_tracking_id,
        p_player_tag,
        p_battle_fingerprint,
        p_battle_timestamp,
        nullif(p_battle_type, ''),
        true,
        nullif(p_opponent_player_tag, ''),
        nullif(p_opponent_name, ''),
        p_opponent_town_hall,
        p_player_town_hall,
        p_stars,
        p_destruction_percentage,
        nullif(p_army_share_code, ''),
        false,
        greatest(coalesce(p_loot_gold, 0), 0),
        greatest(coalesce(p_loot_elixir, 0), 0),
        greatest(coalesce(p_loot_dark_elixir, 0), 0),
        coalesce(p_bootstrap_import, false),
        'PARSER_ERROR',
        greatest(coalesce(p_parser_version, 1), 1),
        coalesce(p_observed_at, now())
    )
    on conflict (tracking_id, battle_fingerprint) do nothing
    returning id into v_battle_id;

    return jsonb_build_object(
        'inserted', v_battle_id is not null,
        'battleId', v_battle_id
    );
end;
$$;

revoke all on function public.save_advanced_stats_battle_v1(
    uuid, text, text, timestamptz, timestamptz, text, text, text, integer, integer,
    smallint, numeric, text, boolean, bigint, bigint, bigint, boolean, integer, jsonb, text, jsonb
) from public, anon, authenticated;
grant execute on function public.save_advanced_stats_battle_v1(
    uuid, text, text, timestamptz, timestamptz, text, text, text, integer, integer,
    smallint, numeric, text, boolean, bigint, bigint, bigint, boolean, integer, jsonb, text, jsonb
) to service_role;

revoke all on function public.record_advanced_stats_parser_error_v1(
    uuid, text, text, timestamptz, timestamptz, text, text, text, integer, integer,
    smallint, numeric, text, bigint, bigint, bigint, boolean, integer
) from public, anon, authenticated;
grant execute on function public.record_advanced_stats_parser_error_v1(
    uuid, text, text, timestamptz, timestamptz, text, text, text, integer, integer,
    smallint, numeric, text, bigint, bigint, bigint, boolean, integer
) to service_role;

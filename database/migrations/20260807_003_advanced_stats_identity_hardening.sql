-- Persist available-loot identity fields used by the timestamp-less battle-log dedupe.
-- V2 wrappers keep the proven V1 ingestion transaction and extend it atomically.

alter table public.advanced_stats_battles
    add column if not exists available_gold bigint
        check (available_gold is null or available_gold >= 0),
    add column if not exists available_elixir bigint
        check (available_elixir is null or available_elixir >= 0),
    add column if not exists available_dark_elixir bigint
        check (available_dark_elixir is null or available_dark_elixir >= 0);

create or replace function public.save_advanced_stats_battle_v2(
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
    p_available_gold bigint,
    p_available_elixir bigint,
    p_available_dark_elixir bigint,
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
    v_result jsonb;
    v_battle_id uuid;
begin
    v_result := public.save_advanced_stats_battle_v1(
        p_tracking_id,
        p_player_tag,
        p_battle_fingerprint,
        p_battle_timestamp,
        p_observed_at,
        p_battle_type,
        p_opponent_player_tag,
        p_opponent_name,
        p_opponent_town_hall,
        p_player_town_hall,
        p_stars,
        p_destruction_percentage,
        p_army_share_code,
        p_army_data_available,
        p_loot_gold,
        p_loot_elixir,
        p_loot_dark_elixir,
        p_bootstrap_import,
        p_parser_version,
        p_units,
        p_army_hash,
        p_normalized_army_json
    );

    if coalesce((v_result->>'inserted')::boolean, false) then
        v_battle_id := nullif(v_result->>'battleId', '')::uuid;
        update public.advanced_stats_battles
           set available_gold = greatest(coalesce(p_available_gold, 0), 0),
               available_elixir = greatest(coalesce(p_available_elixir, 0), 0),
               available_dark_elixir = greatest(coalesce(p_available_dark_elixir, 0), 0)
         where id = v_battle_id;
    end if;

    return v_result;
end;
$$;

create or replace function public.record_advanced_stats_parser_error_v2(
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
    p_available_gold bigint,
    p_available_elixir bigint,
    p_available_dark_elixir bigint,
    p_bootstrap_import boolean,
    p_parser_version integer
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_result jsonb;
    v_battle_id uuid;
begin
    v_result := public.record_advanced_stats_parser_error_v1(
        p_tracking_id,
        p_player_tag,
        p_battle_fingerprint,
        p_battle_timestamp,
        p_observed_at,
        p_battle_type,
        p_opponent_player_tag,
        p_opponent_name,
        p_opponent_town_hall,
        p_player_town_hall,
        p_stars,
        p_destruction_percentage,
        p_army_share_code,
        p_loot_gold,
        p_loot_elixir,
        p_loot_dark_elixir,
        p_bootstrap_import,
        p_parser_version
    );

    if coalesce((v_result->>'inserted')::boolean, false) then
        v_battle_id := nullif(v_result->>'battleId', '')::uuid;
        update public.advanced_stats_battles
           set available_gold = greatest(coalesce(p_available_gold, 0), 0),
               available_elixir = greatest(coalesce(p_available_elixir, 0), 0),
               available_dark_elixir = greatest(coalesce(p_available_dark_elixir, 0), 0)
         where id = v_battle_id;
    end if;

    return v_result;
end;
$$;

revoke all on function public.save_advanced_stats_battle_v2(
    uuid, text, text, timestamptz, timestamptz, text, text, text, integer, integer,
    smallint, numeric, text, boolean, bigint, bigint, bigint, bigint, bigint, bigint,
    boolean, integer, jsonb, text, jsonb
) from public, anon, authenticated;
grant execute on function public.save_advanced_stats_battle_v2(
    uuid, text, text, timestamptz, timestamptz, text, text, text, integer, integer,
    smallint, numeric, text, boolean, bigint, bigint, bigint, bigint, bigint, bigint,
    boolean, integer, jsonb, text, jsonb
) to service_role;

revoke all on function public.record_advanced_stats_parser_error_v2(
    uuid, text, text, timestamptz, timestamptz, text, text, text, integer, integer,
    smallint, numeric, text, bigint, bigint, bigint, bigint, bigint, bigint, boolean, integer
) from public, anon, authenticated;
grant execute on function public.record_advanced_stats_parser_error_v2(
    uuid, text, text, timestamptz, timestamptz, text, text, text, integer, integer,
    smallint, numeric, text, bigint, bigint, bigint, bigint, bigint, bigint, boolean, integer
) to service_role;

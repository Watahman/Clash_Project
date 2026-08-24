-- Fence collector writes with the lease claimed for the current poll, and keep
-- destructive deletion aligned with the complete Advanced Stats metric set.

create or replace function public.save_advanced_stats_battle_v4(
    p_tracking_id uuid, p_player_tag text, p_battle_fingerprint text,
    p_battle_timestamp timestamptz, p_observed_at timestamptz, p_battle_type text,
    p_opponent_player_tag text, p_opponent_name text, p_opponent_town_hall integer,
    p_player_town_hall integer, p_stars smallint, p_destruction_percentage numeric,
    p_army_share_code text, p_army_data_available boolean,
    p_loot_gold bigint, p_loot_elixir bigint, p_loot_dark_elixir bigint,
    p_available_gold bigint, p_available_elixir bigint, p_available_dark_elixir bigint,
    p_bootstrap_import boolean, p_parser_version integer, p_units jsonb,
    p_army_hash text, p_normalized_army_json jsonb, p_worker_id text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    perform 1 from public.advanced_stats_tracking t
     where t.id = p_tracking_id
       and t.player_tag = p_player_tag
       and t.status in ('INITIALIZING', 'ACTIVE', 'DEGRADED')
       and t.locked_by = btrim(p_worker_id)
       and t.locked_until > now()
     for update;
    if not found then
        raise exception 'advanced stats poll lease is no longer active';
    end if;

    return public.save_advanced_stats_battle_v3(
        p_tracking_id, p_player_tag, p_battle_fingerprint, p_battle_timestamp,
        p_observed_at, p_battle_type, p_opponent_player_tag, p_opponent_name,
        p_opponent_town_hall, p_player_town_hall, p_stars,
        p_destruction_percentage, p_army_share_code, p_army_data_available,
        p_loot_gold, p_loot_elixir, p_loot_dark_elixir, p_available_gold,
        p_available_elixir, p_available_dark_elixir, p_bootstrap_import,
        p_parser_version, p_units, p_army_hash, p_normalized_army_json
    );
end;
$$;

create or replace function public.record_advanced_stats_parser_error_v3(
    p_tracking_id uuid, p_player_tag text, p_battle_fingerprint text,
    p_battle_timestamp timestamptz, p_observed_at timestamptz, p_battle_type text,
    p_opponent_player_tag text, p_opponent_name text, p_opponent_town_hall integer,
    p_player_town_hall integer, p_stars smallint, p_destruction_percentage numeric,
    p_army_share_code text, p_loot_gold bigint, p_loot_elixir bigint,
    p_loot_dark_elixir bigint, p_available_gold bigint, p_available_elixir bigint,
    p_available_dark_elixir bigint, p_bootstrap_import boolean,
    p_parser_version integer, p_worker_id text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    perform 1 from public.advanced_stats_tracking t
     where t.id = p_tracking_id
       and t.player_tag = p_player_tag
       and t.status in ('INITIALIZING', 'ACTIVE', 'DEGRADED')
       and t.locked_by = btrim(p_worker_id)
       and t.locked_until > now()
     for update;
    if not found then
        raise exception 'advanced stats poll lease is no longer active';
    end if;

    return public.record_advanced_stats_parser_error_v2(
        p_tracking_id, p_player_tag, p_battle_fingerprint, p_battle_timestamp,
        p_observed_at, p_battle_type, p_opponent_player_tag, p_opponent_name,
        p_opponent_town_hall, p_player_town_hall, p_stars,
        p_destruction_percentage, p_army_share_code, p_loot_gold,
        p_loot_elixir, p_loot_dark_elixir, p_available_gold,
        p_available_elixir, p_available_dark_elixir, p_bootstrap_import,
        p_parser_version
    );
end;
$$;

create or replace function public.delete_advanced_stats_tracking_v1(
    p_user_id uuid, p_player_tag text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_tracking_id uuid;
    v_achievement_rows integer := 0;
begin
    if p_user_id is null or p_player_tag is null or btrim(p_player_tag) = '' then
        raise exception 'Missing required Advanced Stats delete identity';
    end if;

    -- Lock/delete the tracker first. The row lock serializes this operation with
    -- the guarded ingestion functions, so no collector write can cross deletion.
    delete from public.advanced_stats_tracking
     where user_id = p_user_id and player_tag = p_player_tag
    returning id into v_tracking_id;

    delete from public.achievement_progress
     where user_id = p_user_id
       and player_tag = p_player_tag
       and metric in (
           'tracked_attack_count', 'tracked_star_count', 'tracked_three_star_count',
           'tracked_two_star_count', 'tracked_one_star_count', 'tracked_zero_star_count',
           'tracked_gold_looted', 'tracked_elixir_looted',
           'tracked_dark_elixir_looted', 'tracked_active_days'
       );
    get diagnostics v_achievement_rows = row_count;

    return jsonb_build_object(
        'deleted', v_tracking_id is not null,
        'trackingId', v_tracking_id,
        'achievementRowsDeleted', v_achievement_rows
    );
end;
$$;

revoke all on function public.save_advanced_stats_battle_v4(
    uuid,text,text,timestamptz,timestamptz,text,text,text,integer,integer,
    smallint,numeric,text,boolean,bigint,bigint,bigint,bigint,bigint,bigint,
    boolean,integer,jsonb,text,jsonb,text
) from public, anon, authenticated;
grant execute on function public.save_advanced_stats_battle_v4(
    uuid,text,text,timestamptz,timestamptz,text,text,text,integer,integer,
    smallint,numeric,text,boolean,bigint,bigint,bigint,bigint,bigint,bigint,
    boolean,integer,jsonb,text,jsonb,text
) to service_role;

revoke all on function public.record_advanced_stats_parser_error_v3(
    uuid,text,text,timestamptz,timestamptz,text,text,text,integer,integer,
    smallint,numeric,text,bigint,bigint,bigint,bigint,bigint,bigint,boolean,integer,text
) from public, anon, authenticated;
grant execute on function public.record_advanced_stats_parser_error_v3(
    uuid,text,text,timestamptz,timestamptz,text,text,text,integer,integer,
    smallint,numeric,text,bigint,bigint,bigint,bigint,bigint,bigint,boolean,integer,text
) to service_role;

revoke all on function public.delete_advanced_stats_tracking_v1(uuid,text)
    from public, anon, authenticated;
grant execute on function public.delete_advanced_stats_tracking_v1(uuid,text)
    to service_role;

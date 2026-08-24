-- Transactional smoke test for the deployed Advanced Stats/Achievements database contract.
-- Uses a synthetic user and rolls every write back. Any failed assertion aborts the script.

begin;

do $$
declare
    v_user uuid := gen_random_uuid();
    v_tracking uuid;
    v_first jsonb;
    v_duplicate jsonb;
    v_reconcile jsonb;
    v_count bigint;
    v_value bigint;
    v_progress bigint;
    v_unlocked boolean;
begin
    insert into public.users (id, name, email, accounts, code)
    values (
        v_user,
        'Advanced Stats base smoke test',
        'advanced-stats-base-' || v_user || '@example.invalid',
        '[]'::jsonb,
        'ASB' || replace(v_user::text, '-', '')
    );

    insert into public.advanced_stats_tracking (
        user_id, player_tag, player_name, town_hall_level, status, tracking_started_at, next_poll_at
    ) values (
        v_user, '#P0Y2', 'Advanced Stats Smoke Test', 17, 'ACTIVE', now(), now()
    ) returning id into v_tracking;

    v_first := public.save_advanced_stats_battle_v3(
        v_tracking,
        '#P0Y2',
        repeat('f', 64),
        now() - interval '1 minute',
        now(),
        'multiplayer',
        '#Q8G2',
        'Synthetic Opponent',
        17,
        17,
        3::smallint,
        100::numeric,
        'synthetic-army-share',
        true,
        1000000,
        1000000,
        10000,
        2000000,
        2000000,
        20000,
        false,
        1,
        jsonb_build_array(jsonb_build_object(
            'unit_key', 'troop-4000000',
            'unit_name', 'Barbarian',
            'category', 'TROOP',
            'quantity', 2,
            'unit_level', 12
        )),
        repeat('a', 64),
        jsonb_build_object(
            'units', jsonb_build_array(jsonb_build_object('key', 'troop-4000000', 'quantity', 2))
        )
    );

    if coalesce((v_first->>'inserted')::boolean, false) is not true then
        raise exception 'First synthetic battle was not inserted: %', v_first;
    end if;

    v_duplicate := public.save_advanced_stats_battle_v3(
        v_tracking,
        '#P0Y2',
        repeat('f', 64),
        now() - interval '1 minute',
        now(),
        'multiplayer',
        '#Q8G2',
        'Synthetic Opponent',
        17,
        17,
        3::smallint,
        100::numeric,
        'synthetic-army-share',
        true,
        1000000,
        1000000,
        10000,
        2000000,
        2000000,
        20000,
        false,
        1,
        jsonb_build_array(jsonb_build_object(
            'unit_key', 'troop-4000000',
            'unit_name', 'Barbarian',
            'category', 'TROOP',
            'quantity', 2,
            'unit_level', 12
        )),
        repeat('a', 64),
        jsonb_build_object(
            'units', jsonb_build_array(jsonb_build_object('key', 'troop-4000000', 'quantity', 2))
        )
    );

    if coalesce((v_duplicate->>'inserted')::boolean, true) is not false then
        raise exception 'Duplicate synthetic battle was inserted twice: %', v_duplicate;
    end if;

    select count(*) into v_count
      from public.advanced_stats_battles
     where tracking_id = v_tracking;
    if v_count <> 1 then raise exception 'Expected 1 durable battle, got %', v_count; end if;

    select attacks into v_value
      from public.advanced_stats_daily
     where tracking_id = v_tracking;
    if v_value <> 1 then raise exception 'Expected daily attacks=1, got %', v_value; end if;

    select total_stars into v_value
      from public.advanced_stats_daily
     where tracking_id = v_tracking;
    if v_value <> 3 then raise exception 'Expected daily total_stars=3, got %', v_value; end if;

    select three_star_attacks into v_value
      from public.advanced_stats_daily
     where tracking_id = v_tracking;
    if v_value <> 1 then raise exception 'Expected daily three_star_attacks=1, got %', v_value; end if;

    select total_quantity into v_value
      from public.advanced_stats_unit_totals
     where tracking_id = v_tracking
       and category = 'TROOP'
       and unit_key = 'troop-4000000';
    if v_value <> 2 then raise exception 'Expected unit total_quantity=2, got %', v_value; end if;

    select battle_count into v_value
      from public.advanced_stats_army_totals
     where tracking_id = v_tracking
       and army_hash = repeat('a', 64);
    if v_value <> 1 then raise exception 'Expected army battle_count=1, got %', v_value; end if;

    select battles_processed into v_value
      from public.advanced_stats_tracking
     where id = v_tracking;
    if v_value <> 1 then raise exception 'Expected tracking battles_processed=1, got %', v_value; end if;

    v_reconcile := public.reconcile_advanced_stats_achievement_progress_v1(
        v_user,
        '#P0Y2',
        floor(extract(epoch from now()))::bigint,
        jsonb_build_array(jsonb_build_object(
            'achievement_key', 'smoke_test_battle_tracker',
            'family_key', 'battle_tracker',
            'title', 'Smoke Test Battle Tracker',
            'description', 'Synthetic rollback-only verification',
            'category', 'battle',
            'rarity', 'common',
            'tier', 1,
            'xp', 1,
            'metric', 'tracked_attack_count',
            'progress', 1,
            'target', 1,
            'unlocked', true
        ))
    );

    if coalesce((v_reconcile->>'rows')::integer, 0) <> 1 then
        raise exception 'Achievement reconcile wrote unexpected row count: %', v_reconcile;
    end if;

    select progress, unlocked
      into v_progress, v_unlocked
      from public.achievement_progress
     where user_id = v_user
       and player_tag = '#P0Y2'
       and achievement_key = 'smoke_test_battle_tracker'
       and tier = 1;

    if v_progress <> 1 or v_unlocked is not true then
        raise exception 'Achievement reconcile state invalid: progress=%, unlocked=%', v_progress, v_unlocked;
    end if;
end $$;

rollback;

select jsonb_build_object(
    'status', 'PASS',
    'persistence', 'ROLLBACK',
    'verified', jsonb_build_array(
        'battle ingestion',
        'duplicate idempotency',
        'daily aggregates',
        'unit aggregates',
        'army aggregates',
        'battles_processed',
        'achievement reconciliation'
    )
) as advanced_stats_database_smoke_test;

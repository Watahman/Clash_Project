-- Transactional Advanced Stats read-model verification.
-- Creates only synthetic rows and rolls all writes back.
-- Any failed assertion aborts the script.

begin;

do $$
declare
    v_user uuid := gen_random_uuid();
    v_tracking uuid;
    v_now timestamptz := date_trunc('second', now());
    v_result jsonb;
    v_overview jsonb;
    v_units jsonb;
    v_armies jsonb;
    v_page1 jsonb;
    v_page2 jsonb;
    v_trends jsonb;
    v_metrics jsonb;
    v_count integer;
    v_cursor_at timestamptz;
    v_cursor_id uuid;
    v_numeric numeric;
begin
    insert into public.users (id, name, email, accounts, code)
    values (
        v_user,
        'Advanced Stats read-model smoke test',
        'advanced-stats-read-' || v_user || '@example.invalid',
        '[]'::jsonb,
        'ASR' || replace(v_user::text, '-', '')
    );

    insert into public.advanced_stats_tracking (
        user_id, player_tag, player_name, status, tracking_started_at,
        bootstrap_completed_at, last_successful_poll_at, data_complete_since, next_poll_at
    ) values (
        v_user, '#P0Y2', 'Synthetic Player', 'ACTIVE', v_now - interval '120 days',
        v_now - interval '119 days', v_now, v_now - interval '120 days', v_now + interval '30 minutes'
    ) returning id into v_tracking;

    v_result := public.save_advanced_stats_battle_v3(
        v_tracking, '#P0Y2'::text, repeat('1',64), v_now - interval '100 days', v_now - interval '100 days',
        'multiplayer'::text, '#Q8G2'::text, 'Opponent 1'::text, 16, 17, 1::smallint, 50::numeric,
        'synthetic-army-1'::text, true, 100::bigint, 10::bigint, 1::bigint,
        1000::bigint, 100::bigint, 10::bigint, false, 1,
        '[{"unit_key":"troop-4000000","unit_name":"Barbarian","category":"TROOP","quantity":10,"unit_level":12}]'::jsonb,
        repeat('a',64), '{"units":[{"key":"troop-4000000","quantity":10}]}'::jsonb
    );
    if coalesce((v_result->>'inserted')::boolean,false) is not true then raise exception 'Battle 1 not inserted'; end if;

    v_result := public.save_advanced_stats_battle_v3(
        v_tracking, '#P0Y2'::text, repeat('2',64), v_now - interval '20 days', v_now - interval '20 days',
        'multiplayer'::text, '#Q8G2'::text, 'Opponent 2'::text, 16, 17, 2::smallint, 75::numeric,
        'synthetic-army-2'::text, true, 200::bigint, 20::bigint, 2::bigint,
        2000::bigint, 200::bigint, 20::bigint, false, 1,
        '[{"unit_key":"troop-4000001","unit_name":"Archer","category":"TROOP","quantity":20,"unit_level":12}]'::jsonb,
        repeat('b',64), '{"units":[{"key":"troop-4000001","quantity":20}]}'::jsonb
    );
    if coalesce((v_result->>'inserted')::boolean,false) is not true then raise exception 'Battle 2 not inserted'; end if;

    v_result := public.save_advanced_stats_battle_v3(
        v_tracking, '#P0Y2'::text, repeat('3',64), v_now - interval '5 days', v_now - interval '5 days',
        'multiplayer'::text, '#Q8G2'::text, 'Opponent 3'::text, 17, 17, 3::smallint, 100::numeric,
        'synthetic-army-3'::text, true, 300::bigint, 30::bigint, 3::bigint,
        3000::bigint, 300::bigint, 30::bigint, false, 1,
        '[{"unit_key":"troop-4000000","unit_name":"Barbarian","category":"TROOP","quantity":30,"unit_level":12}]'::jsonb,
        repeat('c',64), '{"units":[{"key":"troop-4000000","quantity":30}]}'::jsonb
    );
    if coalesce((v_result->>'inserted')::boolean,false) is not true then raise exception 'Battle 3 not inserted'; end if;

    v_result := public.save_advanced_stats_battle_v3(
        v_tracking, '#P0Y2'::text, repeat('4',64), null::timestamptz, v_now - interval '1 day',
        'multiplayer'::text, '#Q8G2'::text, 'Opponent 4'::text, 17, 17, 0::smallint, 25::numeric,
        'synthetic-army-4'::text, true, 400::bigint, 40::bigint, 4::bigint,
        4000::bigint, 400::bigint, 40::bigint, false, 1,
        '[{"unit_key":"troop-4000001","unit_name":"Archer","category":"TROOP","quantity":50,"unit_level":12}]'::jsonb,
        repeat('d',64), '{"units":[{"key":"troop-4000001","quantity":50}]}'::jsonb
    );
    if coalesce((v_result->>'inserted')::boolean,false) is not true then raise exception 'Battle 4 not inserted'; end if;

    v_result := public.save_advanced_stats_battle_v3(
        v_tracking, '#P0Y2'::text, repeat('3',64), v_now - interval '5 days', v_now,
        'multiplayer'::text, '#Q8G2'::text, 'Changed duplicate'::text, 17, 17, 0::smallint, 0::numeric,
        'changed'::text, true, 999999::bigint, 999999::bigint, 999999::bigint,
        0::bigint, 0::bigint, 0::bigint, false, 1, '[]'::jsonb,
        repeat('f',64), '{"units":[]}'::jsonb
    );
    if coalesce((v_result->>'inserted')::boolean,true) is not false then
        raise exception 'Duplicate battle unexpectedly inserted';
    end if;

    v_overview := public.read_advanced_stats_overview_v1(v_tracking, null);
    if (v_overview#>>'{summary,attacks}')::integer <> 4
       or (v_overview#>>'{summary,averageStars}')::numeric <> 1.50
       or (v_overview#>>'{summary,averageDestruction}')::numeric <> 62.50
       or (v_overview#>>'{summary,goldLooted}')::bigint <> 1000
       or v_overview#>>'{favorites,troop,name}' <> 'Archer' then
        raise exception 'All-time overview mismatch: %', v_overview;
    end if;

    v_overview := public.read_advanced_stats_overview_v1(v_tracking, v_now - interval '7 days');
    if (v_overview#>>'{summary,attacks}')::integer <> 2
       or (v_overview#>>'{summary,averageStars}')::numeric <> 1.50
       or (v_overview#>>'{summary,averageDestruction}')::numeric <> 62.50
       or (v_overview#>>'{summary,threeStarRate}')::numeric <> 50.00
       or (v_overview#>>'{summary,goldLooted}')::bigint <> 700 then
        raise exception '7d overview mismatch: %', v_overview;
    end if;

    v_overview := public.read_advanced_stats_overview_v1(v_tracking, v_now - interval '30 days');
    if (v_overview#>>'{summary,attacks}')::integer <> 3
       or (v_overview#>>'{summary,averageStars}')::numeric <> 1.67
       or (v_overview#>>'{summary,averageDestruction}')::numeric <> 66.67
       or (v_overview#>>'{summary,threeStarRate}')::numeric <> 33.33
       or (v_overview#>>'{summary,goldLooted}')::bigint <> 900 then
        raise exception '30d overview mismatch: %', v_overview;
    end if;

    v_units := public.read_advanced_stats_units_v1(v_tracking, null, 'TROOP');
    select count(*) into v_count from jsonb_array_elements(v_units);
    if v_count <> 2 then raise exception 'Expected 2 unit rows, got %', v_count; end if;
    select (x->>'totalQuantity')::numeric into v_numeric
      from jsonb_array_elements(v_units) x
     where x->>'name' = 'Archer';
    if v_numeric <> 70 then raise exception 'Expected Archer total 70, got %', v_numeric; end if;

    v_armies := public.read_advanced_stats_armies_v1(v_tracking, null, 20);
    if jsonb_array_length(v_armies) <> 4
       or (v_armies->0->>'armyHash') <> repeat('c',64) then
        raise exception 'Army ranking mismatch: %', v_armies;
    end if;

    v_page1 := public.read_advanced_stats_battles_v1(v_tracking, null, 2, null, null);
    if jsonb_array_length(v_page1->'items') <> 2
       or coalesce((v_page1->>'hasMore')::boolean,false) is not true
       or v_page1#>>'{items,0,opponentName}' <> 'Opponent 4'
       or v_page1#>>'{items,0,timestampSource}' <> 'OBSERVED'
       or v_page1#>>'{items,1,opponentName}' <> 'Opponent 3' then
        raise exception 'Battle page 1 mismatch: %', v_page1;
    end if;

    v_cursor_at := (v_page1->>'nextCursorAt')::timestamptz;
    v_cursor_id := (v_page1->>'nextCursorId')::uuid;
    v_page2 := public.read_advanced_stats_battles_v1(v_tracking, null, 2, v_cursor_at, v_cursor_id);
    if jsonb_array_length(v_page2->'items') <> 2
       or coalesce((v_page2->>'hasMore')::boolean,true) is not false
       or v_page2#>>'{items,0,opponentName}' <> 'Opponent 2'
       or v_page2#>>'{items,1,opponentName}' <> 'Opponent 1' then
        raise exception 'Battle page 2 mismatch: %', v_page2;
    end if;

    v_trends := public.read_advanced_stats_trends_v1(v_tracking, v_now - interval '7 days');
    if jsonb_array_length(v_trends) <> 2 then
        raise exception 'Expected two 7d trend buckets: %', v_trends;
    end if;
    select coalesce(sum((x->>'attacks')::integer),0) into v_count
      from jsonb_array_elements(v_trends) x;
    if v_count <> 2 then raise exception 'Expected two 7d trend attacks, got %', v_count; end if;

    v_metrics := public.read_advanced_stats_achievement_metrics_v1(v_tracking);
    if (v_metrics#>>'{metrics,tracked_attack_count}')::integer <> 4
       or (v_metrics#>>'{metrics,tracked_star_count}')::integer <> 6
       or (v_metrics#>>'{metrics,tracked_three_star_count}')::integer <> 1 then
        raise exception 'Achievement metrics mismatch: %', v_metrics;
    end if;

    v_result := public.record_advanced_stats_parser_error_v2(
        v_tracking, '#P0Y2'::text, repeat('5',64), v_now - interval '2 days', v_now - interval '2 days',
        'multiplayer'::text, '#Q8G2'::text, 'Parser Error Opponent'::text, 17, 17, 2::smallint, 80::numeric,
        'bad-army'::text, 500::bigint, 50::bigint, 5::bigint,
        5000::bigint, 500::bigint, 50::bigint, false, 1
    );
    if coalesce((v_result->>'inserted')::boolean,false) is not true then
        raise exception 'Parser-error row was not inserted';
    end if;
    v_overview := public.read_advanced_stats_overview_v1(v_tracking, null);
    if (v_overview#>>'{summary,attacks}')::integer <> 4 then
        raise exception 'Parser error mutated aggregates: %', v_overview;
    end if;

    v_result := public.save_advanced_stats_battle_v3(
        v_tracking, '#P0Y2'::text, repeat('5',64), v_now - interval '2 days', v_now - interval '2 days',
        'multiplayer'::text, '#Q8G2'::text, 'Parser Error Opponent'::text, 17, 17, 2::smallint, 80::numeric,
        'fixed-army'::text, true, 500::bigint, 50::bigint, 5::bigint,
        5000::bigint, 500::bigint, 50::bigint, false, 2,
        '[{"unit_key":"troop-4000000","unit_name":"Barbarian","category":"TROOP","quantity":15,"unit_level":12}]'::jsonb,
        repeat('e',64), '{"units":[{"key":"troop-4000000","quantity":15}]}'::jsonb
    );
    if coalesce((v_result->>'inserted')::boolean,false) is not true
       or coalesce((v_result->>'reprocessed')::boolean,false) is not true then
        raise exception 'Parser-error reprocess failed: %', v_result;
    end if;

    v_overview := public.read_advanced_stats_overview_v1(v_tracking, null);
    if (v_overview#>>'{summary,attacks}')::integer <> 5
       or (v_overview#>>'{summary,goldLooted}')::bigint <> 1500 then
        raise exception 'Reprocess aggregates mismatch: %', v_overview;
    end if;

    select count(*) into v_count
      from public.advanced_stats_battles
     where tracking_id = v_tracking
       and battle_fingerprint = repeat('5',64);
    if v_count <> 1 then raise exception 'Reprocess created duplicate durable battle'; end if;
end $$;

rollback;

select jsonb_build_object(
    'status', 'PASS',
    'persistence', 'ROLLBACK',
    'verified', jsonb_build_array(
        'overview periods',
        'unit ranking',
        'army ranking',
        'cursor pagination',
        'observed timestamp fallback',
        'exact trends',
        'achievement metrics',
        'duplicate idempotency',
        'parser-error reprocessing'
    )
) as advanced_stats_read_models_smoke_test;

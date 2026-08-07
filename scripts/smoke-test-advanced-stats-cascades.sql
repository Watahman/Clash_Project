-- Transactional Advanced Stats lifecycle/cascade verification.
-- Creates only synthetic rows and rolls all writes back.
-- Any failed assertion aborts the script.

begin;

do $$
declare
    v_user uuid := gen_random_uuid();
    v_t1 uuid;
    v_t2 uuid;
    v_now timestamptz := date_trunc('second', now());
    v_result jsonb;
    v_overview jsonb;
    v_count integer;
begin
    insert into public.users (id, name, email, accounts, code)
    values (
        v_user,
        'Advanced Stats cascade smoke test',
        'advanced-stats-cascade-' || v_user || '@example.invalid',
        '[]'::jsonb,
        'ASC' || replace(v_user::text, '-', '')
    );

    insert into public.advanced_stats_tracking (user_id, player_tag, status, tracking_started_at)
    values (v_user, '#P0Y2', 'ACTIVE', v_now - interval '1 day')
    returning id into v_t1;

    v_result := public.save_advanced_stats_battle_v3(
        v_t1, '#P0Y2'::text, repeat('6',64), v_now - interval '2 hours', v_now - interval '2 hours',
        'multiplayer'::text, '#Q8G2'::text, 'Cascade Opponent'::text, 16, 17, 3::smallint, 100::numeric,
        'cascade-army'::text, true, 100::bigint, 100::bigint, 10::bigint,
        1000::bigint, 1000::bigint, 100::bigint, false, 1,
        '[{"unit_key":"troop-4000000","unit_name":"Barbarian","category":"TROOP","quantity":10,"unit_level":12}]'::jsonb,
        repeat('a',64), '{"units":[{"key":"troop-4000000","quantity":10}]}'::jsonb
    );
    if coalesce((v_result->>'inserted')::boolean,false) is not true then
        raise exception 'Cascade fixture battle not inserted';
    end if;

    insert into public.advanced_stats_tracking_gaps (tracking_id, started_at, ended_at, reason)
    values (v_t1, v_now - interval '4 hours', v_now - interval '3 hours', 'USER_PAUSED');

    update public.advanced_stats_tracking
       set status='STOPPED', next_poll_at=null, locked_by=null, locked_until=null,
           gap_started_at=v_now, gap_reason='USER_PAUSED'
     where id=v_t1;

    v_overview := public.read_advanced_stats_overview_v1(v_t1, null);
    if (v_overview#>>'{summary,attacks}')::integer <> 1 then
        raise exception 'STOPPED tracker lost readable history: %', v_overview;
    end if;

    delete from public.advanced_stats_tracking where id=v_t1;
    select count(*) into v_count from public.advanced_stats_battles where tracking_id=v_t1;
    if v_count <> 0 then raise exception 'Tracking delete did not cascade battles'; end if;
    select count(*) into v_count from public.advanced_stats_daily where tracking_id=v_t1;
    if v_count <> 0 then raise exception 'Tracking delete did not cascade daily rows'; end if;
    select count(*) into v_count from public.advanced_stats_unit_totals where tracking_id=v_t1;
    if v_count <> 0 then raise exception 'Tracking delete did not cascade unit totals'; end if;
    select count(*) into v_count from public.advanced_stats_army_totals where tracking_id=v_t1;
    if v_count <> 0 then raise exception 'Tracking delete did not cascade army totals'; end if;
    select count(*) into v_count from public.advanced_stats_tracking_gaps where tracking_id=v_t1;
    if v_count <> 0 then raise exception 'Tracking delete did not cascade gaps'; end if;

    insert into public.advanced_stats_tracking (user_id, player_tag, status, tracking_started_at)
    values (v_user, '#Q8G2', 'ACTIVE', v_now - interval '1 day')
    returning id into v_t2;

    v_result := public.save_advanced_stats_battle_v3(
        v_t2, '#Q8G2'::text, repeat('7',64), v_now - interval '1 hour', v_now - interval '1 hour',
        'multiplayer'::text, '#P0Y2'::text, 'User Cascade Opponent'::text, 16, 17, 2::smallint, 80::numeric,
        'cascade-army-2'::text, false, 50::bigint, 50::bigint, 5::bigint,
        500::bigint, 500::bigint, 50::bigint, false, 1, '[]'::jsonb, null::text, null::jsonb
    );
    if coalesce((v_result->>'inserted')::boolean,false) is not true then
        raise exception 'User-cascade fixture battle not inserted';
    end if;

    delete from public.users where id=v_user;
    select count(*) into v_count from public.advanced_stats_tracking where id=v_t2;
    if v_count <> 0 then raise exception 'User delete did not cascade tracking'; end if;
    select count(*) into v_count from public.advanced_stats_battles where tracking_id=v_t2;
    if v_count <> 0 then raise exception 'User delete did not cascade battle history'; end if;
end $$;

rollback;

select jsonb_build_object(
    'status', 'PASS',
    'persistence', 'ROLLBACK',
    'verified', jsonb_build_array(
        'STOPPED preserves history',
        'tracking delete cascades',
        'user delete cascades'
    )
) as advanced_stats_cascade_smoke_test;

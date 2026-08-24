-- Transactional Advanced Stats 90-day period verification.
-- Creates only synthetic rows and rolls all writes back.

begin;

do $$
declare
    v_user uuid := gen_random_uuid();
    v_tracking uuid;
    v_now timestamptz := date_trunc('second', now());
    v_overview jsonb;
begin
    insert into public.users (id, name, email, accounts, code)
    values (
        v_user,
        'Advanced Stats 90d smoke test',
        'advanced-stats-90d-' || v_user || '@example.invalid',
        '[]'::jsonb,
        'AS9' || replace(v_user::text, '-', '')
    );
    insert into public.advanced_stats_tracking(user_id, player_tag, status)
    values (v_user, '#P0Y2', 'ACTIVE') returning id into v_tracking;

    perform public.save_advanced_stats_battle_v3(
        v_tracking, '#P0Y2'::text, repeat('8',64), v_now - interval '100 days', v_now - interval '100 days',
        'multiplayer'::text, '#Q8G2'::text, 'Older'::text, 17, 17, 1::smallint, 50::numeric,
        null::text, false, 1::bigint,1::bigint,1::bigint,1::bigint,1::bigint,1::bigint,
        false,1,'[]'::jsonb,null::text,null::jsonb
    );
    perform public.save_advanced_stats_battle_v3(
        v_tracking, '#P0Y2'::text, repeat('9',64), v_now - interval '80 days', v_now - interval '80 days',
        'multiplayer'::text, '#Q8G2'::text, 'Inside 90d'::text, 17, 17, 2::smallint, 70::numeric,
        null::text, false, 2::bigint,2::bigint,2::bigint,2::bigint,2::bigint,2::bigint,
        false,1,'[]'::jsonb,null::text,null::jsonb
    );
    perform public.save_advanced_stats_battle_v3(
        v_tracking, '#P0Y2'::text, repeat('a',64), v_now - interval '20 days', v_now - interval '20 days',
        'multiplayer'::text, '#Q8G2'::text, 'Recent'::text, 17, 17, 3::smallint, 90::numeric,
        null::text, false, 3::bigint,3::bigint,3::bigint,3::bigint,3::bigint,3::bigint,
        false,1,'[]'::jsonb,null::text,null::jsonb
    );

    v_overview := public.read_advanced_stats_overview_v1(v_tracking, v_now - interval '90 days');
    if (v_overview#>>'{summary,attacks}')::integer <> 2
       or (v_overview#>>'{summary,averageStars}')::numeric <> 2.50
       or (v_overview#>>'{summary,goldLooted}')::bigint <> 5 then
        raise exception '90d overview mismatch: %', v_overview;
    end if;
end $$;

rollback;

select jsonb_build_object(
    'status', 'PASS',
    'persistence', 'ROLLBACK',
    'verified', jsonb_build_array('90-day read period')
) as advanced_stats_90d_smoke_test;

-- Transactional proof that pause/stop fences already-issued collector leases.
begin;

do $$
declare
    v_user uuid := gen_random_uuid();
    v_tracking uuid;
    v_now timestamptz := date_trunc('second', now());
    v_count integer;
begin
    insert into public.users (id, name, email, accounts, code)
    values (v_user, 'Advanced Stats fence smoke test',
            'advanced-stats-fence-' || v_user || '@example.invalid', '[]'::jsonb,
            'ASF' || replace(v_user::text, '-', ''));

    insert into public.advanced_stats_tracking (
        user_id, player_tag, status, tracking_started_at, locked_by, locked_until
    ) values (
        v_user, '#P0Y2', 'ACTIVE', v_now, 'worker-one', v_now + interval '5 minutes'
    ) returning id into v_tracking;

    perform public.save_advanced_stats_battle_v4(
        v_tracking, '#P0Y2', repeat('8',64), v_now, v_now, 'multiplayer',
        '#Q8G2', 'Fence Opponent', 16, 17, 3::smallint, 100::numeric, '', false,
        1, 1, 1, 1, 1, 1, false, 1, '[]'::jsonb, null, null, 'worker-one'
    );

    update public.advanced_stats_tracking
       set status='PAUSED', locked_by=null, locked_until=null, next_poll_at=null
     where id=v_tracking;

    begin
        perform public.save_advanced_stats_battle_v4(
            v_tracking, '#P0Y2', repeat('9',64), v_now, v_now, 'multiplayer',
            '#Q8G2', 'Late Opponent', 16, 17, 3::smallint, 100::numeric, '', false,
            1, 1, 1, 1, 1, 1, false, 1, '[]'::jsonb, null, null, 'worker-one'
        );
        raise exception 'Paused tracker accepted an in-flight collector write';
    exception
        when others then
            if sqlerrm = 'Paused tracker accepted an in-flight collector write' then raise; end if;
            if position('poll lease is no longer active' in sqlerrm) = 0 then raise; end if;
    end;

    select count(*) into v_count from public.advanced_stats_battles where tracking_id=v_tracking;
    if v_count <> 1 then
        raise exception 'Lifecycle fence changed persisted battle count: %', v_count;
    end if;
end $$;

rollback;

select jsonb_build_object(
    'status', 'PASS', 'persistence', 'ROLLBACK',
    'verified', 'pause fences in-flight collector writes'
) as advanced_stats_lifecycle_fence_smoke_test;

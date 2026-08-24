-- Transactional Advanced Stats scheduler/state-machine verification.
-- Creates only synthetic rows and rolls all writes back.
-- Any failed assertion aborts the script.

begin;

do $$
declare
    v_user uuid := gen_random_uuid();
    v_lease_tracking uuid;
    v_failure_tracking uuid;
    v_now timestamptz := date_trunc('second', now());
    v_count integer;
    v_status text;
    v_failures integer;
    v_gap_started timestamptz;
    v_gap_reason text;
    v_locked_by text;
    v_data_complete timestamptz;
begin
    insert into public.users (id, name, email, accounts, code)
    values (
        v_user,
        'Advanced Stats state-machine smoke test',
        'advanced-stats-state-' || v_user || '@example.invalid',
        '[]'::jsonb,
        'ASS' || replace(v_user::text, '-', '')
    );

    insert into public.advanced_stats_tracking (
        user_id, player_tag, status, tracking_started_at, next_poll_at
    ) values (
        v_user, '#P0Y2', 'ACTIVE', v_now - interval '1 day', v_now - interval '1 minute'
    ) returning id into v_lease_tracking;

    select count(*) into v_count
      from public.claim_advanced_stats_trackers_v1('worker-a', v_now, 1, 120);
    if v_count <> 1 then
        raise exception 'First worker claimed %, expected 1', v_count;
    end if;

    select count(*) into v_count
      from public.claim_advanced_stats_trackers_v1('worker-b', v_now, 1, 120);
    if v_count <> 0 then
        raise exception 'Second worker claimed %, expected 0 while lease is active', v_count;
    end if;

    update public.advanced_stats_tracking
       set locked_until = v_now - interval '1 second'
     where id = v_lease_tracking;

    select count(*) into v_count
      from public.claim_advanced_stats_trackers_v1('worker-b', v_now, 1, 120);
    if v_count <> 1 then
        raise exception 'Expired lease reclaim returned %, expected 1', v_count;
    end if;

    select gap_started_at, gap_reason, locked_by
      into v_gap_started, v_gap_reason, v_locked_by
      from public.advanced_stats_tracking
     where id = v_lease_tracking;
    if v_gap_started is null or v_gap_reason <> 'WORKER_OUTAGE' or v_locked_by <> 'worker-b' then
        raise exception 'Expired lease did not create WORKER_OUTAGE gap owned by worker-b';
    end if;

    perform public.complete_advanced_stats_poll_v1(
        v_lease_tracking,
        'worker-b',
        v_now + interval '1 minute',
        v_now + interval '31 minutes',
        false
    );

    select status, consecutive_failures, gap_started_at, gap_reason, locked_by
      into v_status, v_failures, v_gap_started, v_gap_reason, v_locked_by
      from public.advanced_stats_tracking
     where id = v_lease_tracking;
    if v_status <> 'ACTIVE' or v_failures <> 0 or v_gap_started is not null
       or v_gap_reason is not null or v_locked_by is not null then
        raise exception 'Successful completion did not return tracker to a clean ACTIVE state';
    end if;

    select count(*) into v_count
      from public.advanced_stats_tracking_gaps
     where tracking_id = v_lease_tracking
       and reason = 'WORKER_OUTAGE';
    if v_count <> 1 then
        raise exception 'Expected one durable WORKER_OUTAGE gap, found %', v_count;
    end if;

    insert into public.advanced_stats_tracking (
        user_id, player_tag, status, tracking_started_at, next_poll_at, data_complete_since
    ) values (
        v_user, '#Q8G2', 'ACTIVE', v_now - interval '2 days', v_now, v_now - interval '2 days'
    ) returning id into v_failure_tracking;

    select count(*) into v_count
      from public.claim_advanced_stats_trackers_v1('fail-1', v_now + interval '2 minutes', 10, 120)
     where id = v_failure_tracking;
    if v_count <> 1 then raise exception 'First failure claim missing'; end if;
    perform public.fail_advanced_stats_poll_v1(
        v_failure_tracking, 'fail-1', v_now + interval '2 minutes',
        v_now + interval '3 minutes', 'RATE_LIMIT', 3
    );

    select status, consecutive_failures, gap_started_at
      into v_status, v_failures, v_gap_started
      from public.advanced_stats_tracking
     where id = v_failure_tracking;
    if v_status <> 'ACTIVE' or v_failures <> 1 or v_gap_started is not null then
        raise exception 'First failure state invalid: status=% failures=%', v_status, v_failures;
    end if;

    select count(*) into v_count
      from public.claim_advanced_stats_trackers_v1('fail-2', v_now + interval '4 minutes', 10, 120)
     where id = v_failure_tracking;
    if v_count <> 1 then raise exception 'Second failure claim missing'; end if;
    perform public.fail_advanced_stats_poll_v1(
        v_failure_tracking, 'fail-2', v_now + interval '4 minutes',
        v_now + interval '5 minutes', 'RATE_LIMIT', 3
    );

    select count(*) into v_count
      from public.claim_advanced_stats_trackers_v1('fail-3', v_now + interval '6 minutes', 10, 120)
     where id = v_failure_tracking;
    if v_count <> 1 then raise exception 'Third failure claim missing'; end if;
    perform public.fail_advanced_stats_poll_v1(
        v_failure_tracking, 'fail-3', v_now + interval '6 minutes',
        v_now + interval '7 minutes', 'RATE_LIMIT', 3
    );

    select status, consecutive_failures, gap_started_at, gap_reason
      into v_status, v_failures, v_gap_started, v_gap_reason
      from public.advanced_stats_tracking
     where id = v_failure_tracking;
    if v_status <> 'DEGRADED' or v_failures <> 3
       or v_gap_started is null or v_gap_reason <> 'RATE_LIMIT' then
        raise exception 'Expected DEGRADED/RATE_LIMIT after third failure; status=% failures=% reason=%',
            v_status, v_failures, v_gap_reason;
    end if;

    select count(*) into v_count
      from public.claim_advanced_stats_trackers_v1('recover', v_now + interval '8 minutes', 10, 120)
     where id = v_failure_tracking;
    if v_count <> 1 then raise exception 'Recovery claim missing'; end if;
    perform public.complete_advanced_stats_poll_v1(
        v_failure_tracking, 'recover', v_now + interval '8 minutes',
        v_now + interval '38 minutes', false
    );

    select status, consecutive_failures, gap_started_at, gap_reason, data_complete_since, locked_by
      into v_status, v_failures, v_gap_started, v_gap_reason, v_data_complete, v_locked_by
      from public.advanced_stats_tracking
     where id = v_failure_tracking;
    if v_status <> 'ACTIVE' or v_failures <> 0 or v_gap_started is not null
       or v_gap_reason is not null or v_locked_by is not null
       or v_data_complete <> v_now + interval '8 minutes' then
        raise exception 'Recovery state invalid: status=% failures=% data_complete=%',
            v_status, v_failures, v_data_complete;
    end if;

    select count(*) into v_count
      from public.advanced_stats_tracking_gaps
     where tracking_id = v_failure_tracking
       and reason = 'RATE_LIMIT'
       and ended_at = v_now + interval '8 minutes';
    if v_count <> 1 then
        raise exception 'Expected one closed RATE_LIMIT gap, found %', v_count;
    end if;
end $$;

rollback;

select jsonb_build_object(
    'status', 'PASS',
    'persistence', 'ROLLBACK',
    'verified', jsonb_build_array(
        'lease exclusion',
        'expired lease reclaim',
        'WORKER_OUTAGE gap',
        'degraded threshold',
        'failure recovery',
        'gap closure'
    )
) as advanced_stats_state_machine_smoke_test;

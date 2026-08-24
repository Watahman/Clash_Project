-- Advanced Stats scheduled collection primitives.
-- Claims are atomic and lease-based so overlapping Cloud Run workers cannot own
-- the same tracker at the same time. Battle fingerprint uniqueness remains the
-- final idempotency guard inside the ingestion transaction.

alter table public.advanced_stats_tracking
    add column if not exists gap_reason text;

alter table public.advanced_stats_tracking
    drop constraint if exists advanced_stats_tracking_gap_reason_check;

alter table public.advanced_stats_tracking
    add constraint advanced_stats_tracking_gap_reason_check
    check (
        gap_reason is null or gap_reason in (
            'API_OUTAGE', 'RATE_LIMIT', 'WORKER_OUTAGE',
            'USER_PAUSED', 'PARSER_ERROR', 'UNKNOWN'
        )
    );

create or replace function public.claim_advanced_stats_trackers_v1(
    p_worker_id text,
    p_now timestamptz,
    p_limit integer default 50,
    p_lease_seconds integer default 120
)
returns table (
    id uuid,
    user_id uuid,
    player_tag text,
    player_name text,
    town_hall_level integer,
    status text,
    tracking_started_at timestamptz,
    bootstrap_completed_at timestamptz,
    last_poll_at timestamptz,
    last_successful_poll_at timestamptz,
    next_poll_at timestamptz,
    consecutive_failures integer,
    gap_started_at timestamptz,
    gap_reason text,
    data_complete_since timestamptz,
    battles_processed bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_limit integer := greatest(1, least(coalesce(p_limit, 50), 500));
    v_lease_seconds integer := greatest(30, least(coalesce(p_lease_seconds, 120), 900));
begin
    if p_worker_id is null or btrim(p_worker_id) = '' then
        raise exception 'worker id is required';
    end if;
    if p_now is null then
        raise exception 'claim timestamp is required';
    end if;

    return query
    with due as (
        select t.id
        from public.advanced_stats_tracking t
        where t.status in ('INITIALIZING', 'ACTIVE', 'DEGRADED')
          and (t.next_poll_at is null or t.next_poll_at <= p_now)
          and (t.locked_until is null or t.locked_until <= p_now)
        order by coalesce(t.next_poll_at, t.tracking_started_at), t.id
        for update skip locked
        limit v_limit
    ), claimed as (
        update public.advanced_stats_tracking t
        set
            gap_started_at = case
                when t.locked_by is not null
                 and t.locked_until is not null
                 and t.locked_until <= p_now
                 and t.gap_started_at is null
                then coalesce(t.last_successful_poll_at, t.tracking_started_at)
                else t.gap_started_at
            end,
            gap_reason = case
                when t.locked_by is not null
                 and t.locked_until is not null
                 and t.locked_until <= p_now
                 and t.gap_started_at is null
                then 'WORKER_OUTAGE'
                else t.gap_reason
            end,
            locked_by = btrim(p_worker_id),
            locked_until = p_now + make_interval(secs => v_lease_seconds),
            last_poll_at = p_now,
            updated_at = p_now
        from due
        where t.id = due.id
        returning t.*
    )
    select
        c.id,
        c.user_id,
        c.player_tag,
        c.player_name,
        c.town_hall_level,
        c.status,
        c.tracking_started_at,
        c.bootstrap_completed_at,
        c.last_poll_at,
        c.last_successful_poll_at,
        c.next_poll_at,
        c.consecutive_failures,
        c.gap_started_at,
        c.gap_reason,
        c.data_complete_since,
        c.battles_processed
    from claimed c;
end;
$$;

create or replace function public.complete_advanced_stats_poll_v1(
    p_tracking_id uuid,
    p_worker_id text,
    p_now timestamptz,
    p_next_poll_at timestamptz,
    p_bootstrap_completed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_tracker public.advanced_stats_tracking%rowtype;
    v_gap_reason text;
begin
    select * into v_tracker
    from public.advanced_stats_tracking
    where id = p_tracking_id
      and locked_by = btrim(p_worker_id)
    for update;

    if not found then
        raise exception 'advanced stats poll lease is no longer owned';
    end if;

    if v_tracker.gap_started_at is not null then
        v_gap_reason := coalesce(v_tracker.gap_reason, 'UNKNOWN');
        insert into public.advanced_stats_tracking_gaps (
            tracking_id, started_at, ended_at, reason
        ) values (
            v_tracker.id, v_tracker.gap_started_at, p_now, v_gap_reason
        );
    end if;

    update public.advanced_stats_tracking
    set
        status = 'ACTIVE',
        bootstrap_completed_at = case
            when p_bootstrap_completed then coalesce(bootstrap_completed_at, p_now)
            else bootstrap_completed_at
        end,
        last_successful_poll_at = p_now,
        next_poll_at = p_next_poll_at,
        consecutive_failures = 0,
        gap_started_at = null,
        gap_reason = null,
        data_complete_since = case
            when v_tracker.gap_started_at is not null then p_now
            else coalesce(data_complete_since, tracking_started_at)
        end,
        locked_until = null,
        locked_by = null,
        updated_at = p_now
    where id = v_tracker.id;

    return jsonb_build_object(
        'trackingId', v_tracker.id,
        'status', 'ACTIVE',
        'nextPollAt', p_next_poll_at,
        'gapClosed', v_tracker.gap_started_at is not null
    );
end;
$$;

create or replace function public.fail_advanced_stats_poll_v1(
    p_tracking_id uuid,
    p_worker_id text,
    p_now timestamptz,
    p_next_poll_at timestamptz,
    p_reason text,
    p_degraded_threshold integer default 3
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_tracker public.advanced_stats_tracking%rowtype;
    v_failures integer;
    v_threshold integer := greatest(2, least(coalesce(p_degraded_threshold, 3), 20));
    v_reason text;
    v_status text;
begin
    v_reason := case
        when p_reason in ('API_OUTAGE', 'RATE_LIMIT', 'WORKER_OUTAGE', 'PARSER_ERROR', 'UNKNOWN')
            then p_reason
        else 'UNKNOWN'
    end;

    select * into v_tracker
    from public.advanced_stats_tracking
    where id = p_tracking_id
      and locked_by = btrim(p_worker_id)
    for update;

    if not found then
        raise exception 'advanced stats poll lease is no longer owned';
    end if;

    v_failures := v_tracker.consecutive_failures + 1;
    v_status := case
        when v_failures >= v_threshold then 'DEGRADED'
        when v_tracker.status = 'DEGRADED' then 'DEGRADED'
        else v_tracker.status
    end;

    update public.advanced_stats_tracking
    set
        status = v_status,
        consecutive_failures = v_failures,
        next_poll_at = p_next_poll_at,
        gap_started_at = case
            when v_failures >= v_threshold and gap_started_at is null
                then coalesce(last_successful_poll_at, tracking_started_at, p_now)
            else gap_started_at
        end,
        gap_reason = case
            when v_failures >= v_threshold and gap_started_at is null then v_reason
            else gap_reason
        end,
        locked_until = null,
        locked_by = null,
        updated_at = p_now
    where id = v_tracker.id;

    return jsonb_build_object(
        'trackingId', v_tracker.id,
        'status', v_status,
        'consecutiveFailures', v_failures,
        'nextPollAt', p_next_poll_at,
        'reason', v_reason
    );
end;
$$;

revoke all on function public.claim_advanced_stats_trackers_v1(text, timestamptz, integer, integer)
    from public, anon, authenticated;
revoke all on function public.complete_advanced_stats_poll_v1(uuid, text, timestamptz, timestamptz, boolean)
    from public, anon, authenticated;
revoke all on function public.fail_advanced_stats_poll_v1(uuid, text, timestamptz, timestamptz, text, integer)
    from public, anon, authenticated;

grant execute on function public.claim_advanced_stats_trackers_v1(text, timestamptz, integer, integer)
    to service_role;
grant execute on function public.complete_advanced_stats_poll_v1(uuid, text, timestamptz, timestamptz, boolean)
    to service_role;
grant execute on function public.fail_advanced_stats_poll_v1(uuid, text, timestamptz, timestamptz, text, integer)
    to service_role;

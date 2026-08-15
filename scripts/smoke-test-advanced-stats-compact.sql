-- Transactional smoke test for the compact ClashKing source-of-truth contract.
-- No raw attack rows are written; every synthetic write is rolled back.

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
    v_trends jsonb;
    v_count integer;
    v_status text;
begin
    insert into public.users (id, name, email, accounts, code)
    values (
        v_user,
        'Advanced Stats compact smoke test',
        'advanced-stats-compact-' || v_user || '@example.invalid',
        '[]'::jsonb,
        'ASC' || replace(v_user::text, '-', '')
    );

    insert into public.advanced_stats_tracking (
        user_id, player_tag, status, tracking_started_at, next_poll_at
    ) values (
        v_user, '#P0Y2', 'ACTIVE', v_now - interval '1 day', v_now
    ) returning id into v_tracking;

    select count(*) into v_count
      from public.claim_advanced_stats_trackers_v1('compact-worker', v_now, 1, 120);
    if v_count <> 1 then
        raise exception 'Compact smoke tracker was not claimed: %', v_count;
    end if;

    v_result := public.save_advanced_stats_compact_event_v1(
        v_tracking, '#P0Y2', 'NORMAL', repeat('a', 64),
        v_now - interval '2 days', v_now - interval '2 days',
        3, 100, 1000, 2000, 30,
        '[{"unit_key":"troop-4000000","unit_name":"Barbarian","category":"TROOP","quantity":20}]'::jsonb,
        repeat('b', 64), '{"units":[{"key":"troop-4000000","quantity":20}]}'::jsonb,
        '', null, null,
        'normal-cursor-1', v_now - interval '2 days', 'normal-watermark-1',
        '{"endpoint":"/players/%23P0Y2/battlelog","revision":"synthetic-1"}'::jsonb,
        true, 'compact-worker'
    );
    if coalesce((v_result->>'inserted')::boolean, false) is not true then
        raise exception 'Compact event was not inserted: %', v_result;
    end if;

    v_result := public.save_advanced_stats_compact_event_v1(
        v_tracking, '#P0Y2', 'NORMAL', repeat('a', 64),
        v_now - interval '2 days', v_now - interval '2 days',
        0, 0, 0, 0, 0, '[]'::jsonb, null, null,
        '', null, null,
        'normal-cursor-duplicate', v_now, 'duplicate-watermark', '{}'::jsonb,
        false, 'compact-worker'
    );
    if coalesce((v_result->>'duplicate')::boolean, false) is not true then
        raise exception 'Compact duplicate was not recognized: %', v_result;
    end if;

    v_result := public.save_advanced_stats_compact_event_v1(
        v_tracking, '#P0Y2', 'WAR', repeat('c', 64),
        v_now - interval '1 day', v_now - interval '1 day',
        2, 80, 500, 600, 7, '[]'::jsonb, null, null,
        '', null, null,
        'war-cursor-1', v_now - interval '1 day', 'war-watermark-1',
        '{"endpoint":"/clans/%23CLAN/warlog","revision":"synthetic-1"}'::jsonb,
        false, 'compact-worker'
    );
    v_result := public.save_advanced_stats_compact_event_v2(
        v_tracking, '#P0Y2', 'RANKED', repeat('d', 64),
        v_now, v_now, 1, 50, 200, 300, 4, '[]'::jsonb, null, null,
        '', null, null,
        'ranked-cursor-1', v_now, 'ranked-watermark-1',
        '{"endpoint":"/players/%23P0Y2/ranked","revision":"synthetic-1","rankedSeasonKey":"1700000000"}'::jsonb,
        false, '1700000000', 'compact-worker'
    );

    select count(*) into v_count
      from public.advanced_stats_battles where tracking_id = v_tracking;
    if v_count <> 0 then raise exception 'Compact ingestion wrote raw battle rows'; end if;
    select count(*) into v_count
      from public.advanced_stats_event_receipts where tracking_id = v_tracking;
    if v_count <> 3 then raise exception 'Expected three compact receipts, got %', v_count; end if;
    select count(*) into v_count
      from public.advanced_stats_scope_unit_daily
     where tracking_id = v_tracking and scope = 'NORMAL';
    if v_count <> 1 then raise exception 'Expected one compact unit aggregate, got %', v_count; end if;

    v_result := public.update_advanced_stats_scope_poll_v1(
        v_tracking, '#P0Y2', 'NORMAL', 'compact-worker', v_now + interval '1 minute', true,
        '', null, null,
        'normal-cursor-2', v_now, 'normal-watermark-2', '{"revision":"synthetic-2"}'::jsonb,
        null, null
    );
    begin
        v_result := public.update_advanced_stats_scope_poll_v1(
            v_tracking, '#P0Y2', 'NORMAL', 'compact-worker', v_now + interval '70 seconds', true,
            '', null, null,
            'stale-cursor', v_now + interval '2 minutes', 'stale-watermark', '{}'::jsonb,
            null, null
        );
        raise exception 'Expected stale Advanced Stats checkpoint rejection';
    exception when others then
        if position('source checkpoint changed' in sqlerrm) = 0 then raise; end if;
    end;
    v_result := public.update_advanced_stats_scope_poll_v1(
        v_tracking, '#P0Y2', 'NORMAL', 'compact-worker', v_now + interval '80 seconds', true,
        'normal-cursor-2', v_now, 'normal-watermark-2',
        'normal-cursor-older', v_now - interval '1 minute', 'normal-watermark-old', '{}'::jsonb,
        null, null
    );
    if coalesce((v_result->>'checkpointAccepted')::boolean, true) then
        raise exception 'Older Advanced Stats checkpoint was accepted: %', v_result;
    end if;
    v_result := public.record_advanced_stats_scope_capability_v1(
        v_tracking, '#P0Y2', 'NORMAL', 'compact-worker', 'SUPPORTED', 'PARTIAL',
        'CLASHKING', 'legacy-v2', '{"route":"battlelog"}'::jsonb, v_now + interval '90 seconds'
    );
    v_result := public.record_advanced_stats_scope_capability_v1(
        v_tracking, '#P0Y2', 'WAR', 'compact-worker', 'PARTIAL', 'PARTIAL',
        'CLASHKING', 'legacy-v2', '{"route":"warlog"}'::jsonb, v_now + interval '90 seconds'
    );
    v_result := public.record_advanced_stats_scope_capability_v1(
        v_tracking, '#P0Y2', 'RANKED', 'compact-worker', 'UNSUPPORTED', 'UNAVAILABLE',
        'CLASHKING', 'legacy-v2', '{"route":"ranked"}'::jsonb, v_now + interval '90 seconds'
    );
    v_result := public.update_advanced_stats_bootstrap_v1(
        v_tracking, '#P0Y2', 'NORMAL', 'compact-worker', 'RUNNING', 0, 1, null,
        null, null, v_now + interval '90 seconds'
    );
    select bootstrap_status into v_status
      from public.advanced_stats_tracking where id = v_tracking;
    if v_status <> 'RUNNING' then
        raise exception 'Compact bootstrap running priority mismatch: %', v_status;
    end if;
    v_result := public.update_advanced_stats_bootstrap_v1(
        v_tracking, '#P0Y2', 'NORMAL', 'compact-worker', 'COMPLETE', 100, 1, 1,
        null, null, v_now + interval '90 seconds'
    );
    v_result := public.update_advanced_stats_bootstrap_v1(
        v_tracking, '#P0Y2', 'WAR', 'compact-worker', 'COMPLETE', 100, 0, 0,
        null, null, v_now + interval '90 seconds'
    );
    v_result := public.update_advanced_stats_bootstrap_v1(
        v_tracking, '#P0Y2', 'RANKED', 'compact-worker', 'UNSUPPORTED', 0, 0, 0,
        null, null, v_now + interval '90 seconds'
    );

    v_overview := public.read_advanced_stats_compact_overview_v1(v_tracking, 'NORMAL', null);
    if (v_overview#>>'{summary,attacks}')::integer <> 1
       or (v_overview#>>'{summary,threeStarRate}')::numeric <> 100
       or v_overview#>>'{favorites,troop,name}' <> 'Barbarian'
       or v_overview#>>'{tracking,source,provider}' <> 'CLASHKING'
       or v_overview#>>'{tracking,source,coverageStatus}' <> 'PARTIAL'
       or v_overview#>>'{tracking,source,cursor}' <> 'normal-cursor-2'
       or v_overview#>>'{tracking,source,watermarkKey}' <> 'normal-watermark-2'
       or v_overview#>>'{tracking,source,provenance,revision}' <> 'synthetic-2' then
        raise exception 'Compact overview mismatch: %', v_overview;
    end if;

    v_units := public.read_advanced_stats_compact_units_v1(v_tracking, 'NORMAL', null, 'TROOP');
    if jsonb_array_length(v_units) <> 1
       or (v_units->0->>'totalQuantity')::integer <> 20 then
        raise exception 'Compact units mismatch: %', v_units;
    end if;
    v_armies := public.read_advanced_stats_compact_armies_v1(v_tracking, 'NORMAL', null, 20);
    if jsonb_array_length(v_armies) <> 1 then raise exception 'Compact armies mismatch: %', v_armies; end if;
    v_trends := public.read_advanced_stats_compact_trends_v1(v_tracking, 'NORMAL', null);
    if jsonb_array_length(v_trends) <> 1 then raise exception 'Compact trends mismatch: %', v_trends; end if;

    select bootstrap_status into v_status
      from public.advanced_stats_tracking where id = v_tracking;
    if v_status <> 'PARTIAL' then
        raise exception 'Compact bootstrap aggregate status mismatch: %', v_status;
    end if;

    v_overview := public.read_advanced_stats_compact_overview_v2(v_tracking, 'RANKED', null, null);
    if (v_overview#>>'{summary,attacks}')::integer <> 1
       or v_overview->>'seasonKey' <> '1700000000' then
        raise exception 'Ranked season-aware overview mismatch: %', v_overview;
    end if;
    v_result := public.switch_advanced_stats_ranked_season_v1(
        v_tracking, '#P0Y2', 'compact-worker', '1700000000', '1800000000',
        v_now + interval '100 seconds'
    );
    v_overview := public.read_advanced_stats_compact_overview_v2(v_tracking, 'RANKED', null, null);
    if (v_overview#>>'{summary,attacks}')::integer <> 0
       or v_overview->>'seasonKey' <> '1800000000' then
        raise exception 'Ranked season reset mismatch: %', v_overview;
    end if;
    v_result := public.save_advanced_stats_compact_event_v2(
        v_tracking, '#P0Y2', 'RANKED', repeat('e', 64),
        v_now + interval '1 minute', v_now + interval '1 minute', 3, 100, 0, 0, 0,
        '[]'::jsonb, null, null, '', null, null,
        'ranked-cursor-new', v_now + interval '1 minute', 'ranked-watermark-new',
        '{"rankedSeasonKey":"1800000000"}'::jsonb, false, '1800000000', 'compact-worker'
    );
    v_overview := public.read_advanced_stats_compact_overview_v2(v_tracking, 'RANKED', null, null);
    if (v_overview#>>'{summary,attacks}')::integer <> 1 then
        raise exception 'Ranked new-season aggregate mismatch: %', v_overview;
    end if;
    select count(*) into v_count
      from public.advanced_stats_event_receipts
     where tracking_id = v_tracking and scope = 'RANKED' and season_key = '1700000000';
    if v_count <> 1 then raise exception 'Previous ranked season receipt was mixed or lost: %', v_count; end if;
    select count(*) into v_count
      from public.advanced_stats_event_receipts
     where tracking_id = v_tracking and scope = 'RANKED' and season_key = '1800000000';
    if v_count <> 1 then raise exception 'Current ranked season receipt mismatch: %', v_count; end if;
    v_overview := public.read_advanced_stats_compact_overview_v2(
        v_tracking, 'RANKED', null, '1700000000');
    if (v_overview#>>'{summary,attacks}')::integer <> 1 then
        raise exception 'Ranked historical-season aggregate mismatch: %', v_overview;
    end if;

end $$;

rollback;

select jsonb_build_object(
    'status', 'PASS',
    'persistence', 'ROLLBACK',
    'verified', jsonb_build_array(
        'source-scoped normal/war/ranked receipts',
        'duplicate fingerprint idempotency',
        'no raw battle row required',
        'compact unit/army/daily aggregates',
        'cursor/watermark/provenance updates',
        'ranked season-isolated receipts and aggregates',
        'bootstrap progress and completion',
        'compact read RPCs'
    )
) as advanced_stats_compact_smoke_test;

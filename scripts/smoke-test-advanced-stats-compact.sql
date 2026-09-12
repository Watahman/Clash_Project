-- Transactional smoke test for the compact ClashKing source-of-truth contract.
-- No raw attack rows are written; every synthetic write is rolled back.

begin;

do $$
declare
    v_user uuid := gen_random_uuid();
    v_tracking uuid;
    v_historical_tracking uuid;
    v_now timestamptz := date_trunc('second', now());
    v_result jsonb;
    v_overview jsonb;
    v_units jsonb;
    v_armies jsonb;
    v_trends jsonb;
    v_lifetime jsonb;
    v_count integer;
    v_known bigint;
    v_gold bigint;
    v_elixir bigint;
    v_dark_elixir bigint;
    v_best_gold bigint;
    v_best_elixir bigint;
    v_best_dark_elixir bigint;
    v_receipt_available boolean;
    v_receipt_gold bigint;
    v_legacy_gold bigint;
    v_legacy_elixir bigint;
    v_legacy_dark_elixir bigint;
    v_status text;
begin
    insert into public.users (id, name, email, code)
    values (
        v_user,
        'Advanced Stats compact smoke test',
        'advanced-stats-compact-' || v_user || '@example.invalid',
        'ASC' || replace(v_user::text, '-', '')
    );

    insert into public.user_accounts (user_id, player_tag, player_name)
    values
        (v_user, '#P0Y2', 'Compact smoke player'),
        (v_user, '#P0Y8', 'Historical smoke player');

    insert into public.advanced_stats_tracking (
        user_id, player_tag, status, tracking_started_at, next_poll_at
    ) values (
        v_user, '#P0Y2', 'ACTIVE', v_now - interval '1 day', '1900-01-01 UTC'
    ) returning id into v_tracking;

    select count(*) into v_count
      from public.claim_advanced_stats_trackers_v1('compact-worker', v_now, 1, 120);
    if v_count <> 1 then
        raise exception 'Compact smoke tracker was not claimed: %', v_count;
    end if;

    v_result := public.save_advanced_stats_compact_event_v1(
        v_tracking, '#P0Y2', 'NORMAL', repeat('a', 64),
        v_now - interval '2 days', v_now - interval '2 days',
        3::smallint, 100::numeric, 1000, 2000, 30,
        '[{"unit_key":"troop-4000000","unit_name":"Barbarian","category":"TROOP","quantity":20}]'::jsonb,
        repeat('b', 64), '{"units":[{"key":"troop-4000000","quantity":20}]}'::jsonb,
        null, null, null,
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
        0::smallint, 0::numeric, 0, 0, 0, '[]'::jsonb, null, null,
        null, null, null,
        'normal-cursor-duplicate', v_now, 'duplicate-watermark', '{}'::jsonb,
        false, 'compact-worker'
    );
    if coalesce((v_result->>'duplicate')::boolean, false) is not true then
        raise exception 'Compact duplicate was not recognized: %', v_result;
    end if;

    v_result := public.save_advanced_stats_compact_event_v1(
        v_tracking, '#P0Y2', 'WAR', repeat('c', 64),
        v_now - interval '1 day', v_now - interval '1 day',
        2::smallint, 80::numeric, 500, 600, 7, '[]'::jsonb, null, null,
        null, null, null,
        'war-cursor-1', v_now - interval '1 day', 'war-watermark-1',
        '{"endpoint":"/clans/%23CLAN/warlog","revision":"synthetic-1"}'::jsonb,
        false, 'compact-worker'
    );
    v_result := public.save_advanced_stats_compact_event_v3(
        v_tracking, '#P0Y2', 'WAR', repeat('f', 64),
        v_now - interval '1 day', v_now - interval '1 day',
        2::smallint, 80::numeric, true, 900, 0, 30, '[]'::jsonb, null, null,
        null, null, null, 'war-cursor-1', v_now - interval '1 day', 'war-watermark-1',
        '{"endpoint":"/clans/%23CLAN/warlog","revision":"synthetic-2"}'::jsonb,
        false, '', 'compact-worker'
    );
    v_result := public.save_advanced_stats_compact_event_v3(
        v_tracking, '#P0Y2', 'WAR', repeat('0', 64),
        v_now - interval '1 day', v_now - interval '1 day',
        1::smallint, 40::numeric, false, null, null, null, '[]'::jsonb, null, null,
        null, null, null, 'war-cursor-1', v_now - interval '1 day', 'war-watermark-1',
        '{"endpoint":"/clans/%23CLAN/warlog","revision":"synthetic-3"}'::jsonb,
        false, '', 'compact-worker'
    );
    v_result := public.save_advanced_stats_compact_event_v3(
        v_tracking, '#P0Y2', 'WAR', repeat('1', 64),
        v_now - interval '1 day', v_now - interval '1 day',
        1::smallint, 40::numeric, false, null, null, null, '[]'::jsonb, null, null,
        null, null, null, 'war-cursor-1', v_now - interval '1 day', 'war-watermark-1',
        '{"endpoint":"/clans/%23CLAN/warlog","revision":"synthetic-4"}'::jsonb,
        false, '', 'compact-worker'
    );
    v_result := public.save_advanced_stats_compact_event_v3(
        v_tracking, '#P0Y2', 'WAR', repeat('1', 64),
        v_now - interval '1 day', v_now - interval '1 day',
        1::smallint, 40::numeric, true, 77, 88, 9, '[]'::jsonb, null, null,
        null, null, null, 'war-cursor-1', v_now - interval '1 day', 'war-watermark-1',
        '{"endpoint":"/clans/%23CLAN/warlog","revision":"synthetic-5"}'::jsonb,
        false, '', 'compact-worker'
    );
    if coalesce((v_result->>'duplicate')::boolean, false) is not true
       or coalesce((v_result->>'lootEnriched')::boolean, false) is not true then
        raise exception 'Reliable loot did not enrich an earlier duplicate: %', v_result;
    end if;
    v_result := public.save_advanced_stats_compact_event_v3(
        v_tracking, '#P0Y2', 'WAR', repeat('1', 64),
        v_now - interval '1 day', v_now - interval '1 day',
        1::smallint, 40::numeric, true, 77, 88, 9, '[]'::jsonb, null, null,
        null, null, null, 'war-cursor-1', v_now - interval '1 day', 'war-watermark-1',
        '{"endpoint":"/clans/%23CLAN/warlog","revision":"synthetic-6"}'::jsonb,
        false, '', 'compact-worker'
    );
    if coalesce((v_result->>'duplicate')::boolean, false) is not true
       or coalesce((v_result->>'lootEnriched')::boolean, false) then
        raise exception 'Repeated reliable loot enrichment was not idempotent: %', v_result;
    end if;

    -- Simulate a historical WAR/missing-loot receipt.  Its legacy totals are
    -- intentionally not reliable, so even an explicit duplicate cannot opt it
    -- into the new reliable rollup.  This protects old normalized rows.
    insert into public.advanced_stats_tracking (
        user_id, player_tag, status, tracking_started_at, next_poll_at
    ) values (
        v_user, '#P0Y8', 'ACTIVE', v_now - interval '1 day', '1900-01-01 UTC'
    ) returning id into v_historical_tracking;
    select count(*) into v_count
      from public.claim_advanced_stats_trackers_v1('historical-worker', v_now, 1, 120);
    if v_count <> 1 then raise exception 'Historical smoke tracker was not claimed: %', v_count; end if;
    v_result := public.save_advanced_stats_compact_event_v3(
        v_historical_tracking, '#P0Y8', 'WAR', repeat('2', 64),
        v_now - interval '4 days', v_now - interval '4 days',
        1::smallint, 40::numeric, false, null, null, null, '[]'::jsonb, null, null,
        null, null, null, 'historical-cursor', v_now - interval '4 days', 'historical-watermark',
        '{"endpoint":"/clans/%23CLAN/warlog","revision":"historical"}'::jsonb,
        false, '', 'historical-worker'
    );
    select loot_known_attacks into v_known
      from public.advanced_stats_scope_daily
     where tracking_id = v_historical_tracking and scope = 'WAR';
    if v_known <> 0 then
        raise exception 'Missing-loot WAR event was marked reliable before enrichment: %', v_known;
    end if;
    update public.advanced_stats_event_receipts
       set loot_enrichment_eligible = false
     where tracking_id = v_historical_tracking and event_fingerprint = repeat('2', 64);
    if not exists (
        select 1 from public.advanced_stats_event_receipts
         where tracking_id = v_historical_tracking and event_fingerprint = repeat('2', 64)
           and loot_available = false and loot_totals_applied = false
           and loot_enrichment_eligible = false
    ) then
        raise exception 'Historical receipt was incorrectly marked enrichment-eligible';
    end if;
    update public.advanced_stats_scope_daily
       set gold_looted = 123, elixir_looted = 456, dark_elixir_looted = 7
     where tracking_id = v_historical_tracking and scope = 'WAR';
    v_result := public.save_advanced_stats_compact_event_v3(
        v_historical_tracking, '#P0Y8', 'WAR', repeat('2', 64),
        v_now - interval '4 days', v_now - interval '4 days',
        1::smallint, 40::numeric, true, 900, 0, 4, '[]'::jsonb, null, null,
        null, null, null, 'historical-cursor', v_now - interval '4 days', 'historical-watermark',
        '{"endpoint":"/clans/%23CLAN/warlog","revision":"historical-enriched"}'::jsonb,
        false, '', 'historical-worker'
    );
    if coalesce((v_result->>'duplicate')::boolean, false) is not true
       or coalesce((v_result->>'lootEnriched')::boolean, false) then
        raise exception 'Historical loot unexpectedly enriched: %', v_result;
    end if;
    select loot_known_attacks, reliable_gold_looted, reliable_elixir_looted,
           reliable_dark_elixir_looted, gold_looted, elixir_looted, dark_elixir_looted,
           best_gold_looted, best_elixir_looted, best_dark_elixir_looted
      into v_known, v_gold, v_elixir, v_dark_elixir, v_legacy_gold,
           v_legacy_elixir, v_legacy_dark_elixir,
           v_best_gold, v_best_elixir, v_best_dark_elixir
      from public.advanced_stats_scope_daily
     where tracking_id = v_historical_tracking and scope = 'WAR';
    if v_known <> 0 or v_gold <> 0 or v_elixir <> 0 or v_dark_elixir <> 0
       or v_legacy_gold <> 123 or v_legacy_elixir <> 456 or v_legacy_dark_elixir <> 7
       or v_best_gold is not null or v_best_elixir is not null or v_best_dark_elixir is not null then
        raise exception 'Historical enrichment changed reliable or legacy values: %',
            jsonb_build_object('known', v_known, 'gold', v_gold, 'elixir', v_elixir,
                'darkElixir', v_dark_elixir, 'legacyGold', v_legacy_gold,
                'bestElixir', v_best_elixir, 'bestDarkElixir', v_best_dark_elixir);
    end if;
    v_overview := public.read_advanced_stats_compact_overview_v1(v_historical_tracking, 'WAR', null);
    if (v_overview#>>'{summary,lootAttackCount}')::bigint <> 0
       or v_overview#>>'{summary,goldLooted}' is not null
       or v_overview#>>'{summary,elixirLooted}' is not null
       or v_overview#>>'{summary,darkElixirLooted}' is not null then
        raise exception 'Historical legacy loot leaked into reliable read projection: %', v_overview;
    end if;
    v_result := public.save_advanced_stats_compact_event_v2(
        v_tracking, '#P0Y2', 'RANKED', repeat('d', 64),
        v_now, v_now, 1::smallint, 50::numeric, 200, 300, 4, '[]'::jsonb, null, null,
        null, null, null,
        'ranked-cursor-1', v_now, 'ranked-watermark-1',
        '{"endpoint":"/players/%23P0Y2/ranked","revision":"synthetic-1","rankedSeasonKey":"1700000000"}'::jsonb,
        false, '1700000000', 'compact-worker'
    );

    select count(*) into v_count
      from public.advanced_stats_army_dictionary where army_hash = repeat('b', 64);
    if v_count <> 1 then raise exception 'Expected one normalized army dictionary row'; end if;
    select count(*) into v_count
      from public.advanced_stats_event_receipts where tracking_id = v_tracking;
    if v_count <> 6 then raise exception 'Expected six compact receipts, got %', v_count; end if;
    select loot_available, loot_gold into v_receipt_available, v_receipt_gold
      from public.advanced_stats_event_receipts
     where tracking_id = v_tracking and scope = 'WAR' and event_fingerprint = repeat('1', 64);
    if v_receipt_available is not true or v_receipt_gold <> 77 then
        raise exception 'Enriched receipt state mismatch: available=%, gold=%', v_receipt_available, v_receipt_gold;
    end if;
    select loot_known_attacks, reliable_gold_looted, reliable_elixir_looted,
           reliable_dark_elixir_looted, gold_looted, elixir_looted, dark_elixir_looted,
           best_gold_looted, best_elixir_looted, best_dark_elixir_looted
      into v_known, v_gold, v_elixir, v_dark_elixir, v_legacy_gold,
           v_legacy_elixir, v_legacy_dark_elixir,
           v_best_gold, v_best_elixir, v_best_dark_elixir
      from public.advanced_stats_scope_daily
     where tracking_id = v_tracking and scope = 'WAR';
    if v_known <> 3 or v_gold <> 1477 or v_elixir <> 688
       or v_dark_elixir <> 46 or v_legacy_gold <> 0
       or v_legacy_elixir <> 0 or v_legacy_dark_elixir <> 0
       or v_best_gold <> 900
       or v_best_elixir <> 600 or v_best_dark_elixir <> 30 then
        raise exception 'Loot rollup mismatch: known=%, gold=%, elixir=%, dark=%, best=(%,%,%)',
            v_known, v_gold, v_elixir, v_dark_elixir,
            v_best_gold, v_best_elixir, v_best_dark_elixir;
    end if;
    v_overview := public.read_advanced_stats_compact_overview_v1(v_tracking, 'WAR', null);
    if (v_overview#>>'{summary,lootAttackCount}')::bigint <> 3
       or (v_overview#>>'{summary,goldLooted}')::bigint <> 1477
       or (v_overview#>>'{summary,averageElixirLooted}')::numeric <> 229.33
       or (v_overview#>>'{summary,bestDarkElixirLooted}')::bigint <> 30
       or v_overview#>'{summary,loot}' is null then
        raise exception 'Loot read projection mismatch: %', v_overview;
    end if;
    select count(*) into v_count
      from public.advanced_stats_scope_unit_daily
     where tracking_id = v_tracking and scope = 'NORMAL';
    if v_count <> 1 then raise exception 'Expected one compact unit aggregate, got %', v_count; end if;

    v_result := public.update_advanced_stats_scope_poll_v1(
        v_tracking, '#P0Y2', 'NORMAL', 'compact-worker', v_now + interval '1 minute', true,
        null, null, null,
        'normal-cursor-2', v_now, 'normal-watermark-2', '{"revision":"synthetic-2"}'::jsonb,
        null, null
    );
    begin
        v_result := public.update_advanced_stats_scope_poll_v1(
            v_tracking, '#P0Y2', 'NORMAL', 'compact-worker', v_now + interval '70 seconds', true,
            null, null, null,
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
        v_tracking, '#P0Y2', 'NORMAL', 'compact-worker', 'RUNNING', 0::smallint, 1::bigint, null,
        null, null, v_now + interval '90 seconds'
    );
    select bootstrap_status into v_status
      from public.advanced_stats_tracking where id = v_tracking;
    if v_status <> 'RUNNING' then
        raise exception 'Compact bootstrap running priority mismatch: %', v_status;
    end if;
    v_result := public.update_advanced_stats_bootstrap_v1(
        v_tracking, '#P0Y2', 'NORMAL', 'compact-worker', 'COMPLETE', 100::smallint, 1::bigint, 1::bigint,
        null, null, v_now + interval '90 seconds'
    );
    v_result := public.update_advanced_stats_bootstrap_v1(
        v_tracking, '#P0Y2', 'WAR', 'compact-worker', 'COMPLETE', 100::smallint, 0::bigint, 0::bigint,
        null, null, v_now + interval '90 seconds'
    );
    v_result := public.update_advanced_stats_bootstrap_v1(
        v_tracking, '#P0Y2', 'RANKED', 'compact-worker', 'UNSUPPORTED', 0::smallint, 0::bigint, 0::bigint,
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
    if jsonb_array_length(v_trends) <> 1
       or (v_trends#>>'{0,sampleSize}')::bigint <> 1
       or jsonb_typeof(v_trends#>'{0,averageDestruction}') <> 'null'
       or v_trends#>>'{0,destructionAvailability,code}' <> 'destruction_coverage_unavailable' then
        raise exception 'Compact trends mismatch: %', v_trends;
    end if;

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
        v_now + interval '1 minute', v_now + interval '1 minute', 3::smallint, 100::numeric, 0, 0, 0,
        '[]'::jsonb, null, null, null, null, null,
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

    v_lifetime := public.read_advanced_stats_lifetime_v1(v_tracking);
    if (v_lifetime#>>'{summary,attacks}')::bigint <> 7
       or (v_lifetime#>>'{summary,totalStars}')::bigint <> 13
       or jsonb_typeof(v_lifetime#>'{summary,totalDestruction}') <> 'null'
       or (v_lifetime#>>'{summary,threeStarCount}')::bigint <> 2
       or (v_lifetime#>>'{summary,starKnownAttacks}')::bigint <> 7
       or (v_lifetime#>>'{summary,unknownStarAttacks}')::bigint <> 0
       or (v_lifetime#>>'{summary,trackedAttackDays}')::bigint <> 3
       or (v_lifetime#>>'{categories,regular,attacks}')::bigint <> 1
       or (v_lifetime#>>'{categories,regular,sampleSize}')::bigint <> 1
       or (v_lifetime#>>'{categories,competitive,attacks}')::bigint <> 6
       or (v_lifetime#>>'{categories,competitive,sampleSize}')::bigint <> 6
       or (v_lifetime#>>'{mostActiveMonth,attacks}')::bigint <> 7
       or (v_lifetime#>>'{bestPerformanceMonth,sampleSize}')::bigint <> 7
       or (v_lifetime#>>'{bestPerformanceMonth,minimumSample}')::integer <> 5
       or (v_lifetime#>>'{minimumPerformanceSample}')::integer <> 5
       or (v_lifetime#>>'{favorites,troop,name}') <> 'Barbarian'
       or (v_lifetime#>>'{mostUsedArmy,battleCount}')::bigint <> 1
       or (v_lifetime#>>'{availability,perfectAttacks,code}') <> 'raw_attack_sequence_unavailable'
       or (v_lifetime#>>'{availability,streaks,code}') <> 'raw_attack_sequence_unavailable'
       or jsonb_typeof(v_lifetime#>'{summary,perfectAttacks}') <> 'null'
       or jsonb_typeof(v_lifetime#>'{summary,bestThreeStarStreak}') <> 'null'
       or jsonb_typeof(v_lifetime#>'{summary,currentThreeStarStreak}') <> 'null'
       or jsonb_typeof(v_lifetime#>'{mostSuccessfulArmy}') <> 'null' then
        raise exception 'Lifetime compact read mismatch: %', v_lifetime;
    end if;

    v_lifetime := public.read_advanced_stats_lifetime_v1(gen_random_uuid());
    if (v_lifetime#>>'{summary,attacks}')::bigint <> 0
       or jsonb_typeof(v_lifetime#>'{summary,totalStars}') <> 'null'
       or jsonb_typeof(v_lifetime#>'{summary,totalDestruction}') <> 'null' then
        raise exception 'Empty lifetime compact read mismatch: %', v_lifetime;
    end if;

end $$;

rollback;

select jsonb_build_object(
    'status', 'PASS',
    'persistence', 'ROLLBACK',
    'verified', jsonb_build_array(
        'source-scoped normal/war/ranked receipts',
        'duplicate fingerprint idempotency',
        'historical missing-loot WAR enrichment without double-counting',
        'known zero-resource loot and best-value aggregation',
        'no raw battle row required',
        'compact unit/army/daily aggregates',
        'cursor/watermark/provenance updates',
        'ranked season-isolated receipts and aggregates',
        'bootstrap progress and completion',
        'compact read RPCs',
        'all-time lifetime summary, categories, months, favorites and army selection'
    )
) as advanced_stats_compact_smoke_test;

-- Transactional Advanced Stats constraint/security-boundary verification.
-- Creates only synthetic rows and rolls all writes back.
-- Any failed assertion aborts the script.

begin;

do $$
declare
    v_user uuid := gen_random_uuid();
    v_tracking uuid;
    v_caught boolean;
    v_result jsonb;
    v_progress bigint;
    v_unlocked boolean;
    v_source bigint;
begin
    insert into public.users (id, name, email, accounts, code)
    values (
        v_user,
        'Advanced Stats constraint smoke test',
        'advanced-stats-constraints-' || v_user || '@example.invalid',
        '[]'::jsonb,
        'ASX' || replace(v_user::text, '-', '')
    );
    insert into public.advanced_stats_tracking (user_id, player_tag, status)
    values (v_user, '#P0Y2', 'ACTIVE') returning id into v_tracking;

    v_caught := false;
    begin
        insert into public.advanced_stats_tracking (user_id, player_tag)
        values (v_user, '#INVALIDTAG');
    exception when others then v_caught := true; end;
    if not v_caught then raise exception 'Invalid player tag accepted'; end if;

    v_caught := false;
    begin
        perform public.save_advanced_stats_battle_v3(
            v_tracking, '#P0Y2'::text, repeat('a',63), now(), now(), null::text,
            null::text, null::text, null::integer, null::integer, 1::smallint, 50::numeric,
            null::text, false, 0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,
            false,1,'[]'::jsonb,null::text,null::jsonb
        );
    exception when others then v_caught := true; end;
    if not v_caught then raise exception '63-character fingerprint accepted'; end if;

    v_caught := false;
    begin
        perform public.save_advanced_stats_battle_v3(
            v_tracking, '#Q8G2'::text, repeat('a',64), now(), now(), null::text,
            null::text, null::text, null::integer, null::integer, 1::smallint, 50::numeric,
            null::text, false, 0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,
            false,1,'[]'::jsonb,null::text,null::jsonb
        );
    exception when others then v_caught := true; end;
    if not v_caught then raise exception 'Tracking/player mismatch accepted'; end if;

    v_caught := false;
    begin
        perform public.save_advanced_stats_battle_v3(
            v_tracking, '#P0Y2'::text, repeat('b',64), now(), now(), null::text,
            null::text, null::text, null::integer, null::integer, 4::smallint, 50::numeric,
            null::text, false, 0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,
            false,1,'[]'::jsonb,null::text,null::jsonb
        );
    exception when others then v_caught := true; end;
    if not v_caught then raise exception 'Four stars accepted'; end if;

    v_caught := false;
    begin
        perform public.save_advanced_stats_battle_v3(
            v_tracking, '#P0Y2'::text, repeat('c',64), now(), now(), null::text,
            null::text, null::text, null::integer, null::integer, 1::smallint, 101::numeric,
            null::text, false, 0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,
            false,1,'[]'::jsonb,null::text,null::jsonb
        );
    exception when others then v_caught := true; end;
    if not v_caught then raise exception 'Destruction over 100 accepted'; end if;

    v_caught := false;
    begin
        perform public.save_advanced_stats_battle_v3(
            v_tracking, '#P0Y2'::text, repeat('d',64), now(), now(), null::text,
            null::text, null::text, null::integer, null::integer, 1::smallint, 50::numeric,
            null::text, true, 0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,
            false,1,
            '[{"unit_key":"bad","unit_name":"Bad","category":"NOT_A_CATEGORY","quantity":1}]'::jsonb,
            repeat('d',64), '{"units":[]}'::jsonb
        );
    exception when others then v_caught := true; end;
    if not v_caught then raise exception 'Invalid unit category accepted'; end if;
    if exists (
        select 1 from public.advanced_stats_battles
         where tracking_id = v_tracking and battle_fingerprint = repeat('d',64)
    ) then raise exception 'Invalid category left partial battle row'; end if;

    v_caught := false;
    begin
        perform public.save_advanced_stats_battle_v3(
            v_tracking, '#P0Y2'::text, repeat('e',64), now(), now(), null::text,
            null::text, null::text, null::integer, null::integer, 1::smallint, 50::numeric,
            null::text, true, 0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,
            false,1,
            '[{"unit_key":"bad","unit_name":"Bad","category":"TROOP","quantity":0}]'::jsonb,
            repeat('e',64), '{"units":[]}'::jsonb
        );
    exception when others then v_caught := true; end;
    if not v_caught then raise exception 'Zero unit quantity accepted'; end if;
    if exists (
        select 1 from public.advanced_stats_battles
         where tracking_id = v_tracking and battle_fingerprint = repeat('e',64)
    ) then raise exception 'Zero unit quantity left partial battle row'; end if;

    v_caught := false;
    begin
        perform public.save_advanced_stats_battle_v3(
            v_tracking, '#P0Y2'::text, repeat('f',64), now(), now(), null::text,
            null::text, null::text, null::integer, null::integer, 1::smallint, 50::numeric,
            null::text, true, 0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,
            false,1,'{"not":"an array"}'::jsonb,repeat('f',64),'{"units":[]}'::jsonb
        );
    exception when others then v_caught := true; end;
    if not v_caught then raise exception 'Object p_units accepted'; end if;

    v_result := public.save_advanced_stats_battle_v3(
        v_tracking, '#P0Y2'::text, repeat('0',64), now(), now(), null::text,
        null::text, null::text, null::integer, null::integer, 1::smallint, 50::numeric,
        null::text, false, (-100)::bigint,(-20)::bigint,(-3)::bigint,
        (-10)::bigint,(-10)::bigint,(-10)::bigint,false,1,'[]'::jsonb,null::text,null::jsonb
    );
    if (select loot_gold from public.advanced_stats_battles
         where tracking_id = v_tracking and battle_fingerprint = repeat('0',64)) <> 0 then
        raise exception 'Negative loot was not normalized to zero';
    end if;

    v_result := public.reconcile_advanced_stats_achievement_progress_v1(
        v_user, '#P0Y2', 2000,
        '[{"achievement_key":"synthetic_tier","family_key":"synthetic","title":"Synthetic","description":"Synthetic","category":"battle","rarity":"common","tier":1,"xp":10,"metric":"tracked_attack_count","progress":100,"target":100,"unlocked":true}]'::jsonb
    );
    v_result := public.reconcile_advanced_stats_achievement_progress_v1(
        v_user, '#P0Y2', 1000,
        '[{"achievement_key":"synthetic_tier","family_key":"synthetic","title":"Synthetic","description":"Synthetic","category":"battle","rarity":"common","tier":1,"xp":10,"metric":"tracked_attack_count","progress":20,"target":100,"unlocked":false}]'::jsonb
    );
    select progress, unlocked, source_timestamp
      into v_progress, v_unlocked, v_source
      from public.achievement_progress
     where user_id = v_user
       and player_tag = '#P0Y2'
       and achievement_key = 'synthetic_tier'
       and tier = 1;
    if v_progress <> 100 or v_unlocked is not true or v_source <> 2000 then
        raise exception 'Achievement monotonicity failed: progress=% unlocked=% source=%',
            v_progress, v_unlocked, v_source;
    end if;

    v_caught := false;
    begin
        perform public.reconcile_advanced_stats_achievement_progress_v1(
            v_user, '#P0Y2', 3000,
            '[{"achievement_key":"bad","family_key":"bad","title":"Bad","description":"Bad","category":"battle","rarity":"common","tier":1,"xp":1,"metric":"not_supported","progress":1,"target":1,"unlocked":true}]'::jsonb
        );
    exception when others then v_caught := true; end;
    if not v_caught then raise exception 'Unsupported achievement metric accepted'; end if;

    v_caught := false;
    begin
        perform public.reconcile_advanced_stats_achievement_progress_v1(
            v_user, '#P0Y2', 0, '[]'::jsonb
        );
    exception when others then v_caught := true; end;
    if not v_caught then raise exception 'Invalid achievement source timestamp accepted'; end if;
end $$;

rollback;

select jsonb_build_object(
    'status', 'PASS',
    'persistence', 'ROLLBACK',
    'verified', jsonb_build_array(
        'tag constraints',
        'fingerprint constraints',
        'tracking/player identity',
        'battle ranges',
        'atomic unit payload validation',
        'negative loot normalization',
        'achievement monotonicity',
        'achievement metric allowlist'
    )
) as advanced_stats_constraint_smoke_test;

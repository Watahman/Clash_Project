-- Rollback-only compact achievement storage smoke test.
-- Run with a service-role-capable psql session after the three 20260911
-- migrations. Every assertion is inside one transaction and is rolled back.
begin;

do $smoke$
declare
    v_user_a uuid := gen_random_uuid();
    v_user_b uuid := gen_random_uuid();
    v_gte jsonb := jsonb_build_array(
        jsonb_build_object('achievement_key', 'SMOKE_GTE_1', 'family_key', 'SMOKE_GTE',
            'title', 'Gte one', 'description', 'Gte one', 'category', 'smoke',
            'rarity', 'common', 'tier', 1, 'xp', 10, 'metric', 'smoke_gte',
            'comparison', 'GTE', 'progress', 10, 'target', 10, 'unlocked', true,
            'progress_known', true),
        jsonb_build_object('achievement_key', 'SMOKE_GTE_2', 'family_key', 'SMOKE_GTE',
            'title', 'Gte two', 'description', 'Gte two', 'category', 'smoke',
            'rarity', 'rare', 'tier', 2, 'xp', 20, 'metric', 'smoke_gte',
            'comparison', 'GTE', 'progress', 10, 'target', 20, 'unlocked', false,
            'progress_known', true)
    );
    v_gte_duplicate jsonb := v_gte || jsonb_build_array(
        jsonb_build_object('achievement_key', 'SMOKE_GTE_1', 'family_key', 'SMOKE_GTE',
            'tier', 1, 'xp', 10, 'metric', 'smoke_gte', 'comparison', 'GTE',
            'progress', 10, 'target', 10, 'unlocked', true, 'progress_known', true)
    );
    v_lte jsonb := jsonb_build_array(
        jsonb_build_object('achievement_key', 'SMOKE_LTE_1', 'family_key', 'SMOKE_LTE',
            'title', 'Lte one', 'description', 'Lte one', 'category', 'smoke',
            'rarity', 'common', 'tier', 1, 'xp', 7, 'metric', 'legend_best_season_rank',
            'comparison', 'LTE', 'progress', 90, 'target', 100, 'unlocked', true,
            'progress_known', true),
        jsonb_build_object('achievement_key', 'SMOKE_LTE_2', 'family_key', 'SMOKE_LTE',
            'title', 'Lte two', 'description', 'Lte two', 'category', 'smoke',
            'rarity', 'rare', 'tier', 2, 'xp', 8, 'metric', 'legend_best_season_rank',
            'comparison', 'LTE', 'progress', 90, 'target', 50, 'unlocked', false,
            'progress_known', true)
    );
    v_bool jsonb := jsonb_build_array(
        jsonb_build_object('achievement_key', 'SMOKE_BOOL_1', 'family_key', 'SMOKE_BOOL',
            'title', 'Boolean', 'description', 'Boolean', 'category', 'smoke',
            'rarity', 'common', 'tier', 1, 'xp', 5, 'metric', 'smoke_bool',
            'comparison', 'BOOLEAN', 'progress', 1, 'target', 1, 'unlocked', true,
            'progress_known', true)
    );
    v_result jsonb;
    v_read jsonb;
    v_state record;
    v_source_state record;
    v_old_unlock_count integer;
begin
    insert into public.users (id, name, code) values
        (v_user_a, 'compact smoke a', 'SMKA' || substr(replace(v_user_a::text, '-', ''), 1, 4)),
        (v_user_b, 'compact smoke b', 'SMKB' || substr(replace(v_user_b::text, '-', ''), 1, 4));
    insert into public.user_accounts (user_id, player_tag)
    values (v_user_a, '#P0Y8LQ2'), (v_user_b, '#P0Y8LQ9');

    v_result := public.save_achievement_import(v_user_a, '#P0Y8LQ2', 5,
        repeat('a', 64), '{}'::jsonb, '{"ignored_metric": 1}'::jsonb,
        jsonb_build_array(jsonb_build_object(
            'achievement_key', 'SMOKE_SAVE_1', 'family_key', 'SMOKE_SAVE',
            'title', 'Saved', 'description', 'Saved', 'category', 'smoke',
            'rarity', 'common', 'tier', 1, 'xp', 3, 'metric', 'smoke_save',
            'comparison', 'GTE', 'progress', 2, 'target', 2, 'unlocked', true,
            'progress_known', true)));
    if (v_result->>'snapshotId' is null or (v_result->>'newUnlocks')::integer <> 1) then
        raise exception 'save import contract';
    end if;
    select * into v_source_state from public.achievement_source_state
     where user_id = v_user_a and player_tag = '#P0Y8LQ2'
       and source = 'base_data' and source_key = '';
    if not found then raise exception 'source state row missing'; end if;
    if v_source_state.cursor->>'source_timestamp' <> '5'
       or v_source_state.coverage <> '{}'::jsonb then
        raise exception 'source state contract';
    end if;
    v_result := public.save_achievement_import(v_user_a, '#P0Y8LQ2', 5,
        repeat('a', 64), '{}'::jsonb, '{"ignored_metric": 2}'::jsonb,
        jsonb_build_array(jsonb_build_object(
            'achievement_key', 'SMOKE_SAVE_1', 'family_key', 'SMOKE_SAVE',
            'tier', 1, 'xp', 3, 'metric', 'smoke_save', 'comparison', 'GTE',
            'progress', 2, 'target', 2, 'unlocked', true, 'progress_known', true)));
    if (v_result->>'newUnlocks')::integer <> 0 then raise exception 'save repeat unlock count'; end if;

    v_result := public.reconcile_achievement_progress_v2(v_user_a, '#P0Y8LQ2', 10, v_gte);
    if (v_result->>'newUnlocks')::integer <> 1 then raise exception 'first GTE unlock count'; end if;
    v_result := public.reconcile_achievement_progress_v2(v_user_a, '#P0Y8LQ2', 11, v_gte_duplicate);
    if (v_result->>'newUnlocks')::integer <> 0 then raise exception 'duplicate GTE unlock count'; end if;
    v_result := public.reconcile_achievement_progress_v2(v_user_a, '#P0Y8LQ2', 12,
        jsonb_set(v_gte, '{0,progress}', '25'::jsonb) || jsonb_build_array(
            jsonb_set(v_gte->1, '{progress}', '25'::jsonb)));
    if (v_result->>'newUnlocks')::integer <> 1 then raise exception 'multi-tier GTE unlock count'; end if;
    v_result := public.reconcile_achievement_progress_v2(v_user_a, '#P0Y8LQ2', 13,
        jsonb_set(v_gte, '{0,progress}', '5'::jsonb) || jsonb_build_array(
            jsonb_set(v_gte->1, '{progress}', '5'::jsonb)));
    select * into v_state from public.player_achievement_state
     where user_id = v_user_a and player_tag = '#P0Y8LQ2';
    if cardinality(v_state.family_ids) <> 2
       or not exists (
           select 1
           from unnest(v_state.family_ids, v_state.progress_values) pair(family_id, progress)
           join public.achievement_families f on f.family_id = pair.family_id
           where f.family_key = 'SMOKE_GTE' and pair.progress = 25
       ) then
        raise exception 'GTE state regressed or duplicated';
    end if;

    v_result := public.reconcile_achievement_progress_v2(v_user_a, '#P0Y8LQ2', 20, v_lte);
    if (v_result->>'newUnlocks')::integer <> 1 then raise exception 'first LTE unlock count'; end if;
    v_result := public.reconcile_achievement_progress_v2(v_user_a, '#P0Y8LQ2', 21,
        jsonb_build_array(jsonb_set(v_lte->0, '{progress}', '40'::jsonb),
                          jsonb_set(v_lte->1, '{progress}', '40'::jsonb)));
    if (v_result->>'newUnlocks')::integer <> 1 then raise exception 'second LTE unlock count'; end if;
    v_result := public.reconcile_achievement_progress_v2(v_user_a, '#P0Y8LQ2', 22, v_bool);
    if (v_result->>'newUnlocks')::integer <> 1 then raise exception 'BOOLEAN unlock count'; end if;

    v_read := public.read_achievement_progress_v2(v_user_a, '#P0Y8LQ2');
    if jsonb_array_length(v_read) <> 6 then raise exception 'derived row count'; end if;
    if not exists (select 1 from jsonb_array_elements(v_read) row
        where row->>'achievement_key' = 'SMOKE_GTE_2'
          and (row->>'progress')::bigint = 25 and (row->>'unlocked')::boolean
          and (row->>'xp')::integer = 20) then raise exception 'derived GTE read'; end if;
    if not exists (select 1 from jsonb_array_elements(v_read) row
        where row->>'achievement_key' = 'SMOKE_LTE_2'
          and (row->>'progress')::bigint = 40 and (row->>'unlocked')::boolean) then raise exception 'derived LTE read'; end if;
    if exists (
        select 1 from public.achievement_progress p
        where not exists (select 1 from public.achievement_definitions d where d.achievement_key = p.achievement_key)
    ) then
        raise exception 'legacy catalog parity';
    end if;
    if exists (
        with legacy as (
            select p.user_id, p.player_tag, f.family_id,
                case when f.comparison = 'LTE'
                     then coalesce(min(p.progress) filter (where p.progress > 0), 0)
                     else max(p.progress) end as progress
            from public.achievement_progress p
            join public.achievement_families f on f.family_key = p.family_key
            where f.scope = 'player'
            group by p.user_id, p.player_tag, f.family_id, f.comparison
        ), compact as (
            select s.user_id, s.player_tag, pair.family_id, pair.progress
            from public.player_achievement_state s
            cross join lateral unnest(s.family_ids, s.progress_values) pair(family_id, progress)
        )
        select 1 from legacy l
        left join compact c on c.user_id = l.user_id and c.player_tag = l.player_tag
            and c.family_id = l.family_id
        where l.progress is distinct from c.progress
    ) then
        raise exception 'legacy progress parity';
    end if;

    v_result := public.reconcile_achievement_progress_v2(v_user_b, '#P0Y8LQ9', 30, v_gte);
    if (v_result->>'newUnlocks')::integer <> 1 then raise exception 'second user isolation'; end if;
    if (select count(*) from public.player_achievement_state
        where user_id in (v_user_a, v_user_b)) <> 2 then raise exception 'multiple player rows'; end if;

    v_result := public.reconcile_clan_achievement_progress_v1('#P0Y8LQG', 100, 'smoke',
        jsonb_build_array(jsonb_build_object('achievement_key', 'SMOKE_CLAN_1',
            'family_key', 'SMOKE_CLAN', 'title', 'Clan', 'description', 'Clan',
            'category', 'smoke', 'rarity', 'common', 'tier', 1, 'metric', 'smoke_clan',
            'comparison', 'GTE', 'progress', 3, 'target', 3, 'unlocked', true,
            'scope', 'clan', 'progress_known', true)));
    if v_result->>'newUnlocks' <> '1' then raise exception 'clan first unlock count'; end if;
    v_old_unlock_count := (select count(*) from public.clan_achievement_unlocks where clan_tag = '#P0Y8LQG');
    v_result := public.reconcile_clan_achievement_progress_v1('#P0Y8LQG', 100, 'smoke',
        jsonb_build_array(jsonb_build_object('achievement_key', 'SMOKE_CLAN_1',
            'family_key', 'SMOKE_CLAN', 'tier', 1, 'metric', 'smoke_clan',
            'comparison', 'GTE', 'progress', 3, 'target', 3, 'unlocked', true,
            'scope', 'clan')));
    if v_result->>'newUnlocks' <> '0' or
       (select count(*) from public.clan_achievement_unlocks where clan_tag = '#P0Y8LQG') <> v_old_unlock_count then
        raise exception 'clan duplicate unlock';
    end if;
    v_result := public.reconcile_clan_achievement_progress_v1('#P0Y8LQG', 101, 'smoke',
        jsonb_build_array(jsonb_build_object('achievement_key', 'SMOKE_CLAN_BOOL_1',
            'family_key', 'SMOKE_CLAN_BOOL', 'title', 'Clan boolean', 'description', 'Clan boolean',
            'category', 'smoke', 'rarity', 'common', 'tier', 1, 'metric', 'smoke_clan_bool',
            'comparison', 'BOOLEAN', 'progress', 0, 'target', 1, 'unlocked', true,
            'scope', 'clan', 'progress_known', true)));
    if v_result->>'newUnlocks' <> '1' then raise exception 'clan boolean unlock count'; end if;
    if not exists (
        select 1 from jsonb_array_elements(public.read_clan_achievement_progress_v2('#P0Y8LQG')) row
        where row->>'achievement_key' = 'SMOKE_CLAN_BOOL_1'
          and (row->>'progress')::bigint = 1 and (row->>'unlocked')::boolean
    ) then raise exception 'clan boolean progress promotion'; end if;
    v_result := public.reconcile_clan_achievement_progress_v1('#P0Y8LQG', 99, 'stale',
        jsonb_build_array(jsonb_build_object('achievement_key', 'SMOKE_CLAN_1',
            'family_key', 'SMOKE_CLAN', 'tier', 1, 'metric', 'smoke_clan',
            'comparison', 'GTE', 'progress', 1, 'target', 3, 'unlocked', false,
            'scope', 'clan')));
    if v_result->>'saved' <> '0' then raise exception 'clan stale evidence accepted'; end if;
    if jsonb_array_length(public.read_clan_achievement_progress_v2('#P0Y8LQG')) <> 2 then
        raise exception 'clan read projection';
    end if;

    insert into public.advanced_stats_tracking (user_id, player_tag)
    values (v_user_a, '#P0Y8LQ2');
    select public.reconcile_advanced_stats_achievement_progress_v1(
        v_user_a, '#P0Y8LQ2', 200,
        jsonb_agg(jsonb_build_object(
            'achievement_key', 'SMOKE_ADV_' || ordinal,
            'family_key', 'SMOKE_ADV_' || ordinal,
            'title', 'Advanced smoke ' || ordinal,
            'description', 'Advanced smoke ' || ordinal,
            'category', 'smoke', 'rarity', 'common', 'tier', 1, 'xp', 1,
            'metric', metric, 'comparison', 'GTE', 'progress', 5,
            'target', 1, 'unlocked', true, 'progress_known', true
        ) order by ordinal))
    into v_result
    from unnest(array[
        'tracked_attack_count', 'tracked_star_count', 'tracked_three_star_count'
    ]) with ordinality metrics(metric, ordinal);
    if (v_result->>'saved')::integer <> 3 then raise exception 'advanced stats compact reconcile'; end if;
    select public.reconcile_achievement_progress_v2(
        v_user_a, '#P0Y8LQ2', 201,
        jsonb_agg(jsonb_build_object(
            'achievement_key', 'SMOKE_ADV_' || (ordinal + 3),
            'family_key', 'SMOKE_ADV_' || (ordinal + 3),
            'title', 'Advanced smoke ' || (ordinal + 3),
            'description', 'Advanced smoke ' || (ordinal + 3),
            'category', 'smoke', 'rarity', 'common', 'tier', 1, 'xp', 1,
            'metric', metric, 'comparison', 'GTE', 'progress', 5,
            'target', 1, 'unlocked', true, 'progress_known', true
        ) order by ordinal))
    into v_result
    from unnest(array[
        'tracked_two_star_count', 'tracked_one_star_count', 'tracked_zero_star_count',
        'tracked_gold_looted', 'tracked_elixir_looted',
        'tracked_dark_elixir_looted', 'tracked_active_days'
    ]) with ordinality metrics(metric, ordinal);
    if (v_result->>'saved')::integer <> 7 then raise exception 'advanced stats extended metric reconcile'; end if;
    v_result := public.delete_advanced_stats_tracking_v1(v_user_a, '#P0Y8LQ2');
    if not (v_result->>'deleted')::boolean then raise exception 'advanced stats tracker delete'; end if;
    if exists (
        select 1
        from public.player_achievement_state s
        cross join lateral unnest(s.family_ids) family(family_id)
        join public.achievement_families f using (family_id)
        where s.user_id = v_user_a and s.player_tag = '#P0Y8LQ2'
          and f.metric like 'tracked_%'
    ) then raise exception 'advanced stats compact deletion fence'; end if;
end;
$smoke$;

rollback;

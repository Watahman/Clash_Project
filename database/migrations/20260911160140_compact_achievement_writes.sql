-- Compact achievement writes. All public entry points retain their existing
-- signatures; the v2 reconciler is the single atomic state transition.

create or replace function public.merge_achievement_arrays_v2(
    p_family_ids smallint[],
    p_progress_values bigint[],
    p_family_id smallint,
    p_progress bigint,
    p_comparison text
) returns table (family_ids smallint[], progress_values bigint[])
language plpgsql
immutable
as $$
declare
    v_index integer;
    v_current bigint;
    v_merged bigint;
begin
    family_ids := coalesce(p_family_ids, '{}'::smallint[]);
    progress_values := coalesce(p_progress_values, '{}'::bigint[]);
    v_index := array_position(family_ids, p_family_id);
    if v_index is null then
        family_ids := family_ids || p_family_id;
        progress_values := progress_values || case
            when p_comparison = 'BOOLEAN' then least(greatest(coalesce(p_progress, 0), 0), 1)
            else greatest(coalesce(p_progress, 0), 0)
        end;
    else
        v_current := progress_values[v_index];
        v_merged := case
            when p_comparison = 'LTE' and p_progress > 0
                then case when v_current <= 0 then p_progress else least(v_current, p_progress) end
            when p_comparison = 'BOOLEAN'
                then greatest(v_current, least(greatest(coalesce(p_progress, 0), 0), 1))
            else greatest(v_current, greatest(coalesce(p_progress, 0), 0))
        end;
        progress_values[v_index] := v_merged;
    end if;

    select array_agg(pair.family_id order by pair.family_id)::smallint[],
           array_agg(pair.progress order by pair.family_id)::bigint[]
      into family_ids, progress_values
      from unnest(family_ids, progress_values) as pair(family_id, progress);
    return next;
end;
$$;

create or replace function public.upsert_achievement_definition_v2(
    p_item jsonb,
    p_scope text default 'player'
) returns smallint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_family_id smallint;
    v_achievement_key text := nullif(btrim(p_item->>'achievement_key'), '');
    v_family_key text := nullif(btrim(coalesce(p_item->>'family_key', p_item->>'achievement_key')), '');
    v_category text := coalesce(nullif(btrim(p_item->>'category'), ''), '');
    v_metric text := coalesce(nullif(btrim(p_item->>'metric'), ''), 'achievement');
    v_scope text := case when lower(coalesce(p_item->>'scope', p_scope)) = 'clan'
                         then 'clan' else 'player' end;
    v_comparison text := upper(nullif(btrim(p_item->>'comparison'), ''));
    v_explicit_comparison boolean := v_comparison in ('GTE', 'LTE', 'BOOLEAN', 'UNSUPPORTED');
    v_tier smallint;
    v_target bigint;
    v_xp integer;
    v_existing_scope text;
begin
    if v_achievement_key is null or v_family_key is null then
        raise exception 'Achievement definition requires achievement_key and family_key';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('achievement-catalog:' || v_family_key, 0));
    if not v_explicit_comparison then
        v_comparison := case when v_metric in (
                                  'legend_best_season_rank',
                                  'ranking_best_global_rank',
                                  'base_min_positive_timer_seconds'
                              )
                             then 'LTE' else 'GTE' end;
    end if;
    v_tier := case when (p_item->>'tier') ~ '^\d+$' then (p_item->>'tier')::smallint else 1 end;
    v_target := case when (p_item->>'target') ~ '^\d+$' then greatest((p_item->>'target')::bigint, 1) else 1 end;
    v_xp := case when (p_item->>'xp') ~ '^\d+$' then greatest((p_item->>'xp')::integer, 0) else 0 end;

    select scope into v_existing_scope
      from public.achievement_families
     where family_key = v_family_key;
    if found and v_existing_scope <> v_scope then
        raise exception 'Achievement family scope conflict for %', v_family_key;
    end if;
    insert into public.achievement_families
        (family_key, scope, category, metric, title, description, comparison)
    values (
        v_family_key, v_scope, v_category, v_metric,
        coalesce(p_item->>'title', ''), coalesce(p_item->>'description', ''), v_comparison
    )
    on conflict (family_key) do update
    set category = case when excluded.category <> '' then excluded.category else public.achievement_families.category end,
        metric = case when excluded.metric <> 'achievement' then excluded.metric else public.achievement_families.metric end,
        title = case when excluded.title <> '' then excluded.title else public.achievement_families.title end,
        description = case when excluded.description <> '' then excluded.description else public.achievement_families.description end,
        comparison = case when v_explicit_comparison then excluded.comparison else public.achievement_families.comparison end
    returning family_id into v_family_id;

    insert into public.achievement_definitions (
        family_id, achievement_key, tier, target, xp, rarity
    ) values (
        v_family_id, v_achievement_key, v_tier, v_target, v_xp,
        coalesce(p_item->>'rarity', '')
    )
    on conflict (achievement_key) do update
    set family_id = excluded.family_id,
        tier = excluded.tier,
        target = excluded.target,
        xp = excluded.xp,
        rarity = case when excluded.rarity <> '' then excluded.rarity else public.achievement_definitions.rarity end;
    return v_family_id;
end;
$$;

create or replace function public.reconcile_achievement_progress_v2(
    p_user_id uuid,
    p_player_tag text,
    p_source_timestamp bigint,
    p_progress jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_item jsonb;
    v_family_id smallint;
    v_family_ids smallint[] := '{}'::smallint[];
    v_progress_values bigint[] := '{}'::bigint[];
    v_new_progress bigint;
    v_comparison text;
    v_rows integer := 0;
    v_new_unlocks integer := 0;
    v_inserted integer;
    v_definition record;
    v_known boolean;
    v_input_progress bigint;
begin
    if p_user_id is null or p_player_tag is null or p_source_timestamp is null
       or p_source_timestamp <= 0 then
        raise exception 'Missing required achievement progress data';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('achievement:' || p_user_id || E'\x1f' || p_player_tag, 0));
    select family_ids, progress_values
      into v_family_ids, v_progress_values
      from public.player_achievement_state
     where user_id = p_user_id and player_tag = p_player_tag
     for update;
    v_family_ids := coalesce(v_family_ids, '{}'::smallint[]);
    v_progress_values := coalesce(v_progress_values, '{}'::bigint[]);

    for v_item in
        select value
        from jsonb_array_elements(coalesce(p_progress, '[]'::jsonb))
        order by value->>'family_key', value->>'achievement_key', coalesce((value->>'tier')::integer, 0)
    loop
        if lower(coalesce(v_item->>'scope', 'player')) = 'clan' then continue; end if;
        v_family_id := public.upsert_achievement_definition_v2(v_item, 'player');
        if v_item ? 'progress_known' and coalesce((v_item->>'progress_known')::boolean, false) = false then
            continue;
        end if;
        select comparison into v_comparison
          from public.achievement_families where family_id = v_family_id;
        v_known := array_position(v_family_ids, v_family_id) is not null;
        v_input_progress := case when (v_item->>'progress') ~ '^\d+$'
                                 then greatest((v_item->>'progress')::bigint, 0) else 0 end;
        if v_comparison = 'BOOLEAN' and coalesce((v_item->>'unlocked')::boolean, false) then
            v_input_progress := greatest(v_input_progress, 1);
        end if;
        -- Keep zero-only observed catalog rows out of the subject arrays. The
        -- catalog remains globally available, while state stores only evidence.
        if not v_known and v_input_progress = 0
           and not coalesce((v_item->>'unlocked')::boolean, false) then
            continue;
        end if;
        select family_ids, progress_values
          into v_family_ids, v_progress_values
          from public.merge_achievement_arrays_v2(
              v_family_ids, v_progress_values, v_family_id, v_input_progress, v_comparison
          );
        v_new_progress := v_progress_values[array_position(v_family_ids, v_family_id)];

        for v_definition in
            select d.achievement_id, d.target, f.comparison
            from public.achievement_definitions d
            join public.achievement_families f on f.family_id = d.family_id
            where d.family_id = v_family_id
        loop
            if (v_definition.comparison = 'GTE' and v_new_progress >= v_definition.target)
               or (v_definition.comparison = 'LTE' and v_new_progress > 0 and v_new_progress <= v_definition.target)
               or (v_definition.comparison = 'BOOLEAN' and v_new_progress > 0) then
                insert into public.player_achievement_unlocks
                    (user_id, player_tag, achievement_id, unlocked_at)
                values (p_user_id, p_player_tag, v_definition.achievement_id, now())
                on conflict (user_id, player_tag, achievement_id) do nothing;
                get diagnostics v_inserted = row_count;
                v_new_unlocks := v_new_unlocks + v_inserted;
            end if;
        end loop;
        v_rows := v_rows + 1;
    end loop;

    if v_rows > 0 then
        insert into public.player_achievement_state
            (user_id, player_tag, family_ids, progress_values, source_timestamp)
        values (p_user_id, p_player_tag, v_family_ids, v_progress_values, p_source_timestamp)
        on conflict (user_id, player_tag) do update
        set family_ids = excluded.family_ids,
            progress_values = excluded.progress_values,
            source_timestamp = greatest(public.player_achievement_state.source_timestamp, excluded.source_timestamp),
            updated_at = now();
    end if;
    return jsonb_build_object('rows', v_rows, 'newUnlocks', v_new_unlocks, 'savedAt', now());
end;
$$;

create or replace function public.save_achievement_import(
    p_user_id uuid,
    p_player_tag text,
    p_source_timestamp bigint,
    p_checksum text,
    p_payload jsonb,
    p_metrics jsonb,
    p_progress jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_snapshot_id bigint;
    v_result jsonb;
begin
    if p_user_id is null or p_player_tag is null or p_payload is null
       or p_source_timestamp is null or p_source_timestamp <= 0 then
        raise exception 'Missing required achievement import data';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('achievement:' || p_user_id || E'\x1f' || p_player_tag, 0));
    insert into public.achievement_base_snapshots (
        user_id, player_tag, source_timestamp, checksum, payload, metrics
    ) values (
        p_user_id, p_player_tag, p_source_timestamp, p_checksum, p_payload, coalesce(p_metrics, '{}'::jsonb)
    )
    on conflict (user_id, player_tag, source_timestamp) do update
    set checksum = excluded.checksum, payload = excluded.payload,
        metrics = excluded.metrics, imported_at = now()
    returning id into v_snapshot_id;

    insert into public.achievement_source_state (
        user_id, player_tag, source, source_key, cursor, coverage,
        last_checked_at, last_success_at, last_error_code, updated_at
    ) values (
        p_user_id, p_player_tag, 'base_data', '',
        jsonb_build_object('source_timestamp', p_source_timestamp, 'checksum', p_checksum),
        '{}'::jsonb, now(), now(), null, now()
    )
    on conflict (user_id, player_tag, source, source_key) do update
    set cursor = case
            when coalesce(
                case when (public.achievement_source_state.cursor->>'source_timestamp') ~ '^\d+$'
                     then (public.achievement_source_state.cursor->>'source_timestamp')::bigint
                     else 0 end,
                0
            ) <= p_source_timestamp
            then coalesce(public.achievement_source_state.cursor, '{}'::jsonb)
                || jsonb_build_object('source_timestamp', p_source_timestamp, 'checksum', p_checksum)
            else public.achievement_source_state.cursor
        end,
        coverage = coalesce(public.achievement_source_state.coverage, '{}'::jsonb),
        last_checked_at = now(),
        last_success_at = case
            when coalesce(
                case when (public.achievement_source_state.cursor->>'source_timestamp') ~ '^\d+$'
                     then (public.achievement_source_state.cursor->>'source_timestamp')::bigint
                     else 0 end,
                0
            ) <= p_source_timestamp then now()
            else public.achievement_source_state.last_success_at
        end,
        last_error_code = null, updated_at = now();

    v_result := public.reconcile_achievement_progress_v2(
        p_user_id, p_player_tag, p_source_timestamp, p_progress
    );
    return v_result || jsonb_build_object('snapshotId', v_snapshot_id, 'savedAt', now());
end;
$$;

create or replace function public.reconcile_advanced_stats_achievement_progress_v1(
    p_user_id uuid,
    p_player_tag text,
    p_source_timestamp bigint,
    p_progress jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_item jsonb;
begin
    for v_item in select value from jsonb_array_elements(coalesce(p_progress, '[]'::jsonb)) loop
        if coalesce(v_item->>'metric', '') not in
            ('tracked_attack_count', 'tracked_star_count', 'tracked_three_star_count') then
            raise exception 'Unsupported Advanced Stats achievement metric: %', coalesce(v_item->>'metric', '<null>');
        end if;
    end loop;
    return public.reconcile_achievement_progress_v2(p_user_id, p_player_tag, p_source_timestamp, p_progress);
end;
$$;

create or replace function public.reconcile_clan_achievement_progress_v2(
    p_clan_tag text,
    p_evidence_timestamp bigint,
    p_evidence_source text,
    p_progress jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_item jsonb;
    v_family_id smallint;
    v_family_ids smallint[] := '{}'::smallint[];
    v_progress_values bigint[] := '{}'::bigint[];
    v_old_progress bigint;
    v_input_progress bigint;
    v_new_progress bigint;
    v_comparison text;
    v_saved integer := 0;
    v_new_unlocks integer := 0;
    v_inserted integer;
    v_definition record;
begin
    if p_clan_tag is null or p_clan_tag !~ '^#[0289PYLQGRJCUV]{3,15}$'
       or p_evidence_timestamp is null or p_evidence_timestamp <= 0
       or nullif(btrim(p_evidence_source), '') is null then
        raise exception 'Invalid clan achievement evidence';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('clan-achievement:' || p_clan_tag, 0));
    select family_ids, progress_values
      into v_family_ids, v_progress_values
      from public.clan_achievement_state
     where clan_tag = p_clan_tag and evidence_timestamp <= p_evidence_timestamp
     for update;
    if found is false and exists (
        select 1 from public.clan_achievement_state where clan_tag = p_clan_tag
          and evidence_timestamp > p_evidence_timestamp
    ) then
        return jsonb_build_object('clanTag', p_clan_tag, 'saved', 0, 'newUnlocks', 0);
    end if;
    v_family_ids := coalesce(v_family_ids, '{}'::smallint[]);
    v_progress_values := coalesce(v_progress_values, '{}'::bigint[]);

    for v_item in
        select value from jsonb_array_elements(coalesce(p_progress, '[]'::jsonb))
        order by value->>'family_key', value->>'achievement_key', coalesce((value->>'tier')::integer, 0)
    loop
        if lower(coalesce(v_item->>'scope', '')) <> 'clan' then continue; end if;
        v_family_id := public.upsert_achievement_definition_v2(v_item, 'clan');
        if v_item ? 'progress_known' and coalesce((v_item->>'progress_known')::boolean, false) = false then
            continue;
        end if;
        select comparison into v_comparison from public.achievement_families where family_id = v_family_id;
        v_input_progress := case when (v_item->>'progress') ~ '^\d+$'
                                 then (v_item->>'progress')::bigint else 0 end;
        if v_comparison = 'BOOLEAN' and coalesce((v_item->>'unlocked')::boolean, false) then
            v_input_progress := greatest(v_input_progress, 1);
        end if;
        if array_position(v_family_ids, v_family_id) is null then v_old_progress := null;
        else v_old_progress := v_progress_values[array_position(v_family_ids, v_family_id)]; end if;
        if v_old_progress is null
           and v_input_progress = 0
           and not coalesce((v_item->>'unlocked')::boolean, false) then
            continue;
        end if;
        select family_ids, progress_values into v_family_ids, v_progress_values
          from public.merge_achievement_arrays_v2(
              v_family_ids, v_progress_values, v_family_id,
              v_input_progress,
              v_comparison
          );
        v_new_progress := v_progress_values[array_position(v_family_ids, v_family_id)];
        for v_definition in
            select d.achievement_id, d.target, f.comparison
            from public.achievement_definitions d
            join public.achievement_families f on f.family_id = d.family_id
            where d.family_id = v_family_id
        loop
            if (v_definition.comparison = 'GTE' and v_new_progress >= v_definition.target)
               or (v_definition.comparison = 'LTE' and v_new_progress > 0 and v_new_progress <= v_definition.target)
               or (v_definition.comparison = 'BOOLEAN' and v_new_progress > 0) then
                insert into public.clan_achievement_unlocks (clan_tag, achievement_id, unlocked_at)
                values (p_clan_tag, v_definition.achievement_id, now())
                on conflict (clan_tag, achievement_id) do nothing;
                get diagnostics v_inserted = row_count;
                v_new_unlocks := v_new_unlocks + v_inserted;
            end if;
        end loop;
        v_saved := v_saved + 1;
    end loop;

    if v_saved > 0 then
        insert into public.clan_achievement_state
            (clan_tag, family_ids, progress_values, evidence_timestamp, evidence_source)
        values (p_clan_tag, v_family_ids, v_progress_values, p_evidence_timestamp, btrim(p_evidence_source))
        on conflict (clan_tag) do update
        set family_ids = excluded.family_ids, progress_values = excluded.progress_values,
            evidence_timestamp = greatest(public.clan_achievement_state.evidence_timestamp, excluded.evidence_timestamp),
            evidence_source = case when excluded.evidence_timestamp >= public.clan_achievement_state.evidence_timestamp
                                   then excluded.evidence_source else public.clan_achievement_state.evidence_source end,
            updated_at = now();
    end if;
    return jsonb_build_object('clanTag', p_clan_tag, 'saved', v_saved, 'newUnlocks', v_new_unlocks);
end;
$$;

create or replace function public.reconcile_clan_achievement_progress_v1(
    p_clan_tag text,
    p_evidence_timestamp bigint,
    p_evidence_source text,
    p_progress jsonb
) returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
select public.reconcile_clan_achievement_progress_v2(
    p_clan_tag, p_evidence_timestamp, p_evidence_source, p_progress
);
$$;

-- Advanced Stats deletion only removes its ten compact metric families and
-- their sparse events; unrelated achievement state stays intact.
create or replace function public.delete_advanced_stats_tracking_v1(
    p_user_id uuid,
    p_player_tag text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_tracking_id uuid;
    v_state_rows integer := 0;
    v_unlock_rows integer := 0;
    v_legacy_rows integer := 0;
    v_target_count integer := 0;
    v_keep_ids smallint[];
    v_keep_values bigint[];
    v_state record;
begin
    if p_user_id is null or p_player_tag is null or btrim(p_player_tag) = '' then
        raise exception 'Missing required Advanced Stats delete identity';
    end if;
    -- Delete the tracker first so guarded collectors cannot cross this fence.
    delete from public.advanced_stats_tracking
     where user_id = p_user_id and player_tag = p_player_tag
     returning id into v_tracking_id;

    -- Reconcile calls that passed the tracker fence before deletion finish
    -- before compact state is removed.
    perform pg_advisory_xact_lock(hashtextextended('achievement:' || p_user_id || E'\x1f' || p_player_tag, 0));
    select * into v_state from public.player_achievement_state
     where user_id = p_user_id and player_tag = p_player_tag for update;
    if found then
        select count(*) into v_target_count
          from unnest(v_state.family_ids) pair(id)
         where exists (
             select 1 from public.achievement_families f
             where f.family_id = pair.id and f.metric in
                 ('tracked_attack_count', 'tracked_star_count', 'tracked_three_star_count',
                  'tracked_two_star_count', 'tracked_one_star_count', 'tracked_zero_star_count',
                  'tracked_gold_looted', 'tracked_elixir_looted',
                  'tracked_dark_elixir_looted', 'tracked_active_days')
         );
        select array_agg(id order by id)::smallint[], array_agg(value order by id)::bigint[]
          into v_keep_ids, v_keep_values
          from unnest(v_state.family_ids, v_state.progress_values) pair(id, value)
         where not exists (
             select 1 from public.achievement_families f
             where f.family_id = pair.id and f.metric in
                 ('tracked_attack_count', 'tracked_star_count', 'tracked_three_star_count',
                  'tracked_two_star_count', 'tracked_one_star_count', 'tracked_zero_star_count',
                  'tracked_gold_looted', 'tracked_elixir_looted',
                  'tracked_dark_elixir_looted', 'tracked_active_days')
         );
        if v_target_count > 0 then
            delete from public.player_achievement_unlocks u
             where u.user_id = p_user_id and u.player_tag = p_player_tag
               and u.achievement_id in (
                   select d.achievement_id from public.achievement_definitions d
                   join public.achievement_families f on f.family_id = d.family_id
                   where f.metric in ('tracked_attack_count', 'tracked_star_count', 'tracked_three_star_count',
                                      'tracked_two_star_count', 'tracked_one_star_count', 'tracked_zero_star_count',
                                      'tracked_gold_looted', 'tracked_elixir_looted',
                                      'tracked_dark_elixir_looted', 'tracked_active_days')
               );
            get diagnostics v_unlock_rows = row_count;
            if v_keep_ids is null or cardinality(v_keep_ids) = 0 then
                delete from public.player_achievement_state
                 where user_id = p_user_id and player_tag = p_player_tag;
                get diagnostics v_state_rows = row_count;
            else
                update public.player_achievement_state
                   set family_ids = v_keep_ids, progress_values = v_keep_values, updated_at = now()
                 where user_id = p_user_id and player_tag = p_player_tag;
                get diagnostics v_state_rows = row_count;
            end if;
        end if;
    end if;
    delete from public.achievement_progress
     where user_id = p_user_id and player_tag = p_player_tag
       and metric in ('tracked_attack_count', 'tracked_star_count', 'tracked_three_star_count',
                      'tracked_two_star_count', 'tracked_one_star_count', 'tracked_zero_star_count',
                      'tracked_gold_looted', 'tracked_elixir_looted',
                      'tracked_dark_elixir_looted', 'tracked_active_days');
    get diagnostics v_legacy_rows = row_count;
    return jsonb_build_object(
        'deleted', v_tracking_id is not null, 'trackingId', v_tracking_id,
        'achievementRowsDeleted', v_legacy_rows,
        'compactStateRowsDeleted', v_state_rows,
        'compactUnlocksDeleted', v_unlock_rows
    );
end;
$$;

revoke all on function public.merge_achievement_arrays_v2(smallint[], bigint[], smallint, bigint, text)
    from public, anon, authenticated;
revoke all on function public.upsert_achievement_definition_v2(jsonb, text)
    from public, anon, authenticated;
revoke all on function public.reconcile_achievement_progress_v2(uuid, text, bigint, jsonb)
    from public, anon, authenticated;
revoke all on function public.save_achievement_import(uuid, text, bigint, text, jsonb, jsonb, jsonb)
    from public, anon, authenticated;
revoke all on function public.reconcile_advanced_stats_achievement_progress_v1(uuid, text, bigint, jsonb)
    from public, anon, authenticated;
revoke all on function public.reconcile_clan_achievement_progress_v2(text, bigint, text, jsonb)
    from public, anon, authenticated;
revoke all on function public.reconcile_clan_achievement_progress_v1(text, bigint, text, jsonb)
    from public, anon, authenticated;
revoke all on function public.delete_advanced_stats_tracking_v1(uuid, text)
    from public, anon, authenticated;
grant execute on function public.merge_achievement_arrays_v2(smallint[], bigint[], smallint, bigint, text) to service_role;
grant execute on function public.upsert_achievement_definition_v2(jsonb, text) to service_role;
grant execute on function public.reconcile_achievement_progress_v2(uuid, text, bigint, jsonb) to service_role;
grant execute on function public.save_achievement_import(uuid, text, bigint, text, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.reconcile_advanced_stats_achievement_progress_v1(uuid, text, bigint, jsonb) to service_role;
grant execute on function public.reconcile_clan_achievement_progress_v2(text, bigint, text, jsonb) to service_role;
grant execute on function public.reconcile_clan_achievement_progress_v1(text, bigint, text, jsonb) to service_role;
grant execute on function public.delete_advanced_stats_tracking_v1(uuid, text) to service_role;

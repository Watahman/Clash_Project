-- Preserve the legacy per-tier copy contract in the compact catalog.
-- Progress remains one row per subject/family; title and description are
-- immutable catalog attributes of a tier definition.

alter table public.achievement_definitions
    add column if not exists title text not null default '',
    add column if not exists description text not null default '';

-- Legacy rows are repeated per subject, so choose one deterministic catalog
-- copy for each definition. The family copy is only a fallback for definitions
-- that have no legacy row (for example a newly seeded fixed tier).
with legacy_rows as (
    select achievement_key, tier, title, description, 0 as scope_order
    from public.achievement_progress
    union all
    select achievement_key, tier, title, description, 1
    from public.clan_achievement_progress
), canonical as (
    select distinct on (achievement_key, tier)
        achievement_key, tier, title, description
    from legacy_rows
    order by achievement_key, tier, scope_order, title, description
), resolved as (
    select d.achievement_id,
        case
            when c.achievement_key is not null then coalesce(c.title, '')
            else coalesce(f.title, '')
        end as title,
        case
            when c.achievement_key is not null then coalesce(c.description, '')
            else coalesce(f.description, '')
        end as description
    from public.achievement_definitions d
    join public.achievement_families f on f.family_id = d.family_id
    left join canonical c
      on c.achievement_key = d.achievement_key
     and c.tier = d.tier
)
update public.achievement_definitions d
set title = r.title, description = r.description
from resolved r
where r.achievement_id = d.achievement_id;

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
    v_title text := coalesce(p_item->>'title', '');
    v_description text := coalesce(p_item->>'description', '');
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
        v_family_key, v_scope, v_category, v_metric, v_title, v_description, v_comparison
    )
    on conflict (family_key) do update
    set category = case when excluded.category <> '' then excluded.category else public.achievement_families.category end,
        metric = case when excluded.metric <> 'achievement' then excluded.metric else public.achievement_families.metric end,
        title = case when excluded.title <> '' then excluded.title else public.achievement_families.title end,
        description = case when excluded.description <> '' then excluded.description else public.achievement_families.description end,
        comparison = case when v_explicit_comparison then excluded.comparison else public.achievement_families.comparison end
    returning family_id into v_family_id;

    insert into public.achievement_definitions (
        family_id, achievement_key, tier, target, xp, rarity, title, description
    ) values (
        v_family_id, v_achievement_key, v_tier, v_target, v_xp,
        coalesce(p_item->>'rarity', ''), v_title, v_description
    )
    on conflict (achievement_key) do update
    set family_id = excluded.family_id,
        tier = excluded.tier,
        target = excluded.target,
        xp = excluded.xp,
        rarity = case when excluded.rarity <> '' then excluded.rarity else public.achievement_definitions.rarity end,
        title = case when excluded.title <> '' then excluded.title else public.achievement_definitions.title end,
        description = case when excluded.description <> '' then excluded.description else public.achievement_definitions.description end;
    return v_family_id;
end;
$$;

create or replace function public.read_achievement_progress_v2(
    p_user_id uuid,
    p_player_tag text
) returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
with state_values as (
    select s.source_timestamp, s.updated_at, pair.family_id, pair.progress
    from public.player_achievement_state s
    cross join lateral unnest(s.family_ids, s.progress_values) as pair(family_id, progress)
    where s.user_id = p_user_id and s.player_tag = p_player_tag
), rows as (
    select d.achievement_key, f.family_key, d.title, d.description, f.category,
        d.rarity, d.tier, d.xp, f.metric, v.progress, d.target,
        case
            when f.comparison = 'GTE' then v.progress >= d.target
            when f.comparison = 'LTE' then v.progress > 0 and v.progress <= d.target
            when f.comparison = 'BOOLEAN' then v.progress > 0
            else false
        end or u.achievement_id is not null as unlocked,
        u.unlocked_at, v.source_timestamp, v.updated_at
    from state_values v
    join public.achievement_families f on f.family_id = v.family_id and f.scope = 'player'
    join public.achievement_definitions d on d.family_id = f.family_id
    left join public.player_achievement_unlocks u
      on u.user_id = p_user_id and u.player_tag = p_player_tag
     and u.achievement_id = d.achievement_id
)
select coalesce(jsonb_agg(jsonb_build_object(
    'achievement_key', achievement_key,
    'family_key', family_key,
    'title', title,
    'description', description,
    'category', category,
    'rarity', rarity,
    'tier', tier,
    'xp', xp,
    'metric', metric,
    'progress', progress,
    'target', target,
    'unlocked', unlocked,
    'unlocked_at', unlocked_at,
    'source_timestamp', source_timestamp,
    'updated_at', updated_at
) order by category, family_key, tier), '[]'::jsonb)
from rows;
$$;

create or replace function public.read_clan_achievement_progress_v2(
    p_clan_tag text
) returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
with state_values as (
    select s.evidence_timestamp, s.evidence_source, s.updated_at,
        pair.family_id, pair.progress
    from public.clan_achievement_state s
    cross join lateral unnest(s.family_ids, s.progress_values) as pair(family_id, progress)
    where s.clan_tag = p_clan_tag
), rows as (
    select d.achievement_key, f.family_key, d.title, d.description, f.category,
        d.rarity, d.tier, f.metric, v.progress, d.target,
        case
            when f.comparison = 'GTE' then v.progress >= d.target
            when f.comparison = 'LTE' then v.progress > 0 and v.progress <= d.target
            when f.comparison = 'BOOLEAN' then v.progress > 0
            else false
        end or u.achievement_id is not null as unlocked,
        u.unlocked_at, v.evidence_timestamp, v.evidence_source, v.updated_at
    from state_values v
    join public.achievement_families f on f.family_id = v.family_id and f.scope = 'clan'
    join public.achievement_definitions d on d.family_id = f.family_id
    left join public.clan_achievement_unlocks u
      on u.clan_tag = p_clan_tag and u.achievement_id = d.achievement_id
)
select coalesce(jsonb_agg(jsonb_build_object(
    'achievement_key', achievement_key,
    'family_key', family_key,
    'title', title,
    'description', description,
    'category', category,
    'rarity', rarity,
    'tier', tier,
    'metric', metric,
    'progress', progress,
    'target', target,
    'unlocked', unlocked,
    'unlocked_at', unlocked_at,
    'evidence_timestamp', evidence_timestamp,
    'evidence_source', evidence_source,
    'updated_at', updated_at
) order by category, family_key, tier), '[]'::jsonb)
from rows;
$$;

revoke all on function public.read_achievement_progress_v2(uuid, text)
    from public, anon, authenticated;
revoke all on function public.read_clan_achievement_progress_v2(text)
    from public, anon, authenticated;
revoke all on function public.upsert_achievement_definition_v2(jsonb, text)
    from public, anon, authenticated;
grant execute on function public.read_achievement_progress_v2(uuid, text) to service_role;
grant execute on function public.read_clan_achievement_progress_v2(text) to service_role;
grant execute on function public.upsert_achievement_definition_v2(jsonb, text) to service_role;

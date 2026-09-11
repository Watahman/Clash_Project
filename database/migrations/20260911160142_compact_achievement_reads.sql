-- Read projections keep callers on the legacy row contract while reading only
-- the compact subject state and global catalog.

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
    select d.achievement_key, f.family_key, f.title, f.description, f.category,
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
    select d.achievement_key, f.family_key, f.title, f.description, f.category,
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
grant execute on function public.read_achievement_progress_v2(uuid, text) to service_role;
grant execute on function public.read_clan_achievement_progress_v2(text) to service_role;

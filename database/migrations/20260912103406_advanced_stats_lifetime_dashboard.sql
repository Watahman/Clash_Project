-- All-time Advanced Stats read model.
--
-- The compact daily tables are the only source used here.  Scope rows can
-- overlap on a calendar date, so tracked days are counted distinctly.  Raw
-- attack order is not retained by the compact model; perfect and streak
-- values therefore remain explicit JSON nulls instead of inferred values.
-- Compact destruction totals have no historical known-value counter.  This
-- migration does not mark old rows as known or rewrite the active writer; the
-- lifetime and trend destruction projections stay null until coverage can be
-- proven by a future forward-only schema change.

begin;

create or replace function public.read_advanced_stats_lifetime_v1(
    p_tracking_id uuid
) returns jsonb
language sql stable security invoker set search_path = public, pg_temp
as $$
with daily as (
    select d.stat_date, d.scope,
           d.attacks, d.total_stars,
           d.three_star_attacks, d.two_star_attacks,
           d.one_star_attacks, d.zero_star_attacks
      from public.advanced_stats_scope_daily d
     where d.tracking_id = p_tracking_id
       and d.scope in ('NORMAL', 'WAR', 'RANKED')
), totals as (
    select coalesce(sum(attacks), 0)::bigint attacks,
           coalesce(sum(total_stars), 0)::bigint total_stars,
           coalesce(sum(three_star_attacks), 0)::bigint three_star_count,
           coalesce(sum(two_star_attacks), 0)::bigint two_star_count,
           coalesce(sum(one_star_attacks), 0)::bigint one_star_count,
           coalesce(sum(zero_star_attacks), 0)::bigint zero_star_count,
           coalesce(sum(three_star_attacks + two_star_attacks
                      + one_star_attacks + zero_star_attacks), 0)::bigint star_known_attacks,
           count(distinct stat_date)::bigint tracked_attack_days
      from daily
), category_totals as (
    select categories.category,
           coalesce(sum(d.attacks), 0)::bigint attacks,
           coalesce(sum(d.total_stars), 0)::bigint total_stars,
           coalesce(sum(d.three_star_attacks), 0)::bigint three_star_count,
           coalesce(sum(d.three_star_attacks + d.two_star_attacks
                      + d.one_star_attacks + d.zero_star_attacks), 0)::bigint star_known_attacks
      from (values
                ('regular'::text, 'NORMAL'::text),
                ('competitive'::text, 'WAR'::text),
                ('competitive'::text, 'RANKED'::text)
           ) as categories(category, scope)
      left join daily d on d.scope = categories.scope
     group by categories.category
), category_json as (
    select jsonb_object_agg(category, jsonb_build_object(
        'attacks', attacks,
        'averageStars', round(total_stars::numeric / nullif(star_known_attacks, 0), 2),
        'threeStarRate', round(100.0 * three_star_count
            / nullif(star_known_attacks, 0), 2),
        'averageDestruction', null::numeric,
        'sampleSize', star_known_attacks
    )) as value
      from category_totals
), monthly as (
    select date_trunc('month', stat_date)::date as month,
           sum(attacks)::bigint attacks,
           sum(total_stars)::bigint total_stars,
           sum(three_star_attacks)::bigint three_star_count,
           sum(three_star_attacks + two_star_attacks
             + one_star_attacks + zero_star_attacks)::bigint star_known_attacks
      from daily
     group by date_trunc('month', stat_date)::date
), month_json as (
    select
        (select jsonb_build_object(
            'month', month,
            'attacks', attacks
        ) from monthly order by attacks desc, month desc limit 1) as most_active,
        (select jsonb_build_object(
            'month', month,
            'attacks', attacks,
            'averageStars', round(total_stars::numeric / nullif(star_known_attacks, 0), 2),
            'threeStarRate', round(100.0 * three_star_count
                / nullif(star_known_attacks, 0), 2),
            'averageDestruction', null::numeric,
            'sampleSize', star_known_attacks,
            'minimumSample', 5
        ) from monthly
         where star_known_attacks >= 5
         order by total_stars::numeric / nullif(star_known_attacks, 0) desc nulls last,
                  three_star_count::numeric / nullif(star_known_attacks, 0) desc nulls last,
                  month desc
         limit 1) as best_performance
), unit_totals as (
    select u.unit_key,
           max(u.unit_name) as unit_name,
           u.category,
           sum(u.total_quantity)::bigint as total_quantity,
           sum(u.battles_present)::bigint as battles_present
      from public.advanced_stats_scope_unit_daily u
     where u.tracking_id = p_tracking_id
       and u.scope in ('NORMAL', 'WAR', 'RANKED')
     group by u.unit_key, u.category
), unit_ranked as (
    select u.*,
           case when u.category in ('TROOP', 'SUPER_TROOP') then 'troop'
                when u.category = 'SPELL' then 'spell'
                when u.category = 'SIEGE' then 'siege'
           end as favorite_group,
           row_number() over (
               partition by case when u.category in ('TROOP', 'SUPER_TROOP') then 'troop'
                                  when u.category = 'SPELL' then 'spell'
                                  when u.category = 'SIEGE' then 'siege'
                             end
               order by u.total_quantity desc, u.battles_present desc, u.unit_key
           ) as favorite_rank
      from unit_totals u
     where u.category in ('TROOP', 'SUPER_TROOP', 'SPELL', 'SIEGE')
), army_totals as (
    select a.army_hash,
           d.normalized_army_json,
           sum(a.battle_count)::bigint as battle_count,
           sum(a.total_stars)::bigint as total_stars
      from public.advanced_stats_scope_army_daily a
      join public.advanced_stats_army_dictionary d
        on d.army_hash = a.army_hash
     where a.tracking_id = p_tracking_id
       and a.scope in ('NORMAL', 'WAR', 'RANKED')
     group by a.army_hash, d.normalized_army_json
), favorite_json as (
    select jsonb_build_object(
        'troop', (select jsonb_build_object(
            'key', unit_key, 'name', unit_name, 'category', category,
            'totalQuantity', total_quantity, 'battlesPresent', battles_present
        ) from unit_ranked where favorite_group = 'troop' and favorite_rank = 1),
        'spell', (select jsonb_build_object(
            'key', unit_key, 'name', unit_name, 'category', category,
            'totalQuantity', total_quantity, 'battlesPresent', battles_present
        ) from unit_ranked where favorite_group = 'spell' and favorite_rank = 1),
        'siege', (select jsonb_build_object(
            'key', unit_key, 'name', unit_name, 'category', category,
            'totalQuantity', total_quantity, 'battlesPresent', battles_present
        ) from unit_ranked where favorite_group = 'siege' and favorite_rank = 1),
        'army', (select jsonb_build_object(
            'armyHash', army_hash, 'army', normalized_army_json,
            'battleCount', battle_count,
            'averageStars', round(total_stars::numeric / nullif(battle_count, 0), 2),
            'averageDestruction', null::numeric
        ) from army_totals order by battle_count desc, army_hash limit 1)
    ) as value
), army_json as (
    select
        (select jsonb_build_object(
            'armyHash', army_hash, 'army', normalized_army_json,
            'battleCount', battle_count,
            'averageStars', round(total_stars::numeric / nullif(battle_count, 0), 2),
            'averageDestruction', null::numeric
        ) from army_totals
         order by battle_count desc, army_hash limit 1) as most_used,
        (select jsonb_build_object(
            'armyHash', army_hash, 'army', normalized_army_json,
            'battleCount', battle_count,
            'averageStars', round(total_stars::numeric / nullif(battle_count, 0), 2),
            'averageDestruction', null::numeric
        ) from army_totals
         where battle_count >= 5
         order by total_stars::numeric / nullif(battle_count, 0) desc nulls last,
                  battle_count desc, army_hash
         limit 1) as most_successful
)
select jsonb_build_object(
    'summary', jsonb_build_object(
        'attacks', totals.attacks,
        'totalStars', case when totals.star_known_attacks = 0 then null::bigint else totals.total_stars end,
        'totalDestruction', null::numeric,
        'threeStarCount', totals.three_star_count,
        'starKnownAttacks', totals.star_known_attacks,
        'unknownStarAttacks', greatest(totals.attacks - totals.star_known_attacks, 0),
        'trackedAttackDays', totals.tracked_attack_days,
        'perfectAttacks', null::jsonb,
        'bestThreeStarStreak', null::jsonb,
        'currentThreeStarStreak', null::jsonb
    ),
    'starDistribution', jsonb_build_object(
        'zero', totals.zero_star_count,
        'one', totals.one_star_count,
        'two', totals.two_star_count,
        'three', totals.three_star_count,
        'unknown', greatest(totals.attacks - totals.star_known_attacks, 0)
    ),
    'categories', category_json.value,
    'mostActiveMonth', month_json.most_active,
    'bestPerformanceMonth', month_json.best_performance,
    'favorites', favorite_json.value,
    'mostUsedArmy', army_json.most_used,
    'mostSuccessfulArmy', army_json.most_successful,
    'minimumPerformanceSample', 5,
    'availability', jsonb_build_object(
        'stars', case when totals.star_known_attacks < totals.attacks then
            jsonb_build_object('available', false, 'code', 'star_coverage_partial')
            else jsonb_build_object('available', true, 'code', 'star_coverage_complete') end,
        'destruction', jsonb_build_object(
            'available', false,
            'code', 'destruction_coverage_unavailable'
        ),
        'perfectAttacks', jsonb_build_object(
            'available', false,
            'code', 'raw_attack_sequence_unavailable'
        ),
        'streaks', jsonb_build_object(
            'available', false,
            'code', 'raw_attack_sequence_unavailable'
        ),
        'minimumPerformanceSample', 5
    )
)
from totals, category_json, month_json, favorite_json, army_json;
$$;

revoke all on function public.read_advanced_stats_lifetime_v1(uuid)
    from public, anon, authenticated;
grant execute on function public.read_advanced_stats_lifetime_v1(uuid)
    to service_role;

-- The compact writer stores destruction as a sum, but does not retain how many
-- source values were known. Keep this established array contract while making
-- the unsafe metric explicitly unavailable and weighting star metrics only by
-- their known star buckets.
create or replace function public.read_advanced_stats_compact_trends_v1(
    p_tracking_id uuid, p_scope text, p_from timestamptz default null
) returns jsonb
language sql stable security invoker set search_path = public, pg_temp
as $$
with points as (
    select d.stat_date, d.attacks, d.total_stars, d.three_star_attacks,
           (d.three_star_attacks + d.two_star_attacks
            + d.one_star_attacks + d.zero_star_attacks)::bigint as sample_size,
           d.loot_known_attacks, d.reliable_gold_looted, d.reliable_elixir_looted,
           d.reliable_dark_elixir_looted, d.best_gold_looted, d.best_elixir_looted,
           d.best_dark_elixir_looted
      from public.advanced_stats_scope_daily d
     where d.tracking_id = p_tracking_id
       and d.scope = upper(btrim(p_scope))
       and (p_from is null or d.stat_date >= (p_from at time zone 'UTC')::date)
)
select coalesce(jsonb_agg(jsonb_build_object(
    'date', p.stat_date, 'attacks', p.attacks, 'sampleSize', p.sample_size,
    'averageStars', round(p.total_stars::numeric / nullif(p.sample_size, 0), 2),
    'averageDestruction', null::numeric,
    'destructionAvailability', jsonb_build_object(
        'available', false, 'code', 'destruction_coverage_unavailable'),
    'threeStarRate', round(100.0 * p.three_star_attacks
        / nullif(p.sample_size, 0), 2),
    'lootKnownAttackCount', p.loot_known_attacks, 'lootAttackCount', p.loot_known_attacks,
    'goldLooted', case when p.loot_known_attacks = 0 then null else p.reliable_gold_looted end,
    'elixirLooted', case when p.loot_known_attacks = 0 then null else p.reliable_elixir_looted end,
    'darkElixirLooted', case when p.loot_known_attacks = 0 then null else p.reliable_dark_elixir_looted end,
    'goldLootAverage', case when p.loot_known_attacks = 0 then null else round(p.reliable_gold_looted::numeric / p.loot_known_attacks, 2) end,
    'elixirLootAverage', case when p.loot_known_attacks = 0 then null else round(p.reliable_elixir_looted::numeric / p.loot_known_attacks, 2) end,
    'darkElixirLootAverage', case when p.loot_known_attacks = 0 then null else round(p.reliable_dark_elixir_looted::numeric / p.loot_known_attacks, 2) end,
    'averageGoldLooted', case when p.loot_known_attacks = 0 then null else round(p.reliable_gold_looted::numeric / p.loot_known_attacks, 2) end,
    'averageElixirLooted', case when p.loot_known_attacks = 0 then null else round(p.reliable_elixir_looted::numeric / p.loot_known_attacks, 2) end,
    'averageDarkElixirLooted', case when p.loot_known_attacks = 0 then null else round(p.reliable_dark_elixir_looted::numeric / p.loot_known_attacks, 2) end,
    'goldLootBest', case when p.loot_known_attacks = 0 then null else p.best_gold_looted end,
    'elixirLootBest', case when p.loot_known_attacks = 0 then null else p.best_elixir_looted end,
    'darkElixirLootBest', case when p.loot_known_attacks = 0 then null else p.best_dark_elixir_looted end,
    'bestGoldLooted', case when p.loot_known_attacks = 0 then null else p.best_gold_looted end,
    'bestElixirLooted', case when p.loot_known_attacks = 0 then null else p.best_elixir_looted end,
    'bestDarkElixirLooted', case when p.loot_known_attacks = 0 then null else p.best_dark_elixir_looted end
) order by p.stat_date), '[]'::jsonb)
from points p;
$$;

create or replace function public.read_advanced_stats_compact_trends_v2(
    p_tracking_id uuid, p_scope text, p_from timestamptz default null,
    p_season_key text default null
) returns jsonb
language sql stable security invoker set search_path = public, pg_temp
as $$
with normalized as (select upper(btrim(p_scope)) as scope), state as (
    select s.* from public.advanced_stats_scope_state s, normalized n
     where s.tracking_id = p_tracking_id and s.scope = n.scope
), selected as (
    select n.scope, case when n.scope = 'RANKED' then
        public.normalize_advanced_stats_ranked_season_key_v1(n.scope,
            case when p_season_key is null then coalesce(state.source_season_key, '')
                 else btrim(p_season_key) end)
        else public.normalize_advanced_stats_ranked_season_key_v1(n.scope, '') end as season_key
      from normalized n left join state on true
), points as (
    select d.stat_date, d.attacks, d.total_stars, d.three_star_attacks,
           (d.three_star_attacks + d.two_star_attacks
            + d.one_star_attacks + d.zero_star_attacks)::bigint as sample_size,
           d.loot_known_attacks, d.reliable_gold_looted, d.reliable_elixir_looted,
           d.reliable_dark_elixir_looted, d.best_gold_looted, d.best_elixir_looted,
           d.best_dark_elixir_looted
      from public.advanced_stats_scope_daily d, selected x
     where d.tracking_id = p_tracking_id and d.scope = x.scope
       and d.season_key = x.season_key
       and (p_from is null or d.stat_date >= (p_from at time zone 'UTC')::date)
)
select coalesce(jsonb_agg(jsonb_build_object(
    'date', p.stat_date, 'attacks', p.attacks, 'sampleSize', p.sample_size,
    'averageStars', round(p.total_stars::numeric / nullif(p.sample_size, 0), 2),
    'averageDestruction', null::numeric,
    'destructionAvailability', jsonb_build_object(
        'available', false, 'code', 'destruction_coverage_unavailable'),
    'threeStarRate', round(100.0 * p.three_star_attacks
        / nullif(p.sample_size, 0), 2),
    'lootKnownAttackCount', p.loot_known_attacks, 'lootAttackCount', p.loot_known_attacks,
    'goldLooted', case when p.loot_known_attacks = 0 then null else p.reliable_gold_looted end,
    'elixirLooted', case when p.loot_known_attacks = 0 then null else p.reliable_elixir_looted end,
    'darkElixirLooted', case when p.loot_known_attacks = 0 then null else p.reliable_dark_elixir_looted end,
    'goldLootAverage', case when p.loot_known_attacks = 0 then null else round(p.reliable_gold_looted::numeric / p.loot_known_attacks, 2) end,
    'elixirLootAverage', case when p.loot_known_attacks = 0 then null else round(p.reliable_elixir_looted::numeric / p.loot_known_attacks, 2) end,
    'darkElixirLootAverage', case when p.loot_known_attacks = 0 then null else round(p.reliable_dark_elixir_looted::numeric / p.loot_known_attacks, 2) end,
    'averageGoldLooted', case when p.loot_known_attacks = 0 then null else round(p.reliable_gold_looted::numeric / p.loot_known_attacks, 2) end,
    'averageElixirLooted', case when p.loot_known_attacks = 0 then null else round(p.reliable_elixir_looted::numeric / p.loot_known_attacks, 2) end,
    'averageDarkElixirLooted', case when p.loot_known_attacks = 0 then null else round(p.reliable_dark_elixir_looted::numeric / p.loot_known_attacks, 2) end,
    'goldLootBest', case when p.loot_known_attacks = 0 then null else p.best_gold_looted end,
    'elixirLootBest', case when p.loot_known_attacks = 0 then null else p.best_elixir_looted end,
    'darkElixirLootBest', case when p.loot_known_attacks = 0 then null else p.best_dark_elixir_looted end,
    'bestGoldLooted', case when p.loot_known_attacks = 0 then null else p.best_gold_looted end,
    'bestElixirLooted', case when p.loot_known_attacks = 0 then null else p.best_elixir_looted end,
    'bestDarkElixirLooted', case when p.loot_known_attacks = 0 then null else p.best_dark_elixir_looted end
) order by p.stat_date), '[]'::jsonb)
from points p;
$$;

revoke all on function public.read_advanced_stats_compact_trends_v1(uuid,text,timestamptz)
    from public, anon, authenticated;
revoke all on function public.read_advanced_stats_compact_trends_v2(uuid,text,timestamptz,text)
    from public, anon, authenticated;
grant execute on function public.read_advanced_stats_compact_trends_v1(uuid,text,timestamptz)
    to service_role;
grant execute on function public.read_advanced_stats_compact_trends_v2(uuid,text,timestamptz,text)
    to service_role;

commit;

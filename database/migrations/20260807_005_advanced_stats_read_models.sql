-- Advanced Stats read models and per-battle army identity.
-- Read functions are backend/service-role only. User ownership is enforced by Java before RPC calls.

alter table public.advanced_stats_battles
    add column if not exists army_hash text
        check (army_hash is null or length(army_hash) = 64),
    add column if not exists normalized_army_json jsonb;

create index if not exists advanced_stats_battles_period_idx
    on public.advanced_stats_battles (
        tracking_id,
        (coalesce(battle_timestamp, observed_at)) desc,
        id desc
    )
    where is_attack = true and processing_status = 'PROCESSED';

create index if not exists advanced_stats_battles_army_period_idx
    on public.advanced_stats_battles (
        tracking_id,
        army_hash,
        (coalesce(battle_timestamp, observed_at)) desc
    )
    where is_attack = true
      and processing_status = 'PROCESSED'
      and army_hash is not null;

-- V3 keeps the proven V2 ingestion transaction, then persists the already validated
-- normalized army identity on the same processed battle row.
create or replace function public.save_advanced_stats_battle_v3(
    p_tracking_id uuid,
    p_player_tag text,
    p_battle_fingerprint text,
    p_battle_timestamp timestamptz,
    p_observed_at timestamptz,
    p_battle_type text,
    p_opponent_player_tag text,
    p_opponent_name text,
    p_opponent_town_hall integer,
    p_player_town_hall integer,
    p_stars smallint,
    p_destruction_percentage numeric,
    p_army_share_code text,
    p_army_data_available boolean,
    p_loot_gold bigint,
    p_loot_elixir bigint,
    p_loot_dark_elixir bigint,
    p_available_gold bigint,
    p_available_elixir bigint,
    p_available_dark_elixir bigint,
    p_bootstrap_import boolean,
    p_parser_version integer,
    p_units jsonb,
    p_army_hash text,
    p_normalized_army_json jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_result jsonb;
    v_battle_id uuid;
begin
    v_result := public.save_advanced_stats_battle_v2(
        p_tracking_id,
        p_player_tag,
        p_battle_fingerprint,
        p_battle_timestamp,
        p_observed_at,
        p_battle_type,
        p_opponent_player_tag,
        p_opponent_name,
        p_opponent_town_hall,
        p_player_town_hall,
        p_stars,
        p_destruction_percentage,
        p_army_share_code,
        p_army_data_available,
        p_loot_gold,
        p_loot_elixir,
        p_loot_dark_elixir,
        p_available_gold,
        p_available_elixir,
        p_available_dark_elixir,
        p_bootstrap_import,
        p_parser_version,
        p_units,
        p_army_hash,
        p_normalized_army_json
    );

    if coalesce((v_result->>'inserted')::boolean, false) then
        v_battle_id := nullif(v_result->>'battleId', '')::uuid;
        update public.advanced_stats_battles
           set army_hash = case
                   when coalesce(p_army_data_available, false)
                    and p_army_hash is not null
                    and length(p_army_hash) = 64
                   then p_army_hash
                   else null
               end,
               normalized_army_json = case
                   when coalesce(p_army_data_available, false) then p_normalized_army_json
                   else null
               end
         where id = v_battle_id;
    end if;

    return v_result;
end;
$$;

create or replace function public.read_advanced_stats_overview_v1(
    p_tracking_id uuid,
    p_from timestamptz default null
) returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
with filtered as (
    select b.*,
           coalesce(b.battle_timestamp, b.observed_at) as effective_at
      from public.advanced_stats_battles b
     where b.tracking_id = p_tracking_id
       and b.is_attack = true
       and b.processing_status = 'PROCESSED'
       and (p_from is null or coalesce(b.battle_timestamp, b.observed_at) >= p_from)
), totals as (
    select count(*)::bigint as attacks,
           coalesce(sum(stars), 0)::bigint as total_stars,
           coalesce(sum(destruction_percentage), 0)::numeric as total_destruction,
           count(*) filter (where stars = 3)::bigint as three_stars,
           coalesce(sum(loot_gold), 0)::bigint as gold_looted,
           coalesce(sum(loot_elixir), 0)::bigint as elixir_looted,
           coalesce(sum(loot_dark_elixir), 0)::bigint as dark_elixir_looted
      from filtered
), unit_rank as (
    select bu.category,
           bu.unit_key,
           max(bu.unit_name) as unit_name,
           sum(bu.quantity)::bigint as total_quantity,
           count(distinct bu.battle_id)::bigint as battles_present,
           row_number() over (
               partition by case
                   when bu.category in ('TROOP', 'SUPER_TROOP') then 'FAVORITE_TROOP'
                   when bu.category = 'SPELL' then 'FAVORITE_SPELL'
                   when bu.category = 'SIEGE' then 'FAVORITE_SIEGE'
                   else bu.category
               end
               order by sum(bu.quantity) desc, count(distinct bu.battle_id) desc, bu.unit_key
           ) as rn,
           case
               when bu.category in ('TROOP', 'SUPER_TROOP') then 'FAVORITE_TROOP'
               when bu.category = 'SPELL' then 'FAVORITE_SPELL'
               when bu.category = 'SIEGE' then 'FAVORITE_SIEGE'
               else bu.category
           end as favorite_group
      from filtered f
      join public.advanced_stats_battle_units bu on bu.battle_id = f.id
     where bu.category in ('TROOP', 'SUPER_TROOP', 'SPELL', 'SIEGE')
     group by bu.category, bu.unit_key
), army_rank as (
    select f.army_hash,
           f.normalized_army_json,
           count(*)::bigint as battle_count,
           coalesce(sum(f.stars), 0)::bigint as total_stars,
           coalesce(sum(f.destruction_percentage), 0)::numeric as total_destruction
      from filtered f
     where f.army_hash is not null
       and f.normalized_army_json is not null
     group by f.army_hash, f.normalized_army_json
     order by count(*) desc, coalesce(sum(f.stars), 0) desc, f.army_hash
     limit 1
), tracking as (
    select t.*
      from public.advanced_stats_tracking t
     where t.id = p_tracking_id
)
select jsonb_build_object(
    'tracking', jsonb_build_object(
        'status', tracking.status,
        'trackingStartedAt', tracking.tracking_started_at,
        'lastSuccessfulPollAt', tracking.last_successful_poll_at,
        'dataCompleteSince', tracking.data_complete_since,
        'hasPotentialGap', tracking.gap_started_at is not null,
        'battlesProcessed', tracking.battles_processed
    ),
    'summary', jsonb_build_object(
        'attacks', totals.attacks,
        'averageStars', case when totals.attacks = 0 then 0 else round(totals.total_stars::numeric / totals.attacks, 2) end,
        'averageDestruction', case when totals.attacks = 0 then 0 else round(totals.total_destruction / totals.attacks, 2) end,
        'threeStarRate', case when totals.attacks = 0 then 0 else round(100.0 * totals.three_stars / totals.attacks, 2) end,
        'goldLooted', totals.gold_looted,
        'elixirLooted', totals.elixir_looted,
        'darkElixirLooted', totals.dark_elixir_looted
    ),
    'favorites', jsonb_build_object(
        'troop', (
            select jsonb_build_object(
                'key', unit_key, 'name', unit_name, 'category', category,
                'totalQuantity', total_quantity, 'battlesPresent', battles_present
            ) from unit_rank where favorite_group = 'FAVORITE_TROOP' and rn = 1 limit 1
        ),
        'spell', (
            select jsonb_build_object(
                'key', unit_key, 'name', unit_name, 'category', category,
                'totalQuantity', total_quantity, 'battlesPresent', battles_present
            ) from unit_rank where favorite_group = 'FAVORITE_SPELL' and rn = 1 limit 1
        ),
        'siege', (
            select jsonb_build_object(
                'key', unit_key, 'name', unit_name, 'category', category,
                'totalQuantity', total_quantity, 'battlesPresent', battles_present
            ) from unit_rank where favorite_group = 'FAVORITE_SIEGE' and rn = 1 limit 1
        ),
        'army', (
            select jsonb_build_object(
                'armyHash', army_hash,
                'army', normalized_army_json,
                'battleCount', battle_count,
                'averageStars', case when battle_count = 0 then 0 else round(total_stars::numeric / battle_count, 2) end,
                'averageDestruction', case when battle_count = 0 then 0 else round(total_destruction / battle_count, 2) end
            ) from army_rank
        )
    )
)
from tracking cross join totals;
$$;

create or replace function public.read_advanced_stats_units_v1(
    p_tracking_id uuid,
    p_from timestamptz default null,
    p_category text default null
) returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
with filtered as (
    select b.id,
           coalesce(b.battle_timestamp, b.observed_at) as effective_at
      from public.advanced_stats_battles b
     where b.tracking_id = p_tracking_id
       and b.is_attack = true
       and b.processing_status = 'PROCESSED'
       and (p_from is null or coalesce(b.battle_timestamp, b.observed_at) >= p_from)
), total_battles as (
    select count(*)::numeric as value from filtered
), grouped as (
    select bu.category,
           bu.unit_key,
           max(bu.unit_name) as unit_name,
           sum(bu.quantity)::bigint as total_quantity,
           count(distinct bu.battle_id)::bigint as battles_present,
           min(f.effective_at) as first_seen_at,
           max(f.effective_at) as last_seen_at
      from filtered f
      join public.advanced_stats_battle_units bu on bu.battle_id = f.id
     where p_category is null or bu.category = p_category
     group by bu.category, bu.unit_key
)
select coalesce(jsonb_agg(
    jsonb_build_object(
        'key', g.unit_key,
        'name', g.unit_name,
        'category', g.category,
        'totalQuantity', g.total_quantity,
        'battlesPresent', g.battles_present,
        'usageRate', case when tb.value = 0 then 0 else round(100.0 * g.battles_present / tb.value, 2) end,
        'firstSeenAt', g.first_seen_at,
        'lastSeenAt', g.last_seen_at
    ) order by g.total_quantity desc, g.battles_present desc, g.unit_key
), '[]'::jsonb)
from grouped g cross join total_battles tb;
$$;

create or replace function public.read_advanced_stats_armies_v1(
    p_tracking_id uuid,
    p_from timestamptz default null,
    p_limit integer default 20
) returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
with grouped as (
    select b.army_hash,
           max(b.normalized_army_json) as normalized_army_json,
           count(*)::bigint as battle_count,
           coalesce(sum(b.stars), 0)::bigint as total_stars,
           coalesce(sum(b.destruction_percentage), 0)::numeric as total_destruction,
           min(coalesce(b.battle_timestamp, b.observed_at)) as first_seen_at,
           max(coalesce(b.battle_timestamp, b.observed_at)) as last_seen_at
      from public.advanced_stats_battles b
     where b.tracking_id = p_tracking_id
       and b.is_attack = true
       and b.processing_status = 'PROCESSED'
       and b.army_hash is not null
       and b.normalized_army_json is not null
       and (p_from is null or coalesce(b.battle_timestamp, b.observed_at) >= p_from)
     group by b.army_hash
     order by count(*) desc, coalesce(sum(b.stars), 0) desc, b.army_hash
     limit greatest(1, least(coalesce(p_limit, 20), 100))
)
select coalesce(jsonb_agg(
    jsonb_build_object(
        'armyHash', army_hash,
        'army', normalized_army_json,
        'battleCount', battle_count,
        'averageStars', case when battle_count = 0 then 0 else round(total_stars::numeric / battle_count, 2) end,
        'averageDestruction', case when battle_count = 0 then 0 else round(total_destruction / battle_count, 2) end,
        'firstSeenAt', first_seen_at,
        'lastSeenAt', last_seen_at
    ) order by battle_count desc, total_stars desc, army_hash
), '[]'::jsonb)
from grouped;
$$;

create or replace function public.read_advanced_stats_battles_v1(
    p_tracking_id uuid,
    p_from timestamptz default null,
    p_limit integer default 25,
    p_cursor_at timestamptz default null,
    p_cursor_id uuid default null
) returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
with page as (
    select b.*,
           coalesce(b.battle_timestamp, b.observed_at) as effective_at
      from public.advanced_stats_battles b
     where b.tracking_id = p_tracking_id
       and b.is_attack = true
       and b.processing_status = 'PROCESSED'
       and (p_from is null or coalesce(b.battle_timestamp, b.observed_at) >= p_from)
       and (
           p_cursor_at is null
           or coalesce(b.battle_timestamp, b.observed_at) < p_cursor_at
           or (
               coalesce(b.battle_timestamp, b.observed_at) = p_cursor_at
               and p_cursor_id is not null
               and b.id < p_cursor_id
           )
       )
     order by effective_at desc, b.id desc
     limit greatest(1, least(coalesce(p_limit, 25), 100)) + 1
), numbered as (
    select p.*,
           row_number() over (order by p.effective_at desc, p.id desc) as rn,
           greatest(1, least(coalesce(p_limit, 25), 100)) as requested_limit
      from page p
), visible as (
    select * from numbered where rn <= requested_limit
), last_visible as (
    select effective_at, id from visible order by effective_at asc, id asc limit 1
), has_more as (
    select exists(select 1 from numbered where rn > requested_limit) as value
)
select jsonb_build_object(
    'items', coalesce((
        select jsonb_agg(
            jsonb_build_object(
                'id', v.id,
                'battleAt', v.effective_at,
                'timestampSource', case when v.battle_timestamp is null then 'OBSERVED' else 'BATTLE' end,
                'battleType', v.battle_type,
                'opponentPlayerTag', v.opponent_player_tag,
                'opponentName', v.opponent_name,
                'opponentTownHall', v.opponent_town_hall,
                'playerTownHall', v.player_town_hall,
                'stars', v.stars,
                'destructionPercentage', v.destruction_percentage,
                'lootGold', v.loot_gold,
                'lootElixir', v.loot_elixir,
                'lootDarkElixir', v.loot_dark_elixir,
                'bootstrapImport', v.bootstrap_import,
                'armyHash', v.army_hash,
                'army', v.normalized_army_json,
                'units', coalesce((
                    select jsonb_agg(
                        jsonb_build_object(
                            'key', bu.unit_key,
                            'name', bu.unit_name,
                            'category', bu.category,
                            'quantity', bu.quantity,
                            'level', bu.unit_level
                        ) order by bu.category, bu.unit_key
                    )
                    from public.advanced_stats_battle_units bu
                    where bu.battle_id = v.id
                ), '[]'::jsonb)
            ) order by v.effective_at desc, v.id desc
        ) from visible v
    ), '[]'::jsonb),
    'hasMore', (select value from has_more),
    'nextCursorAt', case when (select value from has_more) then (select effective_at from last_visible) else null end,
    'nextCursorId', case when (select value from has_more) then (select id from last_visible) else null end
);
$$;

create or replace function public.read_advanced_stats_trends_v1(
    p_tracking_id uuid,
    p_from timestamptz default null
) returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
select coalesce(jsonb_agg(
    jsonb_build_object(
        'date', d.stat_date,
        'attacks', d.attacks,
        'averageStars', case when d.attacks = 0 then 0 else round(d.total_stars::numeric / d.attacks, 2) end,
        'averageDestruction', case when d.attacks = 0 then 0 else round(d.total_destruction / d.attacks, 2) end,
        'threeStarRate', case when d.attacks = 0 then 0 else round(100.0 * d.three_star_attacks / d.attacks, 2) end,
        'goldLooted', d.gold_looted,
        'elixirLooted', d.elixir_looted,
        'darkElixirLooted', d.dark_elixir_looted
    ) order by d.stat_date
), '[]'::jsonb)
from public.advanced_stats_daily d
where d.tracking_id = p_tracking_id
  and (p_from is null or d.stat_date >= (p_from at time zone 'UTC')::date);
$$;

revoke all on function public.save_advanced_stats_battle_v3(
    uuid, text, text, timestamptz, timestamptz, text, text, text, integer, integer,
    smallint, numeric, text, boolean, bigint, bigint, bigint, bigint, bigint, bigint,
    boolean, integer, jsonb, text, jsonb
) from public, anon, authenticated;
grant execute on function public.save_advanced_stats_battle_v3(
    uuid, text, text, timestamptz, timestamptz, text, text, text, integer, integer,
    smallint, numeric, text, boolean, bigint, bigint, bigint, bigint, bigint, bigint,
    boolean, integer, jsonb, text, jsonb
) to service_role;

revoke all on function public.read_advanced_stats_overview_v1(uuid, timestamptz)
    from public, anon, authenticated;
revoke all on function public.read_advanced_stats_units_v1(uuid, timestamptz, text)
    from public, anon, authenticated;
revoke all on function public.read_advanced_stats_armies_v1(uuid, timestamptz, integer)
    from public, anon, authenticated;
revoke all on function public.read_advanced_stats_battles_v1(uuid, timestamptz, integer, timestamptz, uuid)
    from public, anon, authenticated;
revoke all on function public.read_advanced_stats_trends_v1(uuid, timestamptz)
    from public, anon, authenticated;

grant execute on function public.read_advanced_stats_overview_v1(uuid, timestamptz) to service_role;
grant execute on function public.read_advanced_stats_units_v1(uuid, timestamptz, text) to service_role;
grant execute on function public.read_advanced_stats_armies_v1(uuid, timestamptz, integer) to service_role;
grant execute on function public.read_advanced_stats_battles_v1(uuid, timestamptz, integer, timestamptz, uuid) to service_role;
grant execute on function public.read_advanced_stats_trends_v1(uuid, timestamptz) to service_role;

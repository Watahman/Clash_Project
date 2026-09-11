-- Advanced Stats compact reads backed by the normalized army dictionary.
--
-- Loot projection keeps Gold, Elixir and Dark Elixir independent. The legacy
-- gold_looted columns are intentionally excluded: only reliable_* totals are
-- paired with loot_known_attacks. Unknown values remain JSON null; no
-- aggregate resource score is computed.

begin;

-- v1 compact reads remain available to older callers, but army payloads now
-- come from the dictionary and loot is null when no attack had known loot.
create or replace function public.read_advanced_stats_compact_overview_v1(
    p_tracking_id uuid, p_scope text, p_from timestamptz default null
) returns jsonb
language sql stable security invoker set search_path = public, pg_temp
as $$
with normalized as (select upper(btrim(p_scope)) as scope), filtered_daily as (
    select d.* from public.advanced_stats_scope_daily d, normalized n
     where d.tracking_id = p_tracking_id and d.scope = n.scope
       and (p_from is null or d.stat_date >= (p_from at time zone 'UTC')::date)
), totals as (
    select coalesce(sum(attacks), 0)::bigint attacks,
           coalesce(sum(total_stars), 0)::bigint total_stars,
           coalesce(sum(total_destruction), 0)::numeric total_destruction,
           coalesce(sum(three_star_attacks), 0)::bigint three_stars,
           coalesce(sum(reliable_gold_looted), 0)::bigint reliable_gold_looted,
           coalesce(sum(reliable_elixir_looted), 0)::bigint reliable_elixir_looted,
           coalesce(sum(reliable_dark_elixir_looted), 0)::bigint reliable_dark_elixir_looted,
           coalesce(sum(loot_known_attacks), 0)::bigint known_loot_attacks,
           max(best_gold_looted)::bigint best_gold_looted,
           max(best_elixir_looted)::bigint best_elixir_looted,
           max(best_dark_elixir_looted)::bigint best_dark_elixir_looted
      from filtered_daily
), unit_rank as (
    select u.unit_key, max(u.unit_name) unit_name, u.category,
           sum(u.total_quantity)::bigint total_quantity, sum(u.battles_present)::bigint battles_present,
           case when u.category in ('TROOP', 'SUPER_TROOP') then 'FAVORITE_TROOP'
                when u.category = 'SPELL' then 'FAVORITE_SPELL'
                when u.category = 'SIEGE' then 'FAVORITE_SIEGE' else u.category end favorite_group,
           row_number() over (partition by case when u.category in ('TROOP', 'SUPER_TROOP') then 'FAVORITE_TROOP'
                when u.category = 'SPELL' then 'FAVORITE_SPELL' when u.category = 'SIEGE' then 'FAVORITE_SIEGE'
                else u.category end order by sum(u.total_quantity) desc, sum(u.battles_present) desc, u.unit_key) rn
      from public.advanced_stats_scope_unit_daily u, normalized n
     where u.tracking_id = p_tracking_id and u.scope = n.scope
       and (p_from is null or u.stat_date >= (p_from at time zone 'UTC')::date)
     group by u.unit_key, u.category
), army_rank as (
    select a.army_hash, d.normalized_army_json,
           sum(a.battle_count)::bigint battle_count, sum(a.total_stars)::bigint total_stars,
           sum(a.total_destruction)::numeric total_destruction
      from public.advanced_stats_scope_army_daily a
      join public.advanced_stats_army_dictionary d on d.army_hash = a.army_hash, normalized n
     where a.tracking_id = p_tracking_id and a.scope = n.scope
       and (p_from is null or a.stat_date >= (p_from at time zone 'UTC')::date)
     group by a.army_hash, d.normalized_army_json
     order by sum(a.battle_count) desc, sum(a.total_stars) desc, a.army_hash limit 1
), tracking as (select t.* from public.advanced_stats_tracking t where t.id = p_tracking_id),
state as (select s.* from public.advanced_stats_scope_state s, normalized n where s.tracking_id = p_tracking_id and s.scope = n.scope)
select jsonb_build_object('scope', (select scope from normalized), 'granularity', 'UTC_DAY',
    'tracking', jsonb_build_object('status', tracking.status, 'trackingStartedAt', tracking.tracking_started_at,
        'lastSuccessfulPollAt', tracking.last_successful_poll_at, 'dataCompleteSince', tracking.data_complete_since,
        'bootstrapStatus', tracking.bootstrap_status, 'bootstrapProgress', tracking.bootstrap_progress,
        'bootstrapProcessed', tracking.bootstrap_processed, 'bootstrapTotal', tracking.bootstrap_total,
        'bootstrapErrorCode', tracking.bootstrap_error_code, 'bootstrapErrorMessage', tracking.bootstrap_error_message,
        'bootstrapUpdatedAt', tracking.bootstrap_updated_at, 'source', jsonb_build_object(
            'provider', state.source_provider, 'sourceId', state.source_id, 'adapterVersion', state.source_adapter_version,
            'capabilityStatus', state.capability_status, 'coverageStatus', state.coverage_status,
            'coverageUpdatedAt', state.coverage_updated_at, 'cursor', state.source_cursor,
            'watermarkAt', state.source_watermark_at, 'watermarkKey', state.source_watermark_key,
            'provenance', state.source_provenance, 'lastSuccessfulPollAt', state.last_successful_poll_at,
            'lastErrorAt', state.last_error_at, 'lastErrorCode', state.last_error_code,
            'lastErrorMessage', state.last_error_message, 'updatedAt', state.updated_at)),
    'summary', jsonb_build_object('attacks', totals.attacks,
        'averageStars', case when totals.attacks = 0 then 0 else round(totals.total_stars::numeric / totals.attacks, 2) end,
        'averageDestruction', case when totals.attacks = 0 then 0 else round(totals.total_destruction / totals.attacks, 2) end,
        'threeStarRate', case when totals.attacks = 0 then 0 else round(100.0 * totals.three_stars / totals.attacks, 2) end,
        'lootKnownAttackCount', totals.known_loot_attacks,
        'lootAttackCount', totals.known_loot_attacks,
         'goldLooted', case when totals.known_loot_attacks = 0 then null else totals.reliable_gold_looted end,
         'elixirLooted', case when totals.known_loot_attacks = 0 then null else totals.reliable_elixir_looted end,
         'darkElixirLooted', case when totals.known_loot_attacks = 0 then null else totals.reliable_dark_elixir_looted end,
         'goldLootAverage', case when totals.known_loot_attacks = 0 then null else round(totals.reliable_gold_looted::numeric / totals.known_loot_attacks, 2) end,
         'elixirLootAverage', case when totals.known_loot_attacks = 0 then null else round(totals.reliable_elixir_looted::numeric / totals.known_loot_attacks, 2) end,
         'darkElixirLootAverage', case when totals.known_loot_attacks = 0 then null else round(totals.reliable_dark_elixir_looted::numeric / totals.known_loot_attacks, 2) end,
         'averageGoldLooted', case when totals.known_loot_attacks = 0 then null else round(totals.reliable_gold_looted::numeric / totals.known_loot_attacks, 2) end,
         'averageElixirLooted', case when totals.known_loot_attacks = 0 then null else round(totals.reliable_elixir_looted::numeric / totals.known_loot_attacks, 2) end,
         'averageDarkElixirLooted', case when totals.known_loot_attacks = 0 then null else round(totals.reliable_dark_elixir_looted::numeric / totals.known_loot_attacks, 2) end,
        'goldLootBest', case when totals.known_loot_attacks = 0 then null else totals.best_gold_looted end,
        'elixirLootBest', case when totals.known_loot_attacks = 0 then null else totals.best_elixir_looted end,
        'darkElixirLootBest', case when totals.known_loot_attacks = 0 then null else totals.best_dark_elixir_looted end,
        'bestGoldLooted', case when totals.known_loot_attacks = 0 then null else totals.best_gold_looted end,
        'bestElixirLooted', case when totals.known_loot_attacks = 0 then null else totals.best_elixir_looted end,
        'bestDarkElixirLooted', case when totals.known_loot_attacks = 0 then null else totals.best_dark_elixir_looted end,
        'loot', jsonb_build_object('knownAttackCount', totals.known_loot_attacks,
            'gold', jsonb_build_object('total', case when totals.known_loot_attacks = 0 then null else totals.reliable_gold_looted end,
                'average', case when totals.known_loot_attacks = 0 then null else round(totals.reliable_gold_looted::numeric / totals.known_loot_attacks, 2) end,
                'best', case when totals.known_loot_attacks = 0 then null else totals.best_gold_looted end),
            'elixir', jsonb_build_object('total', case when totals.known_loot_attacks = 0 then null else totals.reliable_elixir_looted end,
                'average', case when totals.known_loot_attacks = 0 then null else round(totals.reliable_elixir_looted::numeric / totals.known_loot_attacks, 2) end,
                'best', case when totals.known_loot_attacks = 0 then null else totals.best_elixir_looted end),
            'darkElixir', jsonb_build_object('total', case when totals.known_loot_attacks = 0 then null else totals.reliable_dark_elixir_looted end,
                'average', case when totals.known_loot_attacks = 0 then null else round(totals.reliable_dark_elixir_looted::numeric / totals.known_loot_attacks, 2) end,
                'best', case when totals.known_loot_attacks = 0 then null else totals.best_dark_elixir_looted end))),
    'favorites', jsonb_build_object(
        'troop', (select jsonb_build_object('key', unit_key, 'name', unit_name, 'category', category, 'totalQuantity', total_quantity, 'battlesPresent', battles_present) from unit_rank where favorite_group = 'FAVORITE_TROOP' and rn = 1),
        'spell', (select jsonb_build_object('key', unit_key, 'name', unit_name, 'category', category, 'totalQuantity', total_quantity, 'battlesPresent', battles_present) from unit_rank where favorite_group = 'FAVORITE_SPELL' and rn = 1),
        'siege', (select jsonb_build_object('key', unit_key, 'name', unit_name, 'category', category, 'totalQuantity', total_quantity, 'battlesPresent', battles_present) from unit_rank where favorite_group = 'FAVORITE_SIEGE' and rn = 1),
        'army', (select jsonb_build_object('armyHash', army_hash, 'army', normalized_army_json, 'battleCount', battle_count,
            'averageStars', case when battle_count = 0 then 0 else round(total_stars::numeric / battle_count, 2) end,
            'averageDestruction', case when battle_count = 0 then 0 else round(total_destruction / battle_count, 2) end) from army_rank)))
from tracking left join state on state.tracking_id = tracking.id cross join totals;
$$;

create or replace function public.read_advanced_stats_compact_armies_v1(
    p_tracking_id uuid, p_scope text, p_from timestamptz default null, p_limit integer default 20
) returns jsonb
language sql stable security invoker set search_path = public, pg_temp
as $$
with normalized as (select upper(btrim(p_scope)) scope), grouped as (
    select a.army_hash, d.normalized_army_json,
           sum(a.battle_count)::bigint battle_count, sum(a.total_stars)::bigint total_stars,
           sum(a.total_destruction)::numeric total_destruction, min(a.stat_date) first_seen_at, max(a.stat_date) last_seen_at
      from public.advanced_stats_scope_army_daily a
      join public.advanced_stats_army_dictionary d on d.army_hash = a.army_hash, normalized n
     where a.tracking_id = p_tracking_id and a.scope = n.scope
       and (p_from is null or a.stat_date >= (p_from at time zone 'UTC')::date)
     group by a.army_hash, d.normalized_army_json
     order by sum(a.battle_count) desc, sum(a.total_stars) desc, a.army_hash
     limit greatest(1, least(coalesce(p_limit, 20), 100))
)
select coalesce(jsonb_agg(jsonb_build_object('armyHash', army_hash, 'army', normalized_army_json,
    'battleCount', battle_count, 'averageStars', case when battle_count = 0 then 0 else round(total_stars::numeric / battle_count, 2) end,
    'averageDestruction', case when battle_count = 0 then 0 else round(total_destruction / battle_count, 2) end,
    'firstSeenAt', first_seen_at, 'lastSeenAt', last_seen_at) order by battle_count desc, total_stars desc, army_hash), '[]'::jsonb)
from grouped;
$$;

revoke all on function public.read_advanced_stats_compact_overview_v1(uuid,text,timestamptz) from public, anon, authenticated;
revoke all on function public.read_advanced_stats_compact_armies_v1(uuid,text,timestamptz,integer) from public, anon, authenticated;
grant execute on function public.read_advanced_stats_compact_overview_v1(uuid,text,timestamptz) to service_role;
grant execute on function public.read_advanced_stats_compact_armies_v1(uuid,text,timestamptz,integer) to service_role;

-- Season-aware reads use the same dictionary and loot projection.
create or replace function public.read_advanced_stats_compact_overview_v2(
    p_tracking_id uuid, p_scope text, p_from timestamptz default null, p_season_key text default null
) returns jsonb
language sql stable security invoker set search_path = public, pg_temp
as $$
with normalized as (select upper(btrim(p_scope)) scope), scope_state as (
    select s.* from public.advanced_stats_scope_state s, normalized n
     where s.tracking_id = p_tracking_id and s.scope = n.scope
), selected as (
    select n.scope, case when n.scope = 'RANKED' then public.normalize_advanced_stats_ranked_season_key_v1(
        n.scope, case when p_season_key is null then coalesce(s.source_season_key, '') else btrim(p_season_key) end)
        else public.normalize_advanced_stats_ranked_season_key_v1(n.scope, '') end season_key
      from normalized n left join scope_state s on true
), filtered_daily as (
    select d.* from public.advanced_stats_scope_daily d, selected x
     where d.tracking_id = p_tracking_id and d.scope = x.scope and d.season_key = x.season_key
       and (p_from is null or d.stat_date >= (p_from at time zone 'UTC')::date)
), totals as (
    select coalesce(sum(attacks), 0)::bigint attacks, coalesce(sum(total_stars), 0)::bigint total_stars,
           coalesce(sum(total_destruction), 0)::numeric total_destruction, coalesce(sum(three_star_attacks), 0)::bigint three_stars,
           coalesce(sum(reliable_gold_looted), 0)::bigint reliable_gold_looted, coalesce(sum(reliable_elixir_looted), 0)::bigint reliable_elixir_looted,
           coalesce(sum(reliable_dark_elixir_looted), 0)::bigint reliable_dark_elixir_looted, coalesce(sum(loot_known_attacks), 0)::bigint known_loot_attacks,
           max(best_gold_looted)::bigint best_gold_looted, max(best_elixir_looted)::bigint best_elixir_looted,
           max(best_dark_elixir_looted)::bigint best_dark_elixir_looted from filtered_daily
), unit_rank as (
    select u.unit_key, max(u.unit_name) unit_name, u.category,
           sum(u.total_quantity)::bigint total_quantity, sum(u.battles_present)::bigint battles_present,
           case when u.category in ('TROOP', 'SUPER_TROOP') then 'FAVORITE_TROOP'
                when u.category = 'SPELL' then 'FAVORITE_SPELL'
                when u.category = 'SIEGE' then 'FAVORITE_SIEGE' else u.category end favorite_group,
           row_number() over (partition by case when u.category in ('TROOP', 'SUPER_TROOP') then 'FAVORITE_TROOP'
                when u.category = 'SPELL' then 'FAVORITE_SPELL' when u.category = 'SIEGE' then 'FAVORITE_SIEGE'
                else u.category end order by sum(u.total_quantity) desc, sum(u.battles_present) desc, u.unit_key) rn
      from public.advanced_stats_scope_unit_daily u, selected x
     where u.tracking_id = p_tracking_id and u.scope = x.scope and u.season_key = x.season_key
       and (p_from is null or u.stat_date >= (p_from at time zone 'UTC')::date)
     group by u.unit_key, u.category
), army_rank as (
    select a.army_hash, d.normalized_army_json, sum(a.battle_count)::bigint battle_count,
           sum(a.total_stars)::bigint total_stars, sum(a.total_destruction)::numeric total_destruction
      from public.advanced_stats_scope_army_daily a join public.advanced_stats_army_dictionary d on d.army_hash = a.army_hash, selected x
     where a.tracking_id = p_tracking_id and a.scope = x.scope and a.season_key = x.season_key
       and (p_from is null or a.stat_date >= (p_from at time zone 'UTC')::date)
     group by a.army_hash, d.normalized_army_json order by sum(a.battle_count) desc, sum(a.total_stars) desc, a.army_hash limit 1
), tracking as (select t.* from public.advanced_stats_tracking t where t.id = p_tracking_id)
select jsonb_build_object('scope', (select scope from selected), 'seasonKey', (select season_key from selected), 'granularity', 'UTC_DAY',
    'tracking', jsonb_build_object('status', tracking.status, 'trackingStartedAt', tracking.tracking_started_at,
        'lastSuccessfulPollAt', tracking.last_successful_poll_at, 'dataCompleteSince', tracking.data_complete_since,
        'bootstrapStatus', tracking.bootstrap_status, 'bootstrapProgress', tracking.bootstrap_progress, 'bootstrapProcessed', tracking.bootstrap_processed,
        'bootstrapTotal', tracking.bootstrap_total, 'bootstrapErrorCode', tracking.bootstrap_error_code, 'bootstrapErrorMessage', tracking.bootstrap_error_message,
        'bootstrapUpdatedAt', tracking.bootstrap_updated_at, 'source', jsonb_build_object('provider', scope_state.source_provider,
            'sourceId', scope_state.source_id, 'adapterVersion', scope_state.source_adapter_version, 'capabilityStatus', scope_state.capability_status,
            'coverageStatus', scope_state.coverage_status, 'coverageUpdatedAt', scope_state.coverage_updated_at, 'cursor', scope_state.source_cursor,
            'watermarkAt', scope_state.source_watermark_at, 'watermarkKey', scope_state.source_watermark_key, 'seasonKey', (select season_key from selected),
            'provenance', scope_state.source_provenance, 'lastSuccessfulPollAt', scope_state.last_successful_poll_at,
            'lastErrorAt', scope_state.last_error_at, 'lastErrorCode', scope_state.last_error_code, 'lastErrorMessage', scope_state.last_error_message,
            'updatedAt', scope_state.updated_at)),
    'summary', jsonb_build_object('attacks', totals.attacks,
        'averageStars', case when totals.attacks = 0 then 0 else round(totals.total_stars::numeric / totals.attacks, 2) end,
        'averageDestruction', case when totals.attacks = 0 then 0 else round(totals.total_destruction / totals.attacks, 2) end,
        'threeStarRate', case when totals.attacks = 0 then 0 else round(100.0 * totals.three_stars / totals.attacks, 2) end,
        'lootKnownAttackCount', totals.known_loot_attacks,
        'lootAttackCount', totals.known_loot_attacks,
        'goldLooted', case when totals.known_loot_attacks = 0 then null else totals.reliable_gold_looted end,
        'elixirLooted', case when totals.known_loot_attacks = 0 then null else totals.reliable_elixir_looted end,
        'darkElixirLooted', case when totals.known_loot_attacks = 0 then null else totals.reliable_dark_elixir_looted end,
        'goldLootAverage', case when totals.known_loot_attacks = 0 then null else round(totals.reliable_gold_looted::numeric / totals.known_loot_attacks, 2) end,
        'elixirLootAverage', case when totals.known_loot_attacks = 0 then null else round(totals.reliable_elixir_looted::numeric / totals.known_loot_attacks, 2) end,
        'darkElixirLootAverage', case when totals.known_loot_attacks = 0 then null else round(totals.reliable_dark_elixir_looted::numeric / totals.known_loot_attacks, 2) end,
        'averageGoldLooted', case when totals.known_loot_attacks = 0 then null else round(totals.reliable_gold_looted::numeric / totals.known_loot_attacks, 2) end,
        'averageElixirLooted', case when totals.known_loot_attacks = 0 then null else round(totals.reliable_elixir_looted::numeric / totals.known_loot_attacks, 2) end,
        'averageDarkElixirLooted', case when totals.known_loot_attacks = 0 then null else round(totals.reliable_dark_elixir_looted::numeric / totals.known_loot_attacks, 2) end,
        'goldLootBest', case when totals.known_loot_attacks = 0 then null else totals.best_gold_looted end,
        'elixirLootBest', case when totals.known_loot_attacks = 0 then null else totals.best_elixir_looted end,
        'darkElixirLootBest', case when totals.known_loot_attacks = 0 then null else totals.best_dark_elixir_looted end,
        'bestGoldLooted', case when totals.known_loot_attacks = 0 then null else totals.best_gold_looted end,
        'bestElixirLooted', case when totals.known_loot_attacks = 0 then null else totals.best_elixir_looted end,
        'bestDarkElixirLooted', case when totals.known_loot_attacks = 0 then null else totals.best_dark_elixir_looted end,
        'loot', jsonb_build_object('knownAttackCount', totals.known_loot_attacks,
            'gold', jsonb_build_object('total', case when totals.known_loot_attacks = 0 then null else totals.reliable_gold_looted end,
                'average', case when totals.known_loot_attacks = 0 then null else round(totals.reliable_gold_looted::numeric / totals.known_loot_attacks, 2) end,
                'best', case when totals.known_loot_attacks = 0 then null else totals.best_gold_looted end),
            'elixir', jsonb_build_object('total', case when totals.known_loot_attacks = 0 then null else totals.reliable_elixir_looted end,
                'average', case when totals.known_loot_attacks = 0 then null else round(totals.reliable_elixir_looted::numeric / totals.known_loot_attacks, 2) end,
                'best', case when totals.known_loot_attacks = 0 then null else totals.best_elixir_looted end),
            'darkElixir', jsonb_build_object('total', case when totals.known_loot_attacks = 0 then null else totals.reliable_dark_elixir_looted end,
                'average', case when totals.known_loot_attacks = 0 then null else round(totals.reliable_dark_elixir_looted::numeric / totals.known_loot_attacks, 2) end,
                'best', case when totals.known_loot_attacks = 0 then null else totals.best_dark_elixir_looted end))),
    'favorites', jsonb_build_object(
        'troop', (select jsonb_build_object('key', unit_key, 'name', unit_name, 'category', category,
            'totalQuantity', total_quantity, 'battlesPresent', battles_present) from unit_rank
            where favorite_group = 'FAVORITE_TROOP' and rn = 1),
        'spell', (select jsonb_build_object('key', unit_key, 'name', unit_name, 'category', category,
            'totalQuantity', total_quantity, 'battlesPresent', battles_present) from unit_rank
            where favorite_group = 'FAVORITE_SPELL' and rn = 1),
        'siege', (select jsonb_build_object('key', unit_key, 'name', unit_name, 'category', category,
            'totalQuantity', total_quantity, 'battlesPresent', battles_present) from unit_rank
            where favorite_group = 'FAVORITE_SIEGE' and rn = 1),
        'army', (select jsonb_build_object('armyHash', army_hash, 'army', normalized_army_json,
        'battleCount', battle_count, 'averageStars', case when battle_count = 0 then 0 else round(total_stars::numeric / battle_count, 2) end,
        'averageDestruction', case when battle_count = 0 then 0 else round(total_destruction / battle_count, 2) end) from army_rank)))
from tracking left join scope_state on scope_state.tracking_id = tracking.id cross join totals;
$$;

create or replace function public.read_advanced_stats_compact_armies_v2(
    p_tracking_id uuid, p_scope text, p_from timestamptz default null, p_limit integer default 20, p_season_key text default null
) returns jsonb
language sql stable security invoker set search_path = public, pg_temp
as $$
with normalized as (select upper(btrim(p_scope)) scope), state as (
    select s.* from public.advanced_stats_scope_state s, normalized n where s.tracking_id = p_tracking_id and s.scope = n.scope
), selected as (
    select n.scope, case when n.scope = 'RANKED' then public.normalize_advanced_stats_ranked_season_key_v1(n.scope,
        case when p_season_key is null then coalesce(state.source_season_key, '') else btrim(p_season_key) end)
        else public.normalize_advanced_stats_ranked_season_key_v1(n.scope, '') end season_key from normalized n left join state on true
), grouped as (
    select a.army_hash, d.normalized_army_json, sum(a.battle_count)::bigint battle_count, sum(a.total_stars)::bigint total_stars,
           sum(a.total_destruction)::numeric total_destruction, min(a.stat_date) first_seen_at, max(a.stat_date) last_seen_at
      from public.advanced_stats_scope_army_daily a join public.advanced_stats_army_dictionary d on d.army_hash = a.army_hash, selected x
     where a.tracking_id = p_tracking_id and a.scope = x.scope and a.season_key = x.season_key
       and (p_from is null or a.stat_date >= (p_from at time zone 'UTC')::date)
     group by a.army_hash, d.normalized_army_json order by sum(a.battle_count) desc, sum(a.total_stars) desc, a.army_hash
     limit greatest(1, least(coalesce(p_limit, 20), 100))
)
select coalesce(jsonb_agg(jsonb_build_object('armyHash', army_hash, 'army', normalized_army_json, 'battleCount', battle_count,
    'averageStars', case when battle_count = 0 then 0 else round(total_stars::numeric / battle_count, 2) end,
    'averageDestruction', case when battle_count = 0 then 0 else round(total_destruction / battle_count, 2) end,
    'firstSeenAt', first_seen_at, 'lastSeenAt', last_seen_at) order by battle_count desc, total_stars desc, army_hash), '[]'::jsonb)
from grouped;
$$;

revoke all on function public.read_advanced_stats_compact_overview_v2(uuid,text,timestamptz,text) from public, anon, authenticated;
revoke all on function public.read_advanced_stats_compact_armies_v2(uuid,text,timestamptz,integer,text) from public, anon, authenticated;
grant execute on function public.read_advanced_stats_compact_overview_v2(uuid,text,timestamptz,text) to service_role;
grant execute on function public.read_advanced_stats_compact_armies_v2(uuid,text,timestamptz,integer,text) to service_role;

-- Daily trend reads expose independent per-resource totals, averages, and best
-- values.  Unknown loot stays JSON null instead of becoming a zero.
create or replace function public.read_advanced_stats_compact_trends_v1(
    p_tracking_id uuid, p_scope text, p_from timestamptz default null
) returns jsonb
language sql stable security invoker set search_path = public, pg_temp
as $$
select coalesce(jsonb_agg(jsonb_build_object('date', d.stat_date, 'attacks', d.attacks,
    'averageStars', case when d.attacks = 0 then 0 else round(d.total_stars::numeric / d.attacks, 2) end,
    'averageDestruction', case when d.attacks = 0 then 0 else round(d.total_destruction / d.attacks, 2) end,
    'threeStarRate', case when d.attacks = 0 then 0 else round(100.0 * d.three_star_attacks / d.attacks, 2) end,
    'lootKnownAttackCount', d.loot_known_attacks,
    'lootAttackCount', d.loot_known_attacks,
    'goldLooted', case when d.loot_known_attacks = 0 then null else d.reliable_gold_looted end,
    'elixirLooted', case when d.loot_known_attacks = 0 then null else d.reliable_elixir_looted end,
    'darkElixirLooted', case when d.loot_known_attacks = 0 then null else d.reliable_dark_elixir_looted end,
    'goldLootAverage', case when d.loot_known_attacks = 0 then null else round(d.reliable_gold_looted::numeric / d.loot_known_attacks, 2) end,
    'elixirLootAverage', case when d.loot_known_attacks = 0 then null else round(d.reliable_elixir_looted::numeric / d.loot_known_attacks, 2) end,
    'darkElixirLootAverage', case when d.loot_known_attacks = 0 then null else round(d.reliable_dark_elixir_looted::numeric / d.loot_known_attacks, 2) end,
    'averageGoldLooted', case when d.loot_known_attacks = 0 then null else round(d.reliable_gold_looted::numeric / d.loot_known_attacks, 2) end,
    'averageElixirLooted', case when d.loot_known_attacks = 0 then null else round(d.reliable_elixir_looted::numeric / d.loot_known_attacks, 2) end,
    'averageDarkElixirLooted', case when d.loot_known_attacks = 0 then null else round(d.reliable_dark_elixir_looted::numeric / d.loot_known_attacks, 2) end,
    'goldLootBest', case when d.loot_known_attacks = 0 then null else d.best_gold_looted end,
    'elixirLootBest', case when d.loot_known_attacks = 0 then null else d.best_elixir_looted end,
    'darkElixirLootBest', case when d.loot_known_attacks = 0 then null else d.best_dark_elixir_looted end,
    'bestGoldLooted', case when d.loot_known_attacks = 0 then null else d.best_gold_looted end,
    'bestElixirLooted', case when d.loot_known_attacks = 0 then null else d.best_elixir_looted end,
    'bestDarkElixirLooted', case when d.loot_known_attacks = 0 then null else d.best_dark_elixir_looted end)
    order by d.stat_date), '[]'::jsonb)
from public.advanced_stats_scope_daily d
where d.tracking_id = p_tracking_id and d.scope = upper(btrim(p_scope))
  and (p_from is null or d.stat_date >= (p_from at time zone 'UTC')::date);
$$;

create or replace function public.read_advanced_stats_compact_trends_v2(
    p_tracking_id uuid, p_scope text, p_from timestamptz default null, p_season_key text default null
) returns jsonb
language sql stable security invoker set search_path = public, pg_temp
as $$
with normalized as (select upper(btrim(p_scope)) scope), state as (
    select s.* from public.advanced_stats_scope_state s, normalized n where s.tracking_id = p_tracking_id and s.scope = n.scope
), selected as (
    select n.scope, case when n.scope = 'RANKED' then public.normalize_advanced_stats_ranked_season_key_v1(n.scope,
        case when p_season_key is null then coalesce(state.source_season_key, '') else btrim(p_season_key) end)
        else public.normalize_advanced_stats_ranked_season_key_v1(n.scope, '') end season_key from normalized n left join state on true
)
select coalesce(jsonb_agg(jsonb_build_object('date', d.stat_date, 'attacks', d.attacks,
    'averageStars', case when d.attacks = 0 then 0 else round(d.total_stars::numeric / d.attacks, 2) end,
    'averageDestruction', case when d.attacks = 0 then 0 else round(d.total_destruction / d.attacks, 2) end,
    'threeStarRate', case when d.attacks = 0 then 0 else round(100.0 * d.three_star_attacks / d.attacks, 2) end,
    'lootKnownAttackCount', d.loot_known_attacks,
    'lootAttackCount', d.loot_known_attacks,
    'goldLooted', case when d.loot_known_attacks = 0 then null else d.reliable_gold_looted end,
    'elixirLooted', case when d.loot_known_attacks = 0 then null else d.reliable_elixir_looted end,
    'darkElixirLooted', case when d.loot_known_attacks = 0 then null else d.reliable_dark_elixir_looted end,
    'goldLootAverage', case when d.loot_known_attacks = 0 then null else round(d.reliable_gold_looted::numeric / d.loot_known_attacks, 2) end,
    'elixirLootAverage', case when d.loot_known_attacks = 0 then null else round(d.reliable_elixir_looted::numeric / d.loot_known_attacks, 2) end,
    'darkElixirLootAverage', case when d.loot_known_attacks = 0 then null else round(d.reliable_dark_elixir_looted::numeric / d.loot_known_attacks, 2) end,
    'averageGoldLooted', case when d.loot_known_attacks = 0 then null else round(d.reliable_gold_looted::numeric / d.loot_known_attacks, 2) end,
    'averageElixirLooted', case when d.loot_known_attacks = 0 then null else round(d.reliable_elixir_looted::numeric / d.loot_known_attacks, 2) end,
    'averageDarkElixirLooted', case when d.loot_known_attacks = 0 then null else round(d.reliable_dark_elixir_looted::numeric / d.loot_known_attacks, 2) end,
    'goldLootBest', case when d.loot_known_attacks = 0 then null else d.best_gold_looted end,
    'elixirLootBest', case when d.loot_known_attacks = 0 then null else d.best_elixir_looted end,
    'darkElixirLootBest', case when d.loot_known_attacks = 0 then null else d.best_dark_elixir_looted end,
    'bestGoldLooted', case when d.loot_known_attacks = 0 then null else d.best_gold_looted end,
    'bestElixirLooted', case when d.loot_known_attacks = 0 then null else d.best_elixir_looted end,
    'bestDarkElixirLooted', case when d.loot_known_attacks = 0 then null else d.best_dark_elixir_looted end)
    order by d.stat_date), '[]'::jsonb)
from public.advanced_stats_scope_daily d, selected x
where d.tracking_id = p_tracking_id and d.scope = x.scope and d.season_key = x.season_key
  and (p_from is null or d.stat_date >= (p_from at time zone 'UTC')::date);
$$;

revoke all on function public.read_advanced_stats_compact_trends_v1(uuid,text,timestamptz) from public, anon, authenticated;
revoke all on function public.read_advanced_stats_compact_trends_v2(uuid,text,timestamptz,text) from public, anon, authenticated;
grant execute on function public.read_advanced_stats_compact_trends_v1(uuid,text,timestamptz) to service_role;
grant execute on function public.read_advanced_stats_compact_trends_v2(uuid,text,timestamptz,text) to service_role;

-- Every read and write above uses the dictionary.  Only now is the duplicated
-- payload removed from daily rows; the validated FK proves no row is orphaned.
alter table public.advanced_stats_scope_army_daily
    drop column if exists normalized_army_json;


commit;

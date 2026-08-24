-- Backfill compact read models from existing official battle-log data.
--
-- This is deliberately additive and idempotent.  Legacy raw rows remain intact
-- for the transition window; future writes use the compact RPC contract.

insert into public.advanced_stats_scope_state (tracking_id, scope, source_provider, source_provenance)
select t.id,
       scopes.scope,
       'LEGACY_BATTLELOG',
       jsonb_build_object(
            'kind', 'official_battlelog_backfill',
            'sourceId', 'OFFICIAL_BATTLELOG',
           'sourceTable', 'advanced_stats_battles',
           'migration', '20260814205008'
       )
  from public.advanced_stats_tracking t
 cross join (values ('NORMAL'::text), ('WAR'::text), ('RANKED'::text)) scopes(scope)
on conflict (tracking_id, scope) do nothing;

update public.advanced_stats_scope_state state
    set source_id = 'OFFICIAL_BATTLELOG',
       capability_status = case state.scope
           when 'RANKED' then 'UNSUPPORTED'
           when 'WAR' then 'PARTIAL'
           else 'PARTIAL'
       end,
       coverage_status = case state.scope
           when 'RANKED' then 'UNAVAILABLE'
           else 'PARTIAL'
       end,
       coverage_updated_at = now()
  where state.source_provenance->>'kind' = 'official_battlelog_backfill';

with source as (
    select b.tracking_id,
           case
               when lower(coalesce(b.battle_type, '')) ~ '(war|cwl)' then 'WAR'
               when lower(coalesce(b.battle_type, '')) ~ '(ranked|legend|trophy)' then 'RANKED'
               else 'NORMAL'
           end as scope,
           b.battle_fingerprint,
           coalesce(b.battle_timestamp, b.observed_at, b.created_at) as event_at,
           b.bootstrap_import
      from public.advanced_stats_battles b
     where b.is_attack = true
       and b.processing_status = 'PROCESSED'
       and b.battle_fingerprint ~ '^[0-9a-fA-F]{64}$'
)
insert into public.advanced_stats_event_receipts (
    tracking_id, scope, event_fingerprint, event_at,
    source_watermark_at, source_watermark_key, bootstrap_import
)
select tracking_id, scope, battle_fingerprint, event_at,
       event_at, battle_fingerprint, bootstrap_import
  from source
on conflict (tracking_id, scope, event_fingerprint) do nothing;

with source as (
    select b.id,
           b.tracking_id,
           case
               when lower(coalesce(b.battle_type, '')) ~ '(war|cwl)' then 'WAR'
               when lower(coalesce(b.battle_type, '')) ~ '(ranked|legend|trophy)' then 'RANKED'
               else 'NORMAL'
           end as scope,
           b.battle_fingerprint,
           coalesce(b.battle_timestamp, b.observed_at, b.created_at) as event_at,
           row_number() over (
               partition by b.tracking_id,
                   case
                       when lower(coalesce(b.battle_type, '')) ~ '(war|cwl)' then 'WAR'
                       when lower(coalesce(b.battle_type, '')) ~ '(ranked|legend|trophy)' then 'RANKED'
                       else 'NORMAL'
                   end
               order by coalesce(b.battle_timestamp, b.observed_at, b.created_at) desc, b.id desc
           ) as rn
      from public.advanced_stats_battles b
     where b.is_attack = true
       and b.processing_status = 'PROCESSED'
       and b.battle_fingerprint ~ '^[0-9a-fA-F]{64}$'
), latest as (
    select tracking_id, scope, battle_fingerprint, event_at
      from source
     where rn = 1
)
update public.advanced_stats_scope_state state
   set source_watermark_at = latest.event_at,
       source_watermark_key = latest.battle_fingerprint,
       source_provenance = jsonb_build_object(
           'kind', 'official_battlelog_backfill',
           'sourceId', 'OFFICIAL_BATTLELOG',
           'sourceTable', 'advanced_stats_battles'
       ),
       coverage_status = case latest.scope
           when 'RANKED' then 'UNAVAILABLE'
           else 'PARTIAL'
       end,
       coverage_updated_at = now(),
       updated_at = now()
  from latest
 where state.tracking_id = latest.tracking_id
   and state.scope = latest.scope
   and (
       state.source_watermark_at is null
       or latest.event_at > state.source_watermark_at
       or (
           latest.event_at = state.source_watermark_at
           and latest.battle_fingerprint >= coalesce(state.source_watermark_key, '')
       )
   );

with source as (
    select b.id,
           b.tracking_id,
           case
               when lower(coalesce(b.battle_type, '')) ~ '(war|cwl)' then 'WAR'
               when lower(coalesce(b.battle_type, '')) ~ '(ranked|legend|trophy)' then 'RANKED'
               else 'NORMAL'
           end as scope,
           (coalesce(b.battle_timestamp, b.observed_at, b.created_at) at time zone 'UTC')::date as stat_date
      from public.advanced_stats_battles b
     where b.is_attack = true and b.processing_status = 'PROCESSED'
), grouped as (
    select s.tracking_id, s.scope, s.stat_date,
           u.unit_key, max(u.unit_name) as unit_name, u.category,
           sum(u.quantity)::bigint as total_quantity,
           count(distinct s.id)::bigint as battles_present
      from source s
      join public.advanced_stats_battle_units u on u.battle_id = s.id
     group by s.tracking_id, s.scope, s.stat_date, u.unit_key, u.category
)
insert into public.advanced_stats_scope_unit_daily (
    tracking_id, scope, stat_date, unit_key, unit_name, category,
    total_quantity, battles_present
)
select tracking_id, scope, stat_date, unit_key, unit_name, category,
       total_quantity, battles_present
  from grouped
on conflict (tracking_id, scope, stat_date, category, unit_key) do update
    set unit_name = excluded.unit_name,
        total_quantity = excluded.total_quantity,
        battles_present = excluded.battles_present,
        updated_at = now();

with source as (
    select b.tracking_id,
           case
               when lower(coalesce(b.battle_type, '')) ~ '(war|cwl)' then 'WAR'
               when lower(coalesce(b.battle_type, '')) ~ '(ranked|legend|trophy)' then 'RANKED'
               else 'NORMAL'
           end as scope,
           (coalesce(b.battle_timestamp, b.observed_at, b.created_at) at time zone 'UTC')::date as stat_date,
           b.army_hash, b.normalized_army_json, b.stars, b.destruction_percentage
      from public.advanced_stats_battles b
     where b.is_attack = true
       and b.processing_status = 'PROCESSED'
       and b.army_hash ~ '^[0-9a-fA-F]{64}$'
       and b.normalized_army_json is not null
), grouped as (
    select tracking_id, scope, stat_date, army_hash,
           (array_agg(normalized_army_json order by normalized_army_json))[1] as normalized_army_json,
           count(*)::bigint as battle_count,
           coalesce(sum(stars), 0)::bigint as total_stars,
           coalesce(sum(destruction_percentage), 0)::numeric as total_destruction
      from source
     group by tracking_id, scope, stat_date, army_hash
)
insert into public.advanced_stats_scope_army_daily (
    tracking_id, scope, stat_date, army_hash, normalized_army_json,
    battle_count, total_stars, total_destruction
)
select tracking_id, scope, stat_date, army_hash, normalized_army_json,
       battle_count, total_stars, total_destruction
  from grouped
on conflict (tracking_id, scope, stat_date, army_hash) do update
    set normalized_army_json = excluded.normalized_army_json,
        battle_count = excluded.battle_count,
        total_stars = excluded.total_stars,
        total_destruction = excluded.total_destruction,
        updated_at = now();

with source as (
    select b.tracking_id,
           case
               when lower(coalesce(b.battle_type, '')) ~ '(war|cwl)' then 'WAR'
               when lower(coalesce(b.battle_type, '')) ~ '(ranked|legend|trophy)' then 'RANKED'
               else 'NORMAL'
           end as scope,
           (coalesce(b.battle_timestamp, b.observed_at, b.created_at) at time zone 'UTC')::date as stat_date,
           b.stars, b.destruction_percentage, b.loot_gold, b.loot_elixir, b.loot_dark_elixir
      from public.advanced_stats_battles b
     where b.is_attack = true and b.processing_status = 'PROCESSED'
), grouped as (
    select tracking_id, scope, stat_date,
           count(*)::bigint as attacks,
           coalesce(sum(stars), 0)::bigint as total_stars,
           coalesce(sum(destruction_percentage), 0)::numeric as total_destruction,
           count(*) filter (where stars = 3)::bigint as three_star_attacks,
           count(*) filter (where stars = 2)::bigint as two_star_attacks,
           count(*) filter (where stars = 1)::bigint as one_star_attacks,
           count(*) filter (where stars = 0)::bigint as zero_star_attacks,
           coalesce(sum(loot_gold), 0)::bigint as gold_looted,
           coalesce(sum(loot_elixir), 0)::bigint as elixir_looted,
           coalesce(sum(loot_dark_elixir), 0)::bigint as dark_elixir_looted
      from source
     group by tracking_id, scope, stat_date
)
insert into public.advanced_stats_scope_daily (
    tracking_id, scope, stat_date, attacks, total_stars, total_destruction,
    three_star_attacks, two_star_attacks, one_star_attacks, zero_star_attacks,
    gold_looted, elixir_looted, dark_elixir_looted
)
select tracking_id, scope, stat_date, attacks, total_stars, total_destruction,
       three_star_attacks, two_star_attacks, one_star_attacks, zero_star_attacks,
       gold_looted, elixir_looted, dark_elixir_looted
  from grouped
on conflict (tracking_id, scope, stat_date) do update
    set attacks = excluded.attacks,
        total_stars = excluded.total_stars,
        total_destruction = excluded.total_destruction,
        three_star_attacks = excluded.three_star_attacks,
        two_star_attacks = excluded.two_star_attacks,
        one_star_attacks = excluded.one_star_attacks,
        zero_star_attacks = excluded.zero_star_attacks,
        gold_looted = excluded.gold_looted,
        elixir_looted = excluded.elixir_looted,
        dark_elixir_looted = excluded.dark_elixir_looted,
        updated_at = now();

-- Advanced Stats compact storage and loot rollups.
--
-- The compact scope tables are now the source of truth.  Loot is counted only
-- for events that explicitly carry lootAvailable=true.  Resource values stay
-- separate: gold, elixir, and dark elixir are never collapsed into one score.
-- Existing compact rows pre-date the availability flag; their existing loot
-- totals are retained, but remain unknown until an explicit reliable event is
-- observed.  This avoids presenting historical zero-normalized loot as fact.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '90s';

create table if not exists public.advanced_stats_army_dictionary (
    army_hash text primary key
        check (army_hash ~ '^[0-9a-fA-F]{64}$'),
    normalized_army_json jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists advanced_stats_scope_army_daily_army_hash_idx
    on public.advanced_stats_scope_army_daily (army_hash);

alter table public.advanced_stats_army_dictionary enable row level security;
revoke all on table public.advanced_stats_army_dictionary from public, anon, authenticated;
grant select, insert, update, delete on table public.advanced_stats_army_dictionary to service_role;

-- Pick one deterministic representation when historical rows disagree for a
-- hash.  A correctly produced hash is content-addressed, so a disagreement is
-- malformed source data rather than a reason to duplicate the dictionary row.
insert into public.advanced_stats_army_dictionary (army_hash, normalized_army_json)
select army_hash,
       (array_agg(normalized_army_json order by normalized_army_json))[1]
  from public.advanced_stats_scope_army_daily
 group by army_hash
on conflict (army_hash) do nothing;

do $$
begin
    if not exists (
        select 1
          from pg_constraint c
         where c.conrelid = 'public.advanced_stats_scope_army_daily'::regclass
           and c.conname = 'advanced_stats_scope_army_daily_army_dictionary_fkey'
    ) then
        alter table public.advanced_stats_scope_army_daily
            add constraint advanced_stats_scope_army_daily_army_dictionary_fkey
            foreign key (army_hash)
            references public.advanced_stats_army_dictionary (army_hash);
    end if;
end;
$$;

alter table public.advanced_stats_scope_army_daily
    validate constraint advanced_stats_scope_army_daily_army_dictionary_fkey;

-- Keep just enough per-receipt loot state to make a later enriched duplicate
-- idempotent.  ClashKing can expose the same battle first without loot and
-- later with reliable loot; the stable fingerprint must not lose that update.
alter table public.advanced_stats_event_receipts
    add column if not exists loot_available boolean not null default false,
    add column if not exists loot_gold bigint,
    add column if not exists loot_elixir bigint,
    add column if not exists loot_dark_elixir bigint,
    -- Historical receipts correspond to totals already folded into daily rows.
    -- New receipts use this bit to make late loot enrichment idempotent.
    add column if not exists loot_totals_applied boolean not null default false,
    add column if not exists loot_enrichment_eligible boolean not null default false;

-- Existing receipts pre-date the availability flag.  They are deliberately
-- not eligible for enrichment: their legacy daily resource totals may contain
-- WAR or missing-loot rows normalized to zero, and cannot be reconstructed
-- safely.  The default changes only after this historical snapshot.
update public.advanced_stats_event_receipts
   set loot_enrichment_eligible = false;
alter table public.advanced_stats_event_receipts
    alter column loot_enrichment_eligible set default true;
alter table public.advanced_stats_event_receipts
    drop constraint if exists advanced_stats_event_receipts_loot_values_check;
alter table public.advanced_stats_event_receipts
    add constraint advanced_stats_event_receipts_loot_values_check
    check (
        (loot_available and loot_totals_applied
            and loot_gold is not null and loot_gold >= 0
            and loot_elixir is not null and loot_elixir >= 0
            and loot_dark_elixir is not null and loot_dark_elixir >= 0)
        or (not loot_available and loot_gold is null and loot_elixir is null and loot_dark_elixir is null)
    );
alter table public.advanced_stats_event_receipts
    drop constraint if exists advanced_stats_event_receipts_loot_enrichment_state_check;
alter table public.advanced_stats_event_receipts
    add constraint advanced_stats_event_receipts_loot_enrichment_state_check
    check (not loot_enrichment_eligible
        or (not loot_available and not loot_totals_applied));

alter table public.advanced_stats_scope_daily
    add column if not exists loot_known_attacks bigint not null default 0,
    add column if not exists reliable_gold_looted bigint not null default 0,
    add column if not exists reliable_elixir_looted bigint not null default 0,
    add column if not exists reliable_dark_elixir_looted bigint not null default 0,
    add column if not exists best_gold_looted bigint,
    add column if not exists best_elixir_looted bigint,
    add column if not exists best_dark_elixir_looted bigint;

alter table public.advanced_stats_scope_daily
    drop constraint if exists advanced_stats_scope_daily_loot_rollup_check;
alter table public.advanced_stats_scope_daily
    add constraint advanced_stats_scope_daily_loot_rollup_check
    check (
        loot_known_attacks between 0 and attacks
        and reliable_gold_looted >= 0
        and reliable_elixir_looted >= 0
        and reliable_dark_elixir_looted >= 0
        and (best_gold_looted is null or best_gold_looted >= 0)
        and (best_elixir_looted is null or best_elixir_looted >= 0)
        and (best_dark_elixir_looted is null or best_dark_elixir_looted >= 0)
    );


commit;

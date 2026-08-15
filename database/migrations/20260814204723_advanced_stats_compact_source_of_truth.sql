-- Advanced Stats compact source-of-truth foundation.
--
-- ClashKing is the source of truth for future collection.  This migration is
-- additive: it keeps the legacy raw battle tables readable while introducing
-- compact, scope-aware state and daily read models.  No user data is deleted.

alter table public.advanced_stats_tracking
    add column if not exists bootstrap_status text not null default 'PENDING',
    add column if not exists bootstrap_progress smallint not null default 0,
    add column if not exists bootstrap_processed bigint not null default 0,
    add column if not exists bootstrap_total bigint,
    add column if not exists bootstrap_error_code text,
    add column if not exists bootstrap_error_message text,
    add column if not exists bootstrap_started_at timestamptz,
    add column if not exists bootstrap_updated_at timestamptz not null default now();

alter table public.advanced_stats_tracking
    drop constraint if exists advanced_stats_tracking_bootstrap_status_check;
alter table public.advanced_stats_tracking
    add constraint advanced_stats_tracking_bootstrap_status_check
    check (bootstrap_status in ('NOT_STARTED', 'PENDING', 'RUNNING', 'COMPLETE', 'PARTIAL', 'FAILED', 'UNSUPPORTED'));

alter table public.advanced_stats_tracking
    drop constraint if exists advanced_stats_tracking_bootstrap_progress_check;
alter table public.advanced_stats_tracking
    add constraint advanced_stats_tracking_bootstrap_progress_check
    check (bootstrap_progress between 0 and 100);

alter table public.advanced_stats_tracking
    drop constraint if exists advanced_stats_tracking_bootstrap_counts_check;
alter table public.advanced_stats_tracking
    add constraint advanced_stats_tracking_bootstrap_counts_check
    check (
        bootstrap_processed >= 0
        and (bootstrap_total is null or bootstrap_total >= 0)
        and (bootstrap_total is null or bootstrap_processed <= bootstrap_total)
    );

create table if not exists public.advanced_stats_scope_state (
    tracking_id uuid not null references public.advanced_stats_tracking(id) on delete cascade,
    scope text not null
        check (scope in ('NORMAL', 'WAR', 'RANKED')),
    source_provider text not null default 'CLASHKING'
        check (char_length(source_provider) between 1 and 64),
    source_id text not null default 'CLASHKING'
        check (char_length(source_id) between 1 and 128),
    source_adapter_version text,
    capability_status text not null default 'PARTIAL'
        check (capability_status in ('SUPPORTED', 'PARTIAL', 'UNSUPPORTED')),
    coverage_status text not null default 'PARTIAL'
        check (coverage_status in ('COMPLETE', 'PARTIAL', 'UNAVAILABLE')),
    coverage_updated_at timestamptz,
    source_cursor text,
    source_watermark_at timestamptz,
    source_watermark_key text,
    source_provenance jsonb not null default '{}'::jsonb
        check (jsonb_typeof(source_provenance) = 'object'),
    last_attempted_poll_at timestamptz,
    last_successful_poll_at timestamptz,
    last_error_at timestamptz,
    last_error_code text,
    last_error_message text,
    bootstrap_status text not null default 'PENDING'
        check (bootstrap_status in ('NOT_STARTED', 'PENDING', 'RUNNING', 'COMPLETE', 'PARTIAL', 'FAILED', 'UNSUPPORTED')),
    bootstrap_progress smallint not null default 0
        check (bootstrap_progress between 0 and 100),
    bootstrap_processed bigint not null default 0 check (bootstrap_processed >= 0),
    bootstrap_total bigint check (bootstrap_total is null or bootstrap_total >= 0),
    bootstrap_error_code text,
    bootstrap_error_message text,
    bootstrap_started_at timestamptz,
    bootstrap_completed_at timestamptz,
    updated_at timestamptz not null default now(),
    primary key (tracking_id, scope),
    constraint advanced_stats_scope_state_bootstrap_counts_check
        check (bootstrap_total is null or bootstrap_processed <= bootstrap_total)
);

create table if not exists public.advanced_stats_event_receipts (
    tracking_id uuid not null references public.advanced_stats_tracking(id) on delete cascade,
    scope text not null
        check (scope in ('NORMAL', 'WAR', 'RANKED')),
    event_fingerprint text not null check (event_fingerprint ~ '^[0-9a-fA-F]{64}$'),
    event_at timestamptz not null,
    source_cursor text,
    source_watermark_at timestamptz,
    source_watermark_key text,
    bootstrap_import boolean not null default false,
    created_at timestamptz not null default now(),
    primary key (tracking_id, scope, event_fingerprint)
);

create table if not exists public.advanced_stats_scope_unit_daily (
    tracking_id uuid not null references public.advanced_stats_tracking(id) on delete cascade,
    scope text not null
        check (scope in ('NORMAL', 'WAR', 'RANKED')),
    stat_date date not null,
    unit_key text not null check (char_length(unit_key) between 1 and 96),
    unit_name text not null check (char_length(unit_name) between 1 and 128),
    category text not null
        check (category in (
            'TROOP', 'SPELL', 'SIEGE', 'SUPER_TROOP',
            'CLAN_CASTLE_TROOP', 'CLAN_CASTLE_SPELL',
            'HERO', 'PET', 'EQUIPMENT'
        )),
    total_quantity bigint not null default 0 check (total_quantity >= 0),
    battles_present bigint not null default 0 check (battles_present >= 0),
    updated_at timestamptz not null default now(),
    primary key (tracking_id, scope, stat_date, category, unit_key)
);

create table if not exists public.advanced_stats_scope_army_daily (
    tracking_id uuid not null references public.advanced_stats_tracking(id) on delete cascade,
    scope text not null
        check (scope in ('NORMAL', 'WAR', 'RANKED')),
    stat_date date not null,
    army_hash text not null check (army_hash ~ '^[0-9a-fA-F]{64}$'),
    normalized_army_json jsonb not null,
    battle_count bigint not null default 0 check (battle_count >= 0),
    total_stars bigint not null default 0 check (total_stars >= 0),
    total_destruction numeric(18,2) not null default 0 check (total_destruction >= 0),
    updated_at timestamptz not null default now(),
    primary key (tracking_id, scope, stat_date, army_hash)
);

create table if not exists public.advanced_stats_scope_daily (
    tracking_id uuid not null references public.advanced_stats_tracking(id) on delete cascade,
    scope text not null
        check (scope in ('NORMAL', 'WAR', 'RANKED')),
    stat_date date not null,
    attacks bigint not null default 0 check (attacks >= 0),
    total_stars bigint not null default 0 check (total_stars >= 0),
    total_destruction numeric(18,2) not null default 0 check (total_destruction >= 0),
    three_star_attacks bigint not null default 0 check (three_star_attacks >= 0),
    two_star_attacks bigint not null default 0 check (two_star_attacks >= 0),
    one_star_attacks bigint not null default 0 check (one_star_attacks >= 0),
    zero_star_attacks bigint not null default 0 check (zero_star_attacks >= 0),
    gold_looted bigint not null default 0 check (gold_looted >= 0),
    elixir_looted bigint not null default 0 check (elixir_looted >= 0),
    dark_elixir_looted bigint not null default 0 check (dark_elixir_looted >= 0),
    updated_at timestamptz not null default now(),
    primary key (tracking_id, scope, stat_date),
    constraint advanced_stats_scope_daily_star_bucket_check
        check (three_star_attacks + two_star_attacks + one_star_attacks + zero_star_attacks <= attacks)
);

create index if not exists advanced_stats_scope_state_due_idx
    on public.advanced_stats_scope_state (tracking_id, scope, updated_at desc);
create index if not exists advanced_stats_event_receipts_time_idx
    on public.advanced_stats_event_receipts (tracking_id, scope, event_at desc);
create index if not exists advanced_stats_scope_unit_daily_rank_idx
    on public.advanced_stats_scope_unit_daily (tracking_id, scope, stat_date, category, total_quantity desc);
create index if not exists advanced_stats_scope_army_daily_rank_idx
    on public.advanced_stats_scope_army_daily (tracking_id, scope, stat_date, battle_count desc);
create index if not exists advanced_stats_scope_daily_period_idx
    on public.advanced_stats_scope_daily (tracking_id, scope, stat_date desc);

alter table public.advanced_stats_scope_state enable row level security;
alter table public.advanced_stats_event_receipts enable row level security;
alter table public.advanced_stats_scope_unit_daily enable row level security;
alter table public.advanced_stats_scope_army_daily enable row level security;
alter table public.advanced_stats_scope_daily enable row level security;

revoke all on table public.advanced_stats_scope_state from public, anon, authenticated;
revoke all on table public.advanced_stats_event_receipts from public, anon, authenticated;
revoke all on table public.advanced_stats_scope_unit_daily from public, anon, authenticated;
revoke all on table public.advanced_stats_scope_army_daily from public, anon, authenticated;
revoke all on table public.advanced_stats_scope_daily from public, anon, authenticated;

grant select, insert, update, delete on table public.advanced_stats_scope_state to service_role;
grant select, insert, update, delete on table public.advanced_stats_event_receipts to service_role;
grant select, insert, update, delete on table public.advanced_stats_scope_unit_daily to service_role;
grant select, insert, update, delete on table public.advanced_stats_scope_army_daily to service_role;
grant select, insert, update, delete on table public.advanced_stats_scope_daily to service_role;

create or replace function public.initialize_advanced_stats_scope_state_v1()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
    insert into public.advanced_stats_scope_state (tracking_id, scope)
    values
        (new.id, 'NORMAL'),
        (new.id, 'WAR'),
        (new.id, 'RANKED')
    on conflict (tracking_id, scope) do nothing;
    return new;
end;
$$;

drop trigger if exists advanced_stats_scope_state_initialize on public.advanced_stats_tracking;
create trigger advanced_stats_scope_state_initialize
after insert on public.advanced_stats_tracking
for each row execute function public.initialize_advanced_stats_scope_state_v1();

revoke all on function public.initialize_advanced_stats_scope_state_v1() from public, anon, authenticated;
grant execute on function public.initialize_advanced_stats_scope_state_v1() to service_role;

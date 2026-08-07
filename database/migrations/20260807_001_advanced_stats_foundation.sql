-- Advanced Stats durable tracking foundation.
-- The feature is opt-in and stores gameplay history only for explicitly tracked players.
-- All tables are backend-managed through the service role; no direct anon/authenticated access.

create table if not exists public.advanced_stats_tracking (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    player_tag text not null check (player_tag ~ '^#[0289PYLQGRJCUV]{3,15}$'),
    player_name text,
    town_hall_level integer check (town_hall_level is null or town_hall_level > 0),
    status text not null default 'INITIALIZING'
        check (status in ('INITIALIZING', 'ACTIVE', 'PAUSED', 'DEGRADED', 'STOPPED', 'ERROR')),
    tracking_started_at timestamptz not null default now(),
    bootstrap_completed_at timestamptz,
    bootstrap_oldest_battle_at timestamptz,
    last_poll_at timestamptz,
    last_successful_poll_at timestamptz,
    next_poll_at timestamptz,
    consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
    gap_started_at timestamptz,
    data_complete_since timestamptz,
    battles_processed bigint not null default 0 check (battles_processed >= 0),
    locked_until timestamptz,
    locked_by text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint advanced_stats_tracking_user_player_unique unique (user_id, player_tag)
);

create index if not exists advanced_stats_tracking_due_idx
    on public.advanced_stats_tracking (status, next_poll_at)
    where status in ('INITIALIZING', 'ACTIVE', 'DEGRADED');
create index if not exists advanced_stats_tracking_player_idx
    on public.advanced_stats_tracking (player_tag);
create index if not exists advanced_stats_tracking_user_idx
    on public.advanced_stats_tracking (user_id, updated_at desc);

create table if not exists public.advanced_stats_battles (
    id uuid primary key default gen_random_uuid(),
    tracking_id uuid not null references public.advanced_stats_tracking(id) on delete cascade,
    player_tag text not null check (player_tag ~ '^#[0289PYLQGRJCUV]{3,15}$'),
    battle_fingerprint text not null check (length(battle_fingerprint) = 64),
    battle_timestamp timestamptz,
    battle_type text,
    is_attack boolean not null default true,
    opponent_player_tag text,
    opponent_name text,
    opponent_town_hall integer check (opponent_town_hall is null or opponent_town_hall > 0),
    player_town_hall integer check (player_town_hall is null or player_town_hall > 0),
    stars smallint check (stars is null or stars between 0 and 3),
    destruction_percentage numeric(5,2)
        check (destruction_percentage is null or destruction_percentage between 0 and 100),
    army_share_code text,
    army_data_available boolean not null default false,
    loot_gold bigint check (loot_gold is null or loot_gold >= 0),
    loot_elixir bigint check (loot_elixir is null or loot_elixir >= 0),
    loot_dark_elixir bigint check (loot_dark_elixir is null or loot_dark_elixir >= 0),
    bootstrap_import boolean not null default false,
    processing_status text not null default 'PENDING'
        check (processing_status in ('PENDING', 'PROCESSED', 'PARSER_ERROR', 'IGNORED')),
    parser_version integer not null default 1 check (parser_version > 0),
    processed_at timestamptz,
    observed_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    constraint advanced_stats_battles_tracking_fingerprint_unique
        unique (tracking_id, battle_fingerprint)
);

create index if not exists advanced_stats_battles_tracking_time_idx
    on public.advanced_stats_battles (tracking_id, battle_timestamp desc);
create index if not exists advanced_stats_battles_player_time_idx
    on public.advanced_stats_battles (player_tag, battle_timestamp desc);
create index if not exists advanced_stats_battles_tracking_type_idx
    on public.advanced_stats_battles (tracking_id, battle_type);
create index if not exists advanced_stats_battles_processing_idx
    on public.advanced_stats_battles (processing_status, observed_at)
    where processing_status <> 'PROCESSED';

create table if not exists public.advanced_stats_battle_units (
    battle_id uuid not null references public.advanced_stats_battles(id) on delete cascade,
    unit_key text not null check (char_length(unit_key) between 1 and 96),
    unit_name text not null check (char_length(unit_name) between 1 and 128),
    category text not null
        check (category in (
            'TROOP', 'SPELL', 'SIEGE', 'SUPER_TROOP',
            'CLAN_CASTLE_TROOP', 'CLAN_CASTLE_SPELL',
            'HERO', 'PET', 'EQUIPMENT'
        )),
    quantity integer not null check (quantity > 0),
    unit_level integer check (unit_level is null or unit_level >= 0),
    created_at timestamptz not null default now(),
    primary key (battle_id, category, unit_key)
);

create index if not exists advanced_stats_battle_units_lookup_idx
    on public.advanced_stats_battle_units (category, unit_key, battle_id);

create table if not exists public.advanced_stats_unit_totals (
    tracking_id uuid not null references public.advanced_stats_tracking(id) on delete cascade,
    unit_key text not null check (char_length(unit_key) between 1 and 96),
    unit_name text not null check (char_length(unit_name) between 1 and 128),
    category text not null
        check (category in (
            'TROOP', 'SPELL', 'SIEGE', 'SUPER_TROOP',
            'CLAN_CASTLE_TROOP', 'CLAN_CASTLE_SPELL',
            'HERO', 'PET', 'EQUIPMENT'
        )),
    village text,
    total_quantity bigint not null default 0 check (total_quantity >= 0),
    battles_present bigint not null default 0 check (battles_present >= 0),
    first_seen_at timestamptz,
    last_seen_at timestamptz,
    updated_at timestamptz not null default now(),
    primary key (tracking_id, category, unit_key)
);

create index if not exists advanced_stats_unit_totals_rank_idx
    on public.advanced_stats_unit_totals (tracking_id, category, total_quantity desc);

create table if not exists public.advanced_stats_army_totals (
    tracking_id uuid not null references public.advanced_stats_tracking(id) on delete cascade,
    army_hash text not null check (length(army_hash) = 64),
    normalized_army_json jsonb not null,
    battle_count bigint not null default 0 check (battle_count >= 0),
    total_stars bigint not null default 0 check (total_stars >= 0),
    total_destruction numeric(18,2) not null default 0 check (total_destruction >= 0),
    first_seen_at timestamptz,
    last_seen_at timestamptz,
    updated_at timestamptz not null default now(),
    primary key (tracking_id, army_hash)
);

create index if not exists advanced_stats_army_totals_rank_idx
    on public.advanced_stats_army_totals (tracking_id, battle_count desc);

create table if not exists public.advanced_stats_daily (
    tracking_id uuid not null references public.advanced_stats_tracking(id) on delete cascade,
    stat_date date not null,
    attacks integer not null default 0 check (attacks >= 0),
    total_stars integer not null default 0 check (total_stars >= 0),
    total_destruction numeric(18,2) not null default 0 check (total_destruction >= 0),
    three_star_attacks integer not null default 0 check (three_star_attacks >= 0),
    two_star_attacks integer not null default 0 check (two_star_attacks >= 0),
    one_star_attacks integer not null default 0 check (one_star_attacks >= 0),
    zero_star_attacks integer not null default 0 check (zero_star_attacks >= 0),
    gold_looted bigint not null default 0 check (gold_looted >= 0),
    elixir_looted bigint not null default 0 check (elixir_looted >= 0),
    dark_elixir_looted bigint not null default 0 check (dark_elixir_looted >= 0),
    updated_at timestamptz not null default now(),
    primary key (tracking_id, stat_date),
    constraint advanced_stats_daily_star_bucket_check
        check (three_star_attacks + two_star_attacks + one_star_attacks + zero_star_attacks <= attacks)
);

create table if not exists public.advanced_stats_tracking_gaps (
    id uuid primary key default gen_random_uuid(),
    tracking_id uuid not null references public.advanced_stats_tracking(id) on delete cascade,
    started_at timestamptz not null,
    ended_at timestamptz,
    reason text not null
        check (reason in ('API_OUTAGE', 'RATE_LIMIT', 'WORKER_OUTAGE', 'USER_PAUSED', 'PARSER_ERROR', 'UNKNOWN')),
    created_at timestamptz not null default now(),
    constraint advanced_stats_tracking_gaps_range_check
        check (ended_at is null or ended_at >= started_at)
);

create index if not exists advanced_stats_tracking_gaps_tracking_idx
    on public.advanced_stats_tracking_gaps (tracking_id, started_at desc);

alter table public.advanced_stats_tracking enable row level security;
alter table public.advanced_stats_battles enable row level security;
alter table public.advanced_stats_battle_units enable row level security;
alter table public.advanced_stats_unit_totals enable row level security;
alter table public.advanced_stats_army_totals enable row level security;
alter table public.advanced_stats_daily enable row level security;
alter table public.advanced_stats_tracking_gaps enable row level security;

revoke all on table public.advanced_stats_tracking from anon, authenticated;
revoke all on table public.advanced_stats_battles from anon, authenticated;
revoke all on table public.advanced_stats_battle_units from anon, authenticated;
revoke all on table public.advanced_stats_unit_totals from anon, authenticated;
revoke all on table public.advanced_stats_army_totals from anon, authenticated;
revoke all on table public.advanced_stats_daily from anon, authenticated;
revoke all on table public.advanced_stats_tracking_gaps from anon, authenticated;

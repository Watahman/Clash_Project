-- Incremental achievement source cache.
-- Heavy sources (CWL/war history) are reduced to small per-record metric blobs so
-- subsequent refreshes only process records that were not seen before.

create table if not exists public.achievement_source_state (
    user_id uuid not null references public.users(id) on delete cascade,
    player_tag text not null check (player_tag ~ '^#[0289PYLQGRJCUV]{3,15}$'),
    source text not null,
    source_key text not null default '',
    cursor jsonb not null default '{}'::jsonb,
    coverage jsonb not null default '{}'::jsonb,
    last_checked_at timestamptz,
    last_success_at timestamptz,
    last_error_code text,
    updated_at timestamptz not null default now(),
    primary key (user_id, player_tag, source, source_key)
);

create table if not exists public.achievement_source_records (
    user_id uuid not null references public.users(id) on delete cascade,
    player_tag text not null check (player_tag ~ '^#[0289PYLQGRJCUV]{3,15}$'),
    source text not null,
    source_key text not null default '',
    record_key text not null,
    record_timestamp timestamptz,
    metrics jsonb not null default '{}'::jsonb,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, player_tag, source, source_key, record_key)
);

create index if not exists achievement_source_records_player_source_idx
    on public.achievement_source_records (user_id, player_tag, source, source_key, record_timestamp desc);

alter table public.achievement_source_state enable row level security;
alter table public.achievement_source_records enable row level security;

revoke all on table public.achievement_source_state from public, anon, authenticated;
revoke all on table public.achievement_source_records from public, anon, authenticated;
grant select, insert, update, delete on table public.achievement_source_state to service_role;
grant select, insert, update, delete on table public.achievement_source_records to service_role;

create or replace function public.read_achievement_source_metrics_v1(
    p_user_id uuid,
    p_player_tag text
) returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
with metric_rows as (
    select e.key as metric, sum((e.value #>> '{}')::numeric)::bigint as value
    from public.achievement_source_records r
    cross join lateral jsonb_each(r.metrics) e
    where r.user_id = p_user_id
      and r.player_tag = p_player_tag
      and jsonb_typeof(e.value) = 'number'
    group by e.key
)
select coalesce(jsonb_object_agg(metric, value), '{}'::jsonb)
from metric_rows;
$$;

revoke all on function public.read_achievement_source_metrics_v1(uuid, text)
    from public, anon, authenticated;
grant execute on function public.read_achievement_source_metrics_v1(uuid, text)
    to service_role;

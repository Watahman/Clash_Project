-- Shared L2 cache. This table contains public Clash API responses only.
-- Never write player verification tokens, auth tokens or private user rows here.

create table if not exists public.api_cache (
  cache_key text primary key,
  entity_type text not null,
  entity_id text,
  payload jsonb not null,
  fetched_at timestamptz not null,
  fresh_until timestamptz not null,
  stale_until timestamptz not null,
  source_status integer not null default 200,
  schema_version integer not null default 1,
  payload_hash text,
  updated_at timestamptz not null default now(),
  constraint api_cache_window_check check (fetched_at <= fresh_until and fresh_until <= stale_until),
  constraint api_cache_status_check check (source_status between 100 and 599),
  constraint api_cache_schema_version_check check (schema_version > 0)
);

create index if not exists api_cache_entity_idx on public.api_cache(entity_type, entity_id);
create index if not exists api_cache_cleanup_idx on public.api_cache(stale_until);

alter table public.api_cache enable row level security;
revoke all on public.api_cache from anon, authenticated;

create or replace function public.cleanup_expired_api_cache(batch_size integer default 500)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  with expired as (
    select cache_key
    from public.api_cache
    where stale_until < now()
    order by stale_until
    limit greatest(1, least(batch_size, 5000))
  )
  delete from public.api_cache cache
  using expired
  where cache.cache_key = expired.cache_key;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
revoke all on function public.cleanup_expired_api_cache(integer) from public, anon, authenticated;


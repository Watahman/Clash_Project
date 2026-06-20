create table public.group_clans (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  clan_tag text not null,
  clan_name text not null,
  badge_url text,
  added_by uuid not null references public.users(id),
  created_at timestamp with time zone not null default now(),
  unique (group_id, clan_tag)
);

create index group_clans_group_id_idx on public.group_clans(group_id);
create index group_clans_clan_tag_idx on public.group_clans(clan_tag);

create table if not exists public.regular_war_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  clan_tag text not null,
  war_key text not null,
  player_tag text not null,
  attack_slot smallint not null,
  assignment_type text not null default 'base',
  target_position smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint regular_war_assignments_clan_tag_check
    check (clan_tag ~ '^#[0289PYLQGRJCUV]{3,15}$'),
  constraint regular_war_assignments_player_tag_check
    check (player_tag ~ '^#[0289PYLQGRJCUV]{3,15}$'),
  constraint regular_war_assignments_war_key_check
    check (char_length(war_key) between 8 and 160),
  constraint regular_war_assignments_attack_slot_check
    check (attack_slot between 1 and 2),
  constraint regular_war_assignments_type_check
    check (assignment_type in ('base', 'cleanup', 'hold', 'free')),
  constraint regular_war_assignments_target_check
    check (
      (assignment_type in ('base', 'cleanup') and target_position between 1 and 50)
      or (assignment_type in ('hold', 'free') and target_position is null)
    ),
  unique (user_id, clan_tag, war_key, player_tag, attack_slot)
);

create index if not exists regular_war_assignments_lookup_idx
  on public.regular_war_assignments(user_id, clan_tag, war_key, updated_at desc);

alter table public.regular_war_assignments enable row level security;

drop policy if exists regular_war_assignments_owner_write
  on public.regular_war_assignments;
create policy regular_war_assignments_owner_write
  on public.regular_war_assignments
  for all
  to authenticated
  using (
    (select public.current_app_user_id()) = user_id
  )
  with check (
    (select public.current_app_user_id()) = user_id
  );

revoke all on table public.regular_war_assignments from public, anon;
grant select, insert, update, delete
  on table public.regular_war_assignments to authenticated;
grant all
  on table public.regular_war_assignments to service_role;

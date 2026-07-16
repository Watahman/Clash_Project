-- Forward-only security migration.
-- Before applying to an existing project, take a database backup and run the
-- duplicate/orphan preflight queries documented in DATABASE_MIGRATIONS.md.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  code text not null default upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 8)),
  accounts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.users add column if not exists auth_user_id uuid;
alter table public.users add column if not exists updated_at timestamptz not null default now();
alter table public.users alter column accounts set default '[]'::jsonb;
update public.users set accounts = '[]'::jsonb where accounts is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'users_auth_user_id_fkey'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_auth_user_id_fkey
      foreign key (auth_user_id) references auth.users(id) on delete cascade
      not valid;
  end if;
end $$;

create unique index if not exists users_auth_user_id_unique_idx
  on public.users(auth_user_id)
  where auth_user_id is not null;
create unique index if not exists users_email_normalized_unique_idx
  on public.users(lower(email))
  where email is not null;
create unique index if not exists users_code_unique_idx on public.users(code);

update public.users profile
set auth_user_id = profile.id
where profile.auth_user_id is null
  and exists (select 1 from auth.users account where account.id = profile.id);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_id uuid;
  display_name text;
begin
  display_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  select id into existing_id
  from public.users
  where auth_user_id is null
    and email is not null
    and lower(email) = lower(new.email)
  order by created_at
  limit 1
  for update;

  if existing_id is not null then
    update public.users
    set auth_user_id = new.id,
        name = coalesce(display_name, name),
        updated_at = now()
    where id = existing_id;
  else
    insert into public.users (id, auth_user_id, name, email, code, accounts)
    values (
      new.id,
      new.id,
      coalesce(display_name, split_part(coalesce(new.email, 'ClashTools user'), '@', 1)),
      new.email,
      upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 8)),
      '[]'::jsonb
    )
    on conflict (id) do update
      set auth_user_id = excluded.auth_user_id,
          updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.users where auth_user_id = auth.uid() limit 1
$$;

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  info jsonb not null default '[]'::jsonb,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plans_name_length_check check (char_length(trim(name)) between 1 and 40),
  constraint plans_revision_positive_check check (revision > 0)
);
alter table public.plans add column if not exists owner_id uuid;
alter table public.plans add column if not exists revision bigint not null default 1;
alter table public.plans add column if not exists created_at timestamptz not null default now();
alter table public.plans add column if not exists updated_at timestamptz not null default now();
create index if not exists plans_owner_updated_idx on public.plans(owner_id, updated_at desc);

create table if not exists public.plan_users (
  plan_id uuid not null references public.plans(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);
create index if not exists plan_users_user_idx on public.plan_users(user_id);

create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.users(id) on delete cascade,
  user_b uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friends_not_self_check check (user_a <> user_b),
  constraint friends_status_check check (status in ('pending', 'accepted'))
);
alter table public.friends add column if not exists created_at timestamptz not null default now();
alter table public.friends add column if not exists updated_at timestamptz not null default now();
create unique index if not exists friends_canonical_pair_unique_idx
  on public.friends (least(user_a, user_b), greatest(user_a, user_b));
create index if not exists friends_user_a_status_idx on public.friends(user_a, status);
create index if not exists friends_user_b_status_idx on public.friends(user_b, status);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete restrict,
  name text not null,
  code text not null,
  badge text not null default 'shield',
  badge_url text,
  polls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.groups add column if not exists created_at timestamptz not null default now();
alter table public.groups add column if not exists updated_at timestamptz not null default now();
create unique index if not exists groups_code_unique_idx on public.groups(code);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id),
  constraint group_members_role_check_v2 check (role in ('member', 'co_leader', 'leader'))
);
alter table public.group_members add column if not exists joined_at timestamptz not null default now();
create unique index if not exists group_members_one_leader_idx
  on public.group_members(group_id)
  where role = 'leader';
create index if not exists group_members_user_idx on public.group_members(user_id);

create or replace function public.is_group_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = target_group_id
      and user_id = public.current_app_user_id()
  )
$$;

create or replace function public.can_manage_group(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = target_group_id
      and user_id = public.current_app_user_id()
      and role in ('leader', 'co_leader')
  )
$$;

alter table public.users enable row level security;
alter table public.plans enable row level security;
alter table public.plan_users enable row level security;
alter table public.friends enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

drop policy if exists users_read_self on public.users;
create policy users_read_self on public.users for select to authenticated
  using (id = public.current_app_user_id());
drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users for update to authenticated
  using (id = public.current_app_user_id())
  with check (id = public.current_app_user_id());

drop policy if exists plans_member_read on public.plans;
create policy plans_member_read on public.plans for select to authenticated
  using (
    owner_id = public.current_app_user_id()
    or exists (
      select 1 from public.plan_users membership
      where membership.plan_id = plans.id
        and membership.user_id = public.current_app_user_id()
    )
  );
drop policy if exists plans_owner_write on public.plans;
create policy plans_owner_write on public.plans for all to authenticated
  using (owner_id = public.current_app_user_id())
  with check (owner_id = public.current_app_user_id());

drop policy if exists plan_users_member_read on public.plan_users;
create policy plan_users_member_read on public.plan_users for select to authenticated
  using (
    user_id = public.current_app_user_id()
    or exists (
      select 1 from public.plans
      where plans.id = plan_users.plan_id
        and plans.owner_id = public.current_app_user_id()
    )
  );

drop policy if exists friends_participant_access on public.friends;
create policy friends_participant_access on public.friends for all to authenticated
  using (public.current_app_user_id() in (user_a, user_b))
  with check (public.current_app_user_id() in (user_a, user_b));

drop policy if exists groups_member_read on public.groups;
create policy groups_member_read on public.groups for select to authenticated
  using (public.is_group_member(id));
drop policy if exists groups_owner_write on public.groups;
create policy groups_owner_write on public.groups for update to authenticated
  using (owner_id = public.current_app_user_id())
  with check (owner_id = public.current_app_user_id());

drop policy if exists group_members_member_read on public.group_members;
create policy group_members_member_read on public.group_members for select to authenticated
  using (public.is_group_member(group_id));
drop policy if exists group_members_self_join on public.group_members;
create policy group_members_self_join on public.group_members for insert to authenticated
  with check (user_id = public.current_app_user_id() and role = 'member');
drop policy if exists group_members_self_leave on public.group_members;
create policy group_members_self_leave on public.group_members for delete to authenticated
  using (user_id = public.current_app_user_id() and role <> 'leader');

revoke all on public.users, public.plans, public.plan_users, public.friends, public.groups, public.group_members from anon;
grant select, update on public.users to authenticated;
grant select, insert, update, delete on public.plans, public.plan_users, public.friends, public.groups, public.group_members to authenticated;


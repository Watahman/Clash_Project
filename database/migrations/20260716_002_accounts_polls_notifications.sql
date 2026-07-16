-- Normalize user-owned accounts, poll answers and internal notifications.

create table if not exists public.user_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  player_tag text not null,
  player_name text,
  town_hall_level integer,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_accounts_tag_format_check check (player_tag ~ '^#[0289PYLQGRJCUV]{3,15}$'),
  unique (user_id, player_tag)
);
create unique index if not exists user_accounts_global_tag_unique_idx on public.user_accounts(player_tag);
create index if not exists user_accounts_user_idx on public.user_accounts(user_id);

insert into public.user_accounts (user_id, player_tag, player_name, town_hall_level, snapshot)
select
  profile.id,
  upper(case when left(raw.tag, 1) = '#' then raw.tag else '#' || raw.tag end),
  nullif(raw.account ->> 'name', ''),
  case when (raw.account ->> 'townHallLevel') ~ '^\d+$' then (raw.account ->> 'townHallLevel')::integer end,
  raw.account
from public.users profile
cross join lateral (
  select account,
         trim(coalesce(
           account ->> 'tag',
           account ->> 'playerTag',
           account ->> 'accountTag',
           account ->> 'clashTag'
         )) as tag
  from jsonb_array_elements(coalesce(profile.accounts::jsonb, '[]'::jsonb)) account
) raw
where raw.tag <> ''
on conflict (user_id, player_tag) do update
  set snapshot = excluded.snapshot,
      player_name = coalesce(excluded.player_name, public.user_accounts.player_name),
      town_hall_level = coalesce(excluded.town_hall_level, public.user_accounts.town_hall_level),
      updated_at = now();

create table if not exists public.group_polls (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  creator_id uuid not null references public.users(id) on delete restrict,
  type text not null default 'cwl_availability',
  title text not null,
  status text not null default 'open',
  rounds smallint not null default 7,
  deadline timestamptz,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  archived_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint group_polls_type_check check (type = 'cwl_availability'),
  constraint group_polls_status_check check (status in ('open', 'closed', 'archived')),
  constraint group_polls_rounds_check check (rounds between 1 and 7),
  constraint group_polls_title_length_check check (char_length(trim(title)) between 1 and 120)
);
create unique index if not exists group_polls_one_open_cwl_idx
  on public.group_polls(group_id)
  where type = 'cwl_availability' and status = 'open';
create index if not exists group_polls_group_created_idx on public.group_polls(group_id, created_at desc);

create table if not exists public.group_poll_answers (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.group_polls(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (poll_id, user_id)
);
create index if not exists group_poll_answers_poll_idx on public.group_poll_answers(poll_id);

create table if not exists public.group_poll_account_answers (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.group_poll_answers(id) on delete cascade,
  user_account_id uuid not null references public.user_accounts(id) on delete cascade,
  wants_cwl boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (answer_id, user_account_id)
);

create table if not exists public.group_poll_day_answers (
  account_answer_id uuid not null references public.group_poll_account_answers(id) on delete cascade,
  round smallint not null,
  available boolean not null,
  updated_at timestamptz not null default now(),
  primary key (account_answer_id, round),
  constraint group_poll_day_round_check check (round between 1 and 7)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.users(id) on delete cascade,
  sender_id uuid references public.users(id) on delete set null,
  type text not null,
  title text not null,
  body text,
  payload jsonb not null default '{}'::jsonb,
  related_group_id uuid references public.groups(id) on delete cascade,
  related_poll_id uuid references public.group_polls(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_type_check check (type in ('poll_reminder', 'friend_request', 'group_update')),
  constraint notifications_title_length_check check (char_length(title) between 1 and 160)
);
create index if not exists notifications_recipient_unread_idx
  on public.notifications(recipient_id, created_at desc)
  where read_at is null;

create table if not exists public.poll_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.group_polls(id) on delete cascade,
  recipient_id uuid not null references public.users(id) on delete cascade,
  sender_id uuid references public.users(id) on delete set null,
  notification_id uuid references public.notifications(id) on delete set null,
  sent_at timestamptz not null default now()
);
create index if not exists poll_reminders_poll_recipient_sent_idx
  on public.poll_reminder_deliveries(poll_id, recipient_id, sent_at desc);

alter table public.user_accounts enable row level security;
alter table public.group_polls enable row level security;
alter table public.group_poll_answers enable row level security;
alter table public.group_poll_account_answers enable row level security;
alter table public.group_poll_day_answers enable row level security;
alter table public.notifications enable row level security;
alter table public.poll_reminder_deliveries enable row level security;

drop policy if exists user_accounts_owner_access on public.user_accounts;
create policy user_accounts_owner_access on public.user_accounts for all to authenticated
  using (user_id = public.current_app_user_id())
  with check (user_id = public.current_app_user_id());

drop policy if exists group_polls_member_read on public.group_polls;
create policy group_polls_member_read on public.group_polls for select to authenticated
  using (public.is_group_member(group_id));
drop policy if exists group_polls_admin_write on public.group_polls;
create policy group_polls_admin_write on public.group_polls for all to authenticated
  using (public.can_manage_group(group_id))
  with check (public.can_manage_group(group_id));

drop policy if exists poll_answers_owner_or_admin_read on public.group_poll_answers;
create policy poll_answers_owner_or_admin_read on public.group_poll_answers for select to authenticated
  using (
    user_id = public.current_app_user_id()
    or exists (
      select 1 from public.group_polls poll
      where poll.id = group_poll_answers.poll_id
        and public.can_manage_group(poll.group_id)
    )
  );
drop policy if exists poll_answers_owner_write on public.group_poll_answers;
create policy poll_answers_owner_write on public.group_poll_answers for all to authenticated
  using (user_id = public.current_app_user_id())
  with check (user_id = public.current_app_user_id());

drop policy if exists poll_account_answers_allowed_read on public.group_poll_account_answers;
create policy poll_account_answers_allowed_read on public.group_poll_account_answers for select to authenticated
  using (
    exists (
      select 1
      from public.group_poll_answers answer
      join public.group_polls poll on poll.id = answer.poll_id
      where answer.id = group_poll_account_answers.answer_id
        and (
          answer.user_id = public.current_app_user_id()
          or public.can_manage_group(poll.group_id)
        )
    )
  );
drop policy if exists poll_account_answers_owner_write on public.group_poll_account_answers;
create policy poll_account_answers_owner_write on public.group_poll_account_answers for all to authenticated
  using (
    exists (
      select 1 from public.group_poll_answers answer
      where answer.id = group_poll_account_answers.answer_id
        and answer.user_id = public.current_app_user_id()
    )
  )
  with check (
    exists (
      select 1 from public.group_poll_answers answer
      where answer.id = group_poll_account_answers.answer_id
        and answer.user_id = public.current_app_user_id()
    )
  );

drop policy if exists notifications_recipient_read on public.notifications;
create policy notifications_recipient_read on public.notifications for select to authenticated
  using (recipient_id = public.current_app_user_id());
drop policy if exists notifications_recipient_update on public.notifications;
create policy notifications_recipient_update on public.notifications for update to authenticated
  using (recipient_id = public.current_app_user_id())
  with check (recipient_id = public.current_app_user_id());

revoke all on public.user_accounts, public.group_polls, public.group_poll_answers,
  public.group_poll_account_answers, public.group_poll_day_answers,
  public.notifications, public.poll_reminder_deliveries from anon;
grant select, insert, update, delete on public.user_accounts, public.group_polls,
  public.group_poll_answers, public.group_poll_account_answers,
  public.group_poll_day_answers, public.notifications,
  public.poll_reminder_deliveries to authenticated;

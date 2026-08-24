-- Make normalized account and relation tables authoritative without deleting data.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '90s';

-- Abort before adding keys when legacy duplicates need an explicit owner decision.
do $$
begin
    if exists (
        select 1 from public.friends
        group by least(user_a, user_b), greatest(user_a, user_b)
        having count(*) > 1
    ) then
        raise exception 'duplicate friend relationships must be resolved';
    end if;
    if exists (select 1 from public.group_members group by group_id, user_id having count(*) > 1) then
        raise exception 'duplicate group_members rows must be resolved';
    end if;
    if exists (select 1 from public.plan_users group by plan_id, user_id having count(*) > 1) then
        raise exception 'duplicate plan_users rows must be resolved';
    end if;
    if exists (select 1 from public.group_poll_answers group by poll_id, user_id having count(*) > 1) then
        raise exception 'duplicate group_poll_answers rows must be resolved';
    end if;
    if exists (
        select 1 from public.group_poll_account_answers
        group by answer_id, user_account_id having count(*) > 1
    ) then
        raise exception 'duplicate group_poll_account_answers rows must be resolved';
    end if;
    if exists (select 1 from public.user_accounts group by user_id, player_tag having count(*) > 1) then
        raise exception 'duplicate user account links must be resolved';
    end if;
    if exists (select 1 from public.user_accounts group by player_tag having count(*) > 1) then
        raise exception 'player tags linked to multiple profiles must be resolved';
    end if;
    if exists (select 1 from public.group_clans group by group_id, clan_tag having count(*) > 1) then
        raise exception 'duplicate clan family links must be resolved';
    end if;
    if exists (
        select 1 from public.regular_war_assignments
        group by user_id, war_key, player_tag, attack_slot
        having count(*) > 1
    ) then
        raise exception 'duplicate regular war assignment slots must be resolved';
    end if;
end
$$;

alter table public.friends add column if not exists id uuid default gen_random_uuid();
update public.friends set id = gen_random_uuid() where id is null;
alter table public.friends alter column id set not null;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conrelid = 'public.friends'::regclass and contype = 'p'
    ) then
        alter table public.friends add constraint friends_pkey primary key (id);
    end if;
    if not exists (
        select 1 from pg_constraint
        where conrelid = 'public.group_members'::regclass and contype = 'p'
    ) then
        alter table public.group_members
            add constraint group_members_pkey primary key (group_id, user_id);
    end if;
    if not exists (
        select 1 from pg_constraint
        where conrelid = 'public.plan_users'::regclass and contype = 'p'
    ) then
        alter table public.plan_users
            add constraint plan_users_pkey primary key (plan_id, user_id);
    end if;
end
$$;

create unique index if not exists friends_canonical_pair_unique_idx
    on public.friends (least(user_a, user_b), greatest(user_a, user_b));
create unique index if not exists user_accounts_user_tag_unique_idx
    on public.user_accounts (user_id, player_tag);
create unique index if not exists user_accounts_global_tag_unique_idx
    on public.user_accounts (player_tag);
create unique index if not exists group_clans_group_tag_unique_idx
    on public.group_clans (group_id, clan_tag);
create unique index if not exists group_poll_answers_poll_user_unique_idx
    on public.group_poll_answers (poll_id, user_id);
create unique index if not exists group_poll_account_answers_answer_account_unique_idx
    on public.group_poll_account_answers (answer_id, user_account_id);
create unique index if not exists regular_war_assignments_slot_unique_idx
    on public.regular_war_assignments (user_id, war_key, player_tag, attack_slot);

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'user_accounts_user_tag_unique'
          and conrelid = 'public.user_accounts'::regclass
    ) then
        alter table public.user_accounts
            add constraint user_accounts_user_tag_unique
            unique using index user_accounts_user_tag_unique_idx;
    end if;
end
$$;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'friends_not_self_check'
          and conrelid = 'public.friends'::regclass
    ) then
        alter table public.friends
            add constraint friends_not_self_check check (user_a <> user_b) not valid;
    end if;
    if not exists (
        select 1 from pg_constraint
        where conname = 'friends_status_check'
          and conrelid = 'public.friends'::regclass
    ) then
        alter table public.friends
            add constraint friends_status_check check (status in ('pending', 'accepted')) not valid;
    end if;
    if not exists (
        select 1 from pg_constraint
        where conname = 'user_accounts_snapshot_object_check'
          and conrelid = 'public.user_accounts'::regclass
    ) then
        alter table public.user_accounts add constraint user_accounts_snapshot_object_check
            check (jsonb_typeof(snapshot) = 'object') not valid;
    end if;
    if not exists (
        select 1 from pg_constraint
        where conname = 'notifications_payload_object_check'
          and conrelid = 'public.notifications'::regclass
    ) then
        alter table public.notifications add constraint notifications_payload_object_check
            check (jsonb_typeof(payload) = 'object') not valid;
    end if;
end
$$;

alter table public.friends validate constraint friends_not_self_check;
alter table public.friends validate constraint friends_status_check;
alter table public.user_accounts validate constraint user_accounts_snapshot_object_check;
alter table public.notifications validate constraint notifications_payload_object_check;

-- Recover normalized account rows from the legacy JSON array before cutover.
insert into public.user_accounts (user_id, player_tag, player_name, town_hall_level, snapshot)
select profile.id,
       normalized.player_tag,
       nullif(account.item->>'name', ''),
       case when account.item->>'townHallLevel' ~ '^\d+$'
            then (account.item->>'townHallLevel')::integer end,
       account.item
from public.users profile
cross join lateral jsonb_array_elements(
    case when jsonb_typeof(profile.accounts) = 'array' then profile.accounts else '[]'::jsonb end
) account(item)
cross join lateral (
    select upper(case when left(raw_tag, 1) = '#' then raw_tag else '#' || raw_tag end) player_tag
    from (values (btrim(coalesce(
        account.item->>'tag', account.item->>'playerTag',
        account.item->>'accountTag', account.item->>'clashTag', ''
    )))) tag(raw_tag)
) normalized
where normalized.player_tag ~ '^#[0289PYLQGRJCUV]{3,15}$'
on conflict (player_tag) do update
set snapshot = excluded.snapshot,
    player_name = coalesce(excluded.player_name, public.user_accounts.player_name),
    town_hall_level = coalesce(excluded.town_hall_level, public.user_accounts.town_hall_level),
    updated_at = now();

-- Every account-scoped durable row must point to an owned normalized account.
do $$
declare
    target record;
begin
    for target in select * from (values
        ('advanced_stats_tracking', 'advanced_stats_tracking_account_fkey'),
        ('achievement_base_snapshots', 'achievement_base_snapshots_account_fkey'),
        ('achievement_progress', 'achievement_progress_account_fkey'),
        ('achievement_source_state', 'achievement_source_state_account_fkey'),
        ('achievement_source_records', 'achievement_source_records_account_fkey')
    ) value(table_name, constraint_name)
    loop
        if not exists (
            select 1 from pg_constraint
            where conname = target.constraint_name
              and conrelid = format('public.%I', target.table_name)::regclass
        ) then
            execute format(
                'alter table public.%I add constraint %I foreign key (user_id, player_tag) '
                || 'references public.user_accounts(user_id, player_tag) on delete cascade not valid',
                target.table_name, target.constraint_name
            );
        end if;
    end loop;
end
$$;

alter table public.advanced_stats_tracking
    validate constraint advanced_stats_tracking_account_fkey;
alter table public.achievement_base_snapshots
    validate constraint achievement_base_snapshots_account_fkey;
alter table public.achievement_progress
    validate constraint achievement_progress_account_fkey;
alter table public.achievement_source_state
    validate constraint achievement_source_state_account_fkey;
alter table public.achievement_source_records
    validate constraint achievement_source_records_account_fkey;

-- Atomic verified-account ownership claim. The JSON update is transition-only.
create or replace function public.claim_verified_user_account(
    p_user_id uuid,
    p_player_tag text,
    p_account jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    normalized_tag text := upper(btrim(coalesce(p_player_tag, '')));
    claimed public.user_accounts%rowtype;
    existing_user_id uuid;
begin
    if normalized_tag !~ '^#[0289PYLQGRJCUV]{3,15}$' then
        raise exception 'invalid player tag' using errcode = '22023';
    end if;
    if jsonb_typeof(coalesce(p_account, '{}'::jsonb)) <> 'object' then
        raise exception 'account payload must be an object' using errcode = '22023';
    end if;
    if not exists (select 1 from public.users where id = p_user_id) then
        raise exception 'user profile not found' using errcode = 'P0002';
    end if;

    select user_id into existing_user_id
    from public.user_accounts
    where player_tag = normalized_tag
    for update;
    if existing_user_id is not null and existing_user_id <> p_user_id then
        raise exception 'verified account is already linked to another profile'
            using errcode = '23505';
    end if;

    insert into public.user_accounts (
        user_id, player_tag, player_name, town_hall_level, snapshot, updated_at
    ) values (
        p_user_id, normalized_tag, nullif(p_account->>'name', ''),
        case when p_account->>'townHallLevel' ~ '^\d+$'
             then (p_account->>'townHallLevel')::integer end,
        p_account || jsonb_build_object('tag', normalized_tag), now()
    )
    on conflict (player_tag) do update
    set player_name = excluded.player_name,
        town_hall_level = excluded.town_hall_level,
        snapshot = excluded.snapshot,
        updated_at = now()
    returning * into claimed;

    update public.users
    set accounts = coalesce((
            select jsonb_agg(item)
            from jsonb_array_elements(
                case when jsonb_typeof(accounts) = 'array' then accounts else '[]'::jsonb end
            ) item
            where upper(coalesce(item->>'tag', item->>'playerTag', '')) <> normalized_tag
        ), '[]'::jsonb) || jsonb_build_array(claimed.snapshot),
        updated_at = now()
    where id = p_user_id;

    return jsonb_build_object('success', true, 'account', to_jsonb(claimed));
end
$$;

revoke all on function public.claim_verified_user_account(uuid, text, jsonb)
    from public, anon, authenticated;
grant execute on function public.claim_verified_user_account(uuid, text, jsonb)
    to service_role;

commit;

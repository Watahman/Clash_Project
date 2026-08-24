-- Remove transition-only storage and add bounded operational retention.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '90s';

-- The application cache lives in Cloud SQL. Supabase no longer owns a second
-- cache copy or its cleanup RPC.
drop function if exists public.cleanup_expired_api_cache(integer);
drop table if exists public.api_cache;

-- Historical achievement calculations only need derived metrics. Keep the raw
-- payload for the newest complete snapshot so current-data enrichment still works.
alter table public.achievement_base_snapshots
    alter column payload drop not null;

with ranked as (
    select id,
           row_number() over (
               partition by user_id, player_tag
               order by source_timestamp desc, id desc
           ) as position
    from public.achievement_base_snapshots
    where metrics <> '{}'::jsonb
)
update public.achievement_base_snapshots snapshot
set payload = null
from ranked
where ranked.id = snapshot.id
  and ranked.position > 1
  and snapshot.payload is not null;

create or replace function public.retain_latest_achievement_payload_v1()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    latest_id bigint;
begin
    if new.payload is null then
        return new;
    end if;

    select snapshot.id into latest_id
    from public.achievement_base_snapshots snapshot
    where snapshot.user_id = new.user_id
      and snapshot.player_tag = new.player_tag
      and snapshot.metrics <> '{}'::jsonb
    order by snapshot.source_timestamp desc, snapshot.id desc
    limit 1;

    if latest_id is not null then
        update public.achievement_base_snapshots snapshot
        set payload = null
        where snapshot.user_id = new.user_id
          and snapshot.player_tag = new.player_tag
          and snapshot.id <> latest_id
          and snapshot.payload is not null
          and snapshot.metrics <> '{}'::jsonb;
    end if;
    return new;
end
$$;

drop trigger if exists achievement_snapshot_payload_retention
    on public.achievement_base_snapshots;
create trigger achievement_snapshot_payload_retention
after insert or update of payload on public.achievement_base_snapshots
for each row execute function public.retain_latest_achievement_payload_v1();

revoke all on function public.retain_latest_achievement_payload_v1()
    from public, anon, authenticated;
grant execute on function public.retain_latest_achievement_payload_v1()
    to service_role;

create index if not exists notifications_read_retention_idx
    on public.notifications (created_at)
    where read_at is not null;
create index if not exists poll_reminder_deliveries_retention_idx
    on public.poll_reminder_deliveries (sent_at);
create index if not exists feedback_submissions_retention_idx
    on public.feedback_submissions (created_at)
    where status in ('reviewed', 'resolved', 'spam');

-- Keep maintenance bounded so one cleanup call cannot hold locks for long.
create or replace function public.cleanup_clashpanel_operational_data(
    p_now timestamptz default now(),
    p_batch_size integer default 1000
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    batch_limit integer := greatest(1, least(coalesce(p_batch_size, 1000), 5000));
    error_events_removed integer := 0;
    notifications_removed integer := 0;
    reminders_removed integer := 0;
    feedback_removed integer := 0;
    screenshots_removed integer := 0;
begin
    with candidates as (
        select id from public.client_error_events
        where created_at < p_now - interval '30 days'
        order by created_at
        limit batch_limit
    ), removed as (
        delete from public.client_error_events event
        using candidates
        where event.id = candidates.id
        returning 1
    ) select count(*) into error_events_removed from removed;

    with candidates as (
        select id from public.notifications
        where read_at is not null
          and created_at < p_now - interval '180 days'
        order by created_at
        limit batch_limit
    ), removed as (
        delete from public.notifications notification
        using candidates
        where notification.id = candidates.id
        returning 1
    ) select count(*) into notifications_removed from removed;

    with candidates as (
        select id from public.poll_reminder_deliveries
        where sent_at < p_now - interval '180 days'
        order by sent_at
        limit batch_limit
    ), removed as (
        delete from public.poll_reminder_deliveries delivery
        using candidates
        where delivery.id = candidates.id
        returning 1
    ) select count(*) into reminders_removed from removed;

    with candidates as (
        select id from public.feedback_submissions
        where status in ('reviewed', 'resolved', 'spam')
          and screenshot_data is not null
          and created_at < p_now - interval '90 days'
        order by created_at
        limit batch_limit
    ), scrubbed as (
        update public.feedback_submissions feedback
        set screenshot_data = null
        from candidates
        where feedback.id = candidates.id
        returning 1
    ) select count(*) into screenshots_removed from scrubbed;

    with candidates as (
        select id from public.feedback_submissions
        where status in ('resolved', 'spam')
          and created_at < p_now - interval '365 days'
        order by created_at
        limit batch_limit
    ), removed as (
        delete from public.feedback_submissions feedback
        using candidates
        where feedback.id = candidates.id
        returning 1
    ) select count(*) into feedback_removed from removed;

    return jsonb_build_object(
        'clientErrorEventsRemoved', error_events_removed,
        'notificationsRemoved', notifications_removed,
        'pollRemindersRemoved', reminders_removed,
        'feedbackRemoved', feedback_removed,
        'feedbackScreenshotsRemoved', screenshots_removed
    );
end
$$;

revoke all on function public.cleanup_clashpanel_operational_data(timestamptz, integer)
    from public, anon, authenticated;
grant execute on function public.cleanup_clashpanel_operational_data(timestamptz, integer)
    to service_role;

-- New profiles and verified account claims no longer write legacy JSON columns.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    existing_id uuid;
    display_name text;
begin
    display_name := nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), '');
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
        insert into public.users (id, auth_user_id, name, email, code)
        values (
            new.id,
            new.id,
            coalesce(display_name, split_part(coalesce(new.email, 'ClashTools user'), '@', 1)),
            new.email,
            upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 8))
        )
        on conflict (id) do update
        set auth_user_id = excluded.auth_user_id,
            updated_at = now();
    end if;
    return new;
end
$$;

revoke all on function public.handle_new_auth_user()
    from public, anon, authenticated;

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

    return jsonb_build_object('success', true, 'account', to_jsonb(claimed));
end
$$;

revoke all on function public.claim_verified_user_account(uuid, text, jsonb)
    from public, anon, authenticated;
grant execute on function public.claim_verified_user_account(uuid, text, jsonb)
    to service_role;

create or replace function public.read_clashpanel_achievement_metrics_v1(
    p_user_id uuid
) returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
with metrics as (
    select
        (select count(*) from public.plans p where p.owner_id = p_user_id)::bigint as plans_owned,
        (select count(*) from public.plan_users pu where pu.user_id = p_user_id)::bigint as plans_joined,
        (select count(*) from public.groups g where g.owner_id = p_user_id)::bigint as groups_owned,
        (select count(*) from public.group_members gm where gm.user_id = p_user_id)::bigint as group_memberships,
        (select count(*) from public.group_polls gp where gp.creator_id = p_user_id)::bigint as polls_created,
        (select count(*) from public.group_poll_answers gpa where gpa.user_id = p_user_id)::bigint as polls_answered,
        (select count(*) from public.regular_war_assignments rwa where rwa.user_id = p_user_id)::bigint as assignments,
        (select count(*) from public.friends f where f.status = 'accepted' and (f.user_a = p_user_id or f.user_b = p_user_id))::bigint as friends_count,
        (select count(*) from public.user_accounts ua where ua.user_id = p_user_id)::bigint as account_count,
        (select count(*) from public.group_clans gc where gc.added_by = p_user_id)::bigint as clans_linked,
        (select count(*) from public.poll_reminder_deliveries prd where prd.sender_id = p_user_id)::bigint as reminders_sent,
        coalesce((
            select max(case
                when lower(replace(replace(gm.role, '_', ''), '-', '')) = 'leader' then 4
                when lower(replace(replace(gm.role, '_', ''), '-', '')) = 'coleader' then 3
                when lower(replace(replace(gm.role, '_', ''), '-', '')) in ('admin', 'elder') then 2
                else 1
            end)
            from public.group_members gm
            where gm.user_id = p_user_id
        ), 0)::bigint as family_role_rank
)
select jsonb_build_object(
    'clashpanel_plans_owned', plans_owned,
    'clashpanel_plans_joined', plans_joined,
    'clashpanel_groups_owned', groups_owned,
    'clashpanel_group_memberships', group_memberships,
    'clashpanel_polls_created', polls_created,
    'clashpanel_polls_answered', polls_answered,
    'war_assignment_count', assignments,
    'clashpanel_friends_count', friends_count,
    'clashpanel_account_count', account_count,
    'family_group_memberships', group_memberships,
    'family_groups_owned', groups_owned,
    'family_clans_linked', clans_linked,
    'family_polls_created', polls_created,
    'family_polls_answered', polls_answered,
    'family_reminders_sent', reminders_sent,
    'family_role_rank', family_role_rank,
    'fun_social_score', friends_count + group_memberships + polls_answered,
    'fun_planner_score', plans_owned + plans_joined + assignments,
    'fun_family_builder', groups_owned + group_memberships + clans_linked + polls_created,
    'fun_account_army', account_count
)
from metrics;
$$;

revoke all on function public.read_clashpanel_achievement_metrics_v1(uuid)
    from public, anon, authenticated;
grant execute on function public.read_clashpanel_achievement_metrics_v1(uuid)
    to service_role;

alter table public.users drop column if exists accounts;
alter table public.groups drop column if exists polls;

commit;

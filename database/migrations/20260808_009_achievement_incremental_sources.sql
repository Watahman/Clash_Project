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

-- Cheap app-local metrics are summarized in one service-role call. This avoids
-- turning the Achievements page into a fan-out of count queries.
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
        greatest(
            (select count(*) from public.user_accounts ua where ua.user_id = p_user_id)::bigint,
            coalesce((select jsonb_array_length(u.accounts) from public.users u where u.id = p_user_id and jsonb_typeof(u.accounts) = 'array'), 0)::bigint
        ) as account_count,
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

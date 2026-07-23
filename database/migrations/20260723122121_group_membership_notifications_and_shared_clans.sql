-- Keep group membership changes atomic, notify group leadership when someone
-- joins, and make linked clans explicitly group-scoped for every member.

alter table public.group_clans enable row level security;

drop policy if exists group_clans_member_read on public.group_clans;
create policy group_clans_member_read
  on public.group_clans for select to authenticated
  using (public.is_group_member(group_id));

drop policy if exists group_clans_admin_insert on public.group_clans;
create policy group_clans_admin_insert
  on public.group_clans for insert to authenticated
  with check (public.can_manage_group(group_id));

drop policy if exists group_clans_admin_update on public.group_clans;
create policy group_clans_admin_update
  on public.group_clans for update to authenticated
  using (public.can_manage_group(group_id))
  with check (public.can_manage_group(group_id));

drop policy if exists group_clans_admin_delete on public.group_clans;
create policy group_clans_admin_delete
  on public.group_clans for delete to authenticated
  using (public.can_manage_group(group_id));

revoke all on public.group_clans from anon;
grant select, insert, update, delete on public.group_clans to authenticated;

create or replace function public.join_group_with_notifications(
  p_actor_user_id uuid,
  p_group_code text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_group public.groups%rowtype;
  member_name text;
  normalized_code text := upper(trim(coalesce(p_group_code, '')));
  inserted_count integer := 0;
begin
  if p_actor_user_id is null or normalized_code = '' then
    raise exception 'actor and group code are required' using errcode = '22023';
  end if;

  select *
  into target_group
  from public.groups
  where code = normalized_code
  for update;

  if not found then
    raise exception 'group not found' using errcode = 'P0002';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (target_group.id, p_actor_user_id, 'member')
  on conflict (group_id, user_id) do nothing;
  get diagnostics inserted_count = row_count;

  if inserted_count = 0 then
    return jsonb_build_object(
      'success', true,
      'joined', false,
      'group_id', target_group.id
    );
  end if;

  select coalesce(nullif(trim(name), ''), 'A new member')
  into member_name
  from public.users
  where id = p_actor_user_id;
  member_name := coalesce(member_name, 'A new member');

  insert into public.notifications (
    recipient_id,
    sender_id,
    type,
    title,
    body,
    payload,
    related_group_id
  )
  select
    recipient.user_id,
    p_actor_user_id,
    'group_update',
    'New group member',
    member_name || ' joined ' || target_group.name || '.',
    jsonb_build_object(
      'event', 'member_joined',
      'groupId', target_group.id,
      'groupName', target_group.name,
      'memberId', p_actor_user_id,
      'memberName', member_name
    ),
    target_group.id
  from (
    select member.user_id
    from public.group_members member
    where member.group_id = target_group.id
      and member.role in ('leader', 'co_leader')
    union
    select target_group.owner_id
  ) recipient;

  return jsonb_build_object(
    'success', true,
    'joined', true,
    'group_id', target_group.id
  );
end;
$$;

create or replace function public.kick_group_member(
  p_actor_user_id uuid,
  p_group_id uuid,
  p_target_user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_role text;
  target_role text;
  group_owner_id uuid;
begin
  if p_actor_user_id is null or p_group_id is null or p_target_user_id is null then
    raise exception 'actor, group and target are required' using errcode = '22023';
  end if;
  if p_actor_user_id = p_target_user_id then
    raise exception 'use leave group for your own membership' using errcode = '42501';
  end if;

  select owner_id
  into group_owner_id
  from public.groups
  where id = p_group_id
  for update;

  if not found then
    raise exception 'group not found' using errcode = 'P0002';
  end if;

  select role
  into actor_role
  from public.group_members
  where group_id = p_group_id
    and user_id = p_actor_user_id
  for update;

  if group_owner_id = p_actor_user_id then
    actor_role := 'leader';
  end if;

  select role
  into target_role
  from public.group_members
  where group_id = p_group_id
    and user_id = p_target_user_id
  for update;

  if target_role is null then
    raise exception 'target member not found' using errcode = 'P0002';
  end if;

  if not (
    (actor_role = 'leader' and target_role in ('co_leader', 'member'))
    or (actor_role = 'co_leader' and target_role = 'member')
  ) then
    raise exception 'insufficient role to kick this member' using errcode = '42501';
  end if;

  delete from public.group_members
  where group_id = p_group_id
    and user_id = p_target_user_id;

  return jsonb_build_object(
    'success', true,
    'group_id', p_group_id,
    'kicked_user_id', p_target_user_id
  );
end;
$$;

revoke all on function public.join_group_with_notifications(uuid, text)
  from public, anon, authenticated;
revoke all on function public.kick_group_member(uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.join_group_with_notifications(uuid, text)
  to service_role;
grant execute on function public.kick_group_member(uuid, uuid, uuid)
  to service_role;

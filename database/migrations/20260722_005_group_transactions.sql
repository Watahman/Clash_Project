-- Keep group creation and leadership changes atomic. These functions are
-- service-only: the Java API derives the authenticated actor id.

update public.groups
set name = case
  when trim(name) = '' then 'Untitled group'
  when char_length(trim(name)) = 1 then trim(name) || ' group'
  else left(trim(name), 80)
end
where name <> trim(name) or char_length(trim(name)) not between 2 and 80;

alter table public.groups
drop constraint if exists groups_name_length_check;

alter table public.groups
add constraint groups_name_length_check
check (name = trim(name) and char_length(name) between 2 and 80);

create or replace function public.create_group_with_owner(
  p_owner_user_id uuid,
  p_name text,
  p_code text,
  p_badge text default 'banner',
  p_badge_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  group_row public.groups%rowtype;
  normalized_name text := trim(coalesce(p_name, ''));
  normalized_code text := trim(coalesce(p_code, ''));
begin
  if char_length(normalized_name) not between 2 and 80 then
    raise exception 'group name must be between 2 and 80 characters' using errcode = '22023';
  end if;
  if normalized_code = '' then
    raise exception 'group code is required' using errcode = '22023';
  end if;

  insert into public.groups (owner_id, name, code, badge, badge_url)
  values (
    p_owner_user_id,
    normalized_name,
    normalized_code,
    coalesce(nullif(trim(p_badge), ''), 'banner'),
    nullif(trim(coalesce(p_badge_url, '')), '')
  )
  returning * into group_row;

  insert into public.group_members (group_id, user_id, role)
  values (group_row.id, p_owner_user_id, 'leader');

  return to_jsonb(group_row);
end;
$$;

create or replace function public.transfer_group_leadership(
  p_actor_user_id uuid,
  p_group_id uuid,
  p_target_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  group_row public.groups%rowtype;
begin
  select * into group_row
  from public.groups
  where id = p_group_id
  for update;

  if not found then
    raise exception 'group not found' using errcode = 'P0002';
  end if;
  if group_row.owner_id <> p_actor_user_id and not exists (
    select 1 from public.group_members
    where group_id = p_group_id
      and user_id = p_actor_user_id
      and role = 'leader'
  ) then
    raise exception 'leader role required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_target_user_id
  ) then
    raise exception 'target is not a group member' using errcode = 'P0002';
  end if;
  if p_actor_user_id = p_target_user_id then
    return jsonb_build_object('success', true, 'group_id', p_group_id, 'owner_id', p_actor_user_id);
  end if;

  update public.group_members
  set role = 'co_leader'
  where group_id = p_group_id and role = 'leader';

  update public.group_members
  set role = 'leader'
  where group_id = p_group_id and user_id = p_target_user_id;

  update public.groups
  set owner_id = p_target_user_id, updated_at = now()
  where id = p_group_id;

  return jsonb_build_object('success', true, 'group_id', p_group_id, 'owner_id', p_target_user_id);
end;
$$;

revoke all on function public.create_group_with_owner(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.transfer_group_leadership(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_group_with_owner(uuid, text, text, text, text) to service_role;
grant execute on function public.transfer_group_leadership(uuid, uuid, uuid) to service_role;

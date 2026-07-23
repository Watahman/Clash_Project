-- Create polls and their notifications atomically, and send reminders to every
-- group member, including the actor who created or sent the poll event.

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in ('poll_created', 'poll_reminder', 'friend_request', 'group_update'));

create or replace function public.create_group_poll_with_notifications(
  p_actor_user_id uuid,
  p_group_id uuid,
  p_title text,
  p_rounds integer default 7,
  p_deadline timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  poll_row public.group_polls%rowtype;
  normalized_title text := trim(coalesce(p_title, ''));
begin
  if p_actor_user_id is null or p_group_id is null then
    raise exception 'actor and group are required' using errcode = '22023';
  end if;
  if char_length(normalized_title) not between 1 and 120 then
    raise exception 'poll title must contain between 1 and 120 characters' using errcode = '22023';
  end if;
  if p_rounds not between 1 and 7 then
    raise exception 'rounds must be between 1 and 7' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.group_members member
    where member.group_id = p_group_id
      and member.user_id = p_actor_user_id
      and member.role in ('leader', 'co_leader')
  ) and not exists (
    select 1
    from public.groups target_group
    where target_group.id = p_group_id
      and target_group.owner_id = p_actor_user_id
  ) then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  insert into public.group_polls (
    group_id,
    creator_id,
    type,
    title,
    status,
    rounds,
    deadline
  )
  values (
    p_group_id,
    p_actor_user_id,
    'cwl_availability',
    normalized_title,
    'open',
    p_rounds,
    p_deadline
  )
  returning * into poll_row;

  insert into public.notifications (
    recipient_id,
    sender_id,
    type,
    title,
    body,
    payload,
    related_group_id,
    related_poll_id
  )
  select
    recipient.user_id,
    p_actor_user_id,
    'poll_created',
    poll_row.title,
    'A new CWL availability poll is ready.',
    jsonb_build_object(
      'groupId', poll_row.group_id,
      'pollId', poll_row.id,
      'pollTitle', poll_row.title
    ),
    poll_row.group_id,
    poll_row.id
  from (
    select member.user_id
    from public.group_members member
    where member.group_id = poll_row.group_id
    union
    select p_actor_user_id
  ) recipient;

  return to_jsonb(poll_row);
end;
$$;

create or replace function public.send_group_poll_reminders(
  p_actor_user_id uuid,
  p_poll_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  poll_row public.group_polls%rowtype;
  member_row record;
  notification_id uuid;
  created_count integer := 0;
  skipped_count integer := 0;
  answered_count integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_poll_id::text, 0));
  select *
  into poll_row
  from public.group_polls
  where id = p_poll_id;

  if not found then
    raise exception 'poll not found' using errcode = 'P0002';
  end if;
  if not exists (
    select 1
    from public.group_members member
    where member.group_id = poll_row.group_id
      and member.user_id = p_actor_user_id
      and member.role in ('leader', 'co_leader')
  ) and not exists (
    select 1
    from public.groups target_group
    where target_group.id = poll_row.group_id
      and target_group.owner_id = p_actor_user_id
  ) then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  for member_row in
    select recipient.user_id
    from (
      select member.user_id
      from public.group_members member
      where member.group_id = poll_row.group_id
      union
      select p_actor_user_id
    ) recipient
  loop
    if exists (
      select 1
      from public.group_poll_answers answer
      where answer.poll_id = p_poll_id
        and answer.user_id = member_row.user_id
    ) then
      answered_count := answered_count + 1;
    end if;

    if exists (
      select 1
      from public.poll_reminder_deliveries delivery
      where delivery.poll_id = p_poll_id
        and delivery.recipient_id = member_row.user_id
        and delivery.sent_at >= now() - interval '6 hours'
    ) then
      skipped_count := skipped_count + 1;
      continue;
    end if;

    insert into public.notifications (
      recipient_id,
      sender_id,
      type,
      title,
      body,
      payload,
      related_group_id,
      related_poll_id
    )
    values (
      member_row.user_id,
      p_actor_user_id,
      'poll_reminder',
      poll_row.title,
      'Complete your CWL availability.',
      jsonb_build_object(
        'groupId', poll_row.group_id,
        'pollId', poll_row.id,
        'pollTitle', poll_row.title
      ),
      poll_row.group_id,
      poll_row.id
    )
    returning id into notification_id;

    insert into public.poll_reminder_deliveries (
      poll_id,
      recipient_id,
      sender_id,
      notification_id
    )
    values (
      p_poll_id,
      member_row.user_id,
      p_actor_user_id,
      notification_id
    );

    created_count := created_count + 1;
  end loop;

  return jsonb_build_object(
    'created', created_count,
    'skipped', skipped_count,
    'answered', answered_count
  );
end;
$$;

revoke all on function public.create_group_poll_with_notifications(uuid, uuid, text, integer, timestamptz)
  from public, anon, authenticated;
revoke all on function public.send_group_poll_reminders(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.create_group_poll_with_notifications(uuid, uuid, text, integer, timestamptz)
  to service_role;
grant execute on function public.send_group_poll_reminders(uuid, uuid)
  to service_role;

-- Notify the recipient when a friend request is created and notify the sender
-- when that request is accepted. The trigger keeps the friendship change and
-- its notification in the same transaction.

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'poll_created',
    'poll_reminder',
    'friend_request',
    'friend_accepted',
    'group_update'
  ));

create or replace function public.notify_friendship_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_name text;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    select coalesce(nullif(trim(profile.name), ''), 'Someone')
    into actor_name
    from public.users profile
    where profile.id = new.user_a;

    insert into public.notifications (
      recipient_id,
      sender_id,
      type,
      title,
      body,
      payload
    )
    values (
      new.user_b,
      new.user_a,
      'friend_request',
      'Friend request',
      coalesce(actor_name, 'Someone') || ' wants to add you as a friend.',
      jsonb_build_object(
        'event', 'friend_request',
        'actorId', new.user_a,
        'actorName', coalesce(actor_name, 'Someone')
      )
    );
  elsif tg_op = 'UPDATE'
    and old.status = 'pending'
    and new.status = 'accepted' then
    select coalesce(nullif(trim(profile.name), ''), 'Someone')
    into actor_name
    from public.users profile
    where profile.id = new.user_b;

    insert into public.notifications (
      recipient_id,
      sender_id,
      type,
      title,
      body,
      payload
    )
    values (
      new.user_a,
      new.user_b,
      'friend_accepted',
      'Friend added',
      coalesce(actor_name, 'Someone') || ' accepted your friend request.',
      jsonb_build_object(
        'event', 'friend_accepted',
        'actorId', new.user_b,
        'actorName', coalesce(actor_name, 'Someone')
      )
    );
  end if;

  return new;
end;
$$;

revoke all on function public.notify_friendship_change() from public, anon, authenticated;
grant execute on function public.notify_friendship_change() to service_role;

drop trigger if exists friends_notify_change on public.friends;
create trigger friends_notify_change
after insert or update of status on public.friends
for each row execute function public.notify_friendship_change();

-- Transactional poll writes and idempotent internal reminders.
-- These RPCs are service-only: the Java server verifies the Supabase session,
-- derives the actor id, and then calls the function with that verified id.

create or replace function public.submit_group_poll_answer(
  p_actor_user_id uuid,
  p_poll_id uuid,
  p_accounts jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  poll_row public.group_polls%rowtype;
  v_answer_id uuid;
  account_item jsonb;
  normalized_tag text;
  v_account_id uuid;
  v_account_answer_id uuid;
  round_number integer;
  wants_cwl boolean;
begin
  if jsonb_typeof(coalesce(p_accounts, '[]'::jsonb)) <> 'array' then
    raise exception 'accounts must be an array' using errcode = '22023';
  end if;
  select * into poll_row from public.group_polls where id = p_poll_id for update;
  if not found then raise exception 'poll not found' using errcode = 'P0002'; end if;
  if poll_row.status <> 'open' then raise exception 'poll is closed' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.group_members
    where group_id = poll_row.group_id and user_id = p_actor_user_id
  ) then
    raise exception 'not a group member' using errcode = '42501';
  end if;

  insert into public.group_poll_answers (poll_id, user_id, updated_at)
  values (p_poll_id, p_actor_user_id, now())
  on conflict (poll_id, user_id) do update set updated_at = excluded.updated_at
  returning id into v_answer_id;
  delete from public.group_poll_account_answers answer_account
  where answer_account.answer_id = v_answer_id;

  for account_item in select value from jsonb_array_elements(p_accounts)
  loop
    normalized_tag := upper(trim(coalesce(account_item ->> 'tag', '')));
    if normalized_tag <> '' and left(normalized_tag, 1) <> '#' then normalized_tag := '#' || normalized_tag; end if;
    select id into v_account_id
    from public.user_accounts
    where user_id = p_actor_user_id and player_tag = normalized_tag;
    if v_account_id is null then
      raise exception 'account does not belong to actor' using errcode = '42501';
    end if;
    wants_cwl := coalesce((account_item ->> 'wantsCwl')::boolean, true);
    insert into public.group_poll_account_answers (answer_id, user_account_id, wants_cwl, updated_at)
    values (v_answer_id, v_account_id, wants_cwl, now())
    returning id into v_account_answer_id;
    if wants_cwl then
      for round_number in 1..poll_row.rounds loop
        insert into public.group_poll_day_answers (account_answer_id, round, available, updated_at)
        values (
          v_account_answer_id,
          round_number,
          coalesce((account_item -> 'days' ->> round_number::text)::boolean, false),
          now()
        );
      end loop;
    end if;
  end loop;
  return jsonb_build_object(
    'id', v_answer_id,
    'poll_id', p_poll_id,
    'user_id', p_actor_user_id,
    'updated_at', now(),
    'accounts', p_accounts
  );
end;
$$;

create or replace function public.send_group_poll_reminders(
  p_actor_user_id uuid,
  p_poll_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
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
  select * into poll_row from public.group_polls where id = p_poll_id;
  if not found then raise exception 'poll not found' using errcode = 'P0002'; end if;
  if not exists (
    select 1 from public.group_members
    where group_id = poll_row.group_id
      and user_id = p_actor_user_id
      and role in ('leader', 'co_leader')
  ) and not exists (
    select 1 from public.groups
    where id = poll_row.group_id and owner_id = p_actor_user_id
  ) then
    raise exception 'admin role required' using errcode = '42501';
  end if;

  for member_row in
    select member.user_id
    from public.group_members member
    where member.group_id = poll_row.group_id
      and member.user_id <> p_actor_user_id
  loop
    if exists (
      select 1 from public.group_poll_answers answer
      where answer.poll_id = p_poll_id and answer.user_id = member_row.user_id
    ) then
      answered_count := answered_count + 1;
    elsif exists (
      select 1 from public.poll_reminder_deliveries delivery
      where delivery.poll_id = p_poll_id
        and delivery.recipient_id = member_row.user_id
        and delivery.sent_at >= now() - interval '6 hours'
    ) then
      skipped_count := skipped_count + 1;
    else
      insert into public.notifications (
        recipient_id, sender_id, type, title, body, payload,
        related_group_id, related_poll_id
      )
      values (
        member_row.user_id,
        p_actor_user_id,
        'poll_reminder',
        poll_row.title,
        'Vul je CWL-beschikbaarheid in.',
        jsonb_build_object('groupId', poll_row.group_id, 'pollId', poll_row.id),
        poll_row.group_id,
        poll_row.id
      )
      returning id into notification_id;
      insert into public.poll_reminder_deliveries (
        poll_id, recipient_id, sender_id, notification_id
      )
      values (p_poll_id, member_row.user_id, p_actor_user_id, notification_id);
      created_count := created_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'created', created_count,
    'skipped', skipped_count,
    'answered', answered_count
  );
end;
$$;

revoke all on function public.submit_group_poll_answer(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.send_group_poll_reminders(uuid, uuid) from public, anon, authenticated;
grant execute on function public.submit_group_poll_answer(uuid, uuid, jsonb) to service_role;
grant execute on function public.send_group_poll_reminders(uuid, uuid) to service_role;

drop policy if exists poll_day_answers_allowed_read on public.group_poll_day_answers;
create policy poll_day_answers_allowed_read on public.group_poll_day_answers for select to authenticated
  using (
    exists (
      select 1
      from public.group_poll_account_answers account_answer
      join public.group_poll_answers answer on answer.id = account_answer.answer_id
      join public.group_polls poll on poll.id = answer.poll_id
      where account_answer.id = group_poll_day_answers.account_answer_id
        and (
          answer.user_id = public.current_app_user_id()
          or public.can_manage_group(poll.group_id)
        )
    )
  );

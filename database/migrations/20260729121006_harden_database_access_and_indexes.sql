-- Forward-only production hardening generated with the Supabase CLI.
-- Apply to staging first, then rerun the Supabase security and performance advisors.

begin;

-- Trigger-only functions are not part of the browser-callable API surface.
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;

-- These read-only identity helpers are required by authenticated RLS policies.
-- Anonymous callers do not need direct execute access.
revoke all on function public.current_app_user_id() from public, anon, authenticated;
grant execute on function public.current_app_user_id() to authenticated;

revoke all on function public.is_group_member(uuid) from public, anon, authenticated;
grant execute on function public.is_group_member(uuid) to authenticated;

revoke all on function public.can_manage_group(uuid) from public, anon, authenticated;
grant execute on function public.can_manage_group(uuid) to authenticated;

-- Reminder delivery rows are written by service-role RPCs and are not a direct client API.
revoke all privileges on table public.poll_reminder_deliveries from anon, authenticated;

-- Index every foreign-key direction flagged by the live Supabase performance advisor.
create index if not exists group_clans_added_by_idx
  on public.group_clans (added_by);
create index if not exists group_poll_account_answers_user_account_id_idx
  on public.group_poll_account_answers (user_account_id);
create index if not exists group_poll_answers_user_id_idx
  on public.group_poll_answers (user_id);
create index if not exists group_polls_creator_id_idx
  on public.group_polls (creator_id);
create index if not exists groups_owner_id_idx
  on public.groups (owner_id);
create index if not exists notifications_related_group_id_idx
  on public.notifications (related_group_id);
create index if not exists notifications_related_poll_id_idx
  on public.notifications (related_poll_id);
create index if not exists notifications_sender_id_idx
  on public.notifications (sender_id);
create index if not exists plan_users_plan_id_idx
  on public.plan_users (plan_id);
create index if not exists poll_reminder_deliveries_notification_id_idx
  on public.poll_reminder_deliveries (notification_id);
create index if not exists poll_reminder_deliveries_recipient_id_idx
  on public.poll_reminder_deliveries (recipient_id);
create index if not exists poll_reminder_deliveries_sender_id_idx
  on public.poll_reminder_deliveries (sender_id);

commit;

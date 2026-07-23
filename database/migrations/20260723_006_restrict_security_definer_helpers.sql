-- Restrict helper functions used by RLS to the role that needs them.
-- This migration is forward-only and must be reviewed before it is applied.

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

revoke all on function public.current_app_user_id() from public, anon, authenticated;
grant execute on function public.current_app_user_id() to authenticated;

revoke all on function public.is_group_member(uuid) from public, anon, authenticated;
grant execute on function public.is_group_member(uuid) to authenticated;

revoke all on function public.can_manage_group(uuid) from public, anon, authenticated;
grant execute on function public.can_manage_group(uuid) to authenticated;

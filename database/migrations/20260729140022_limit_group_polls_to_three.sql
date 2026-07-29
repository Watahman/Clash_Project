create or replace function public.enforce_group_poll_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.group_id::text, 0));

  if (
    select count(*)
    from public.group_polls
    where group_id = new.group_id
  ) >= 3 then
    raise exception 'POLL_LIMIT_REACHED'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_group_poll_limit()
  from public, anon, authenticated;
grant execute on function public.enforce_group_poll_limit()
  to service_role;

drop trigger if exists group_polls_limit_insert on public.group_polls;
create trigger group_polls_limit_insert
before insert on public.group_polls
for each row
execute function public.enforce_group_poll_limit();

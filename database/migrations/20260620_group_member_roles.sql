alter table public.group_members
add column role text not null default 'member';

alter table public.group_members
add constraint group_members_role_check
check (role in ('member', 'co_leader', 'leader'));

insert into public.group_members (group_id, user_id, role)
select g.id, g.owner_id, 'leader'
from public.groups g
where not exists (
  select 1
  from public.group_members gm
  where gm.group_id = g.id
    and gm.user_id = g.owner_id
);

update public.group_members gm
set role = 'leader'
from public.groups g
where gm.group_id = g.id
  and gm.user_id = g.owner_id;

create unique index group_members_one_leader_per_group_idx
on public.group_members(group_id)
where role = 'leader';

create unique index group_members_group_user_unique_idx
on public.group_members(group_id, user_id);

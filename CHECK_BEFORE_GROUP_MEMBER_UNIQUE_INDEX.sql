select group_id, user_id, count(*)
from public.group_members
group by group_id, user_id
having count(*) > 1;

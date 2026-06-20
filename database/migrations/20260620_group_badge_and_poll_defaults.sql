alter table public.groups
add column if not exists badge text not null default 'shield';

alter table public.groups
add column if not exists badge_url text;

alter table public.groups
alter column polls set default '[]'::jsonb;

update public.groups
set polls = '[]'::jsonb
where polls is null;

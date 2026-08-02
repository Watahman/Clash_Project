create table if not exists public.feedback_submissions (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    category text not null check (category in ('bug', 'feature', 'account', 'privacy', 'other')),
    page_path text not null default '',
    description text not null,
    contact_email text not null default '',
    screenshot_data text,
    status text not null default 'new' check (status in ('new', 'reviewed', 'resolved', 'spam'))
);

create index if not exists feedback_submissions_created_at_idx
    on public.feedback_submissions (created_at desc);

alter table public.feedback_submissions enable row level security;

revoke all on table public.feedback_submissions from anon, authenticated;
grant select, insert, update on table public.feedback_submissions to service_role;

create table if not exists public.client_error_events (
    id bigint generated always as identity primary key,
    created_at timestamptz not null default now(),
    event_type text not null check (event_type in ('frontend', 'csp')),
    page_path text not null default '',
    message text not null default '',
    details jsonb not null default '{}'::jsonb
);

create index if not exists client_error_events_created_at_idx
    on public.client_error_events (created_at desc);

alter table public.client_error_events enable row level security;

revoke all on table public.client_error_events from anon, authenticated;
grant select, insert, delete on table public.client_error_events to service_role;
grant usage, select on sequence public.client_error_events_id_seq to service_role;

comment on table public.feedback_submissions is 'Private service-role-only feedback inbox. Review and remove screenshot data when no longer needed.';
comment on table public.client_error_events is 'Privacy-minimized frontend and CSP diagnostics. Retain only as long as operationally necessary.';

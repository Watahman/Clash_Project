-- Advanced Stats ranked-season isolation.
--
-- V2 ranked battlelog is explicitly season-scoped.  Legacy rows use an empty
-- season key and remain readable; new V2 rows use the positive Unix-seconds
-- season key supplied by the backend.  This migration never deletes history.

alter table public.advanced_stats_scope_state
    add column if not exists source_season_key text not null default '';

alter table public.advanced_stats_scope_state
    drop constraint if exists advanced_stats_scope_state_source_season_key_check;
alter table public.advanced_stats_scope_state
    add constraint advanced_stats_scope_state_source_season_key_check
    check (source_season_key = '' or source_season_key ~ '^[1-9][0-9]{0,18}$');

update public.advanced_stats_scope_state
   set source_season_key = btrim(source_provenance->>'rankedSeasonKey')
 where scope = 'RANKED'
   and source_season_key = ''
   and btrim(coalesce(source_provenance->>'rankedSeasonKey', '')) ~ '^[1-9][0-9]{0,18}$';

alter table public.advanced_stats_event_receipts
    add column if not exists season_key text not null default '';
alter table public.advanced_stats_scope_unit_daily
    add column if not exists season_key text not null default '';
alter table public.advanced_stats_scope_army_daily
    add column if not exists season_key text not null default '';
alter table public.advanced_stats_scope_daily
    add column if not exists season_key text not null default '';

alter table public.advanced_stats_event_receipts
    drop constraint if exists advanced_stats_event_receipts_season_key_check;
alter table public.advanced_stats_event_receipts
    add constraint advanced_stats_event_receipts_season_key_check
    check (season_key = '' or season_key ~ '^[1-9][0-9]{0,18}$');
alter table public.advanced_stats_scope_unit_daily
    drop constraint if exists advanced_stats_scope_unit_daily_season_key_check;
alter table public.advanced_stats_scope_unit_daily
    add constraint advanced_stats_scope_unit_daily_season_key_check
    check (season_key = '' or season_key ~ '^[1-9][0-9]{0,18}$');
alter table public.advanced_stats_scope_army_daily
    drop constraint if exists advanced_stats_scope_army_daily_season_key_check;
alter table public.advanced_stats_scope_army_daily
    add constraint advanced_stats_scope_army_daily_season_key_check
    check (season_key = '' or season_key ~ '^[1-9][0-9]{0,18}$');
alter table public.advanced_stats_scope_daily
    drop constraint if exists advanced_stats_scope_daily_season_key_check;
alter table public.advanced_stats_scope_daily
    add constraint advanced_stats_scope_daily_season_key_check
    check (season_key = '' or season_key ~ '^[1-9][0-9]{0,18}$');

alter table public.advanced_stats_event_receipts
    drop constraint if exists advanced_stats_event_receipts_pkey;
alter table public.advanced_stats_event_receipts
    add constraint advanced_stats_event_receipts_pkey
    primary key (tracking_id, scope, season_key, event_fingerprint);
alter table public.advanced_stats_scope_unit_daily
    drop constraint if exists advanced_stats_scope_unit_daily_pkey;
alter table public.advanced_stats_scope_unit_daily
    add constraint advanced_stats_scope_unit_daily_pkey
    primary key (tracking_id, scope, season_key, stat_date, category, unit_key);
alter table public.advanced_stats_scope_army_daily
    drop constraint if exists advanced_stats_scope_army_daily_pkey;
alter table public.advanced_stats_scope_army_daily
    add constraint advanced_stats_scope_army_daily_pkey
    primary key (tracking_id, scope, season_key, stat_date, army_hash);
alter table public.advanced_stats_scope_daily
    drop constraint if exists advanced_stats_scope_daily_pkey;
alter table public.advanced_stats_scope_daily
    add constraint advanced_stats_scope_daily_pkey
    primary key (tracking_id, scope, season_key, stat_date);

create index if not exists advanced_stats_scope_state_season_idx
    on public.advanced_stats_scope_state (tracking_id, scope, source_season_key, updated_at desc);
create index if not exists advanced_stats_event_receipts_season_time_idx
    on public.advanced_stats_event_receipts (tracking_id, scope, season_key, event_at desc);
create index if not exists advanced_stats_scope_unit_daily_season_rank_idx
    on public.advanced_stats_scope_unit_daily (tracking_id, scope, season_key, stat_date, category, total_quantity desc);
create index if not exists advanced_stats_scope_army_daily_season_rank_idx
    on public.advanced_stats_scope_army_daily (tracking_id, scope, season_key, stat_date, battle_count desc);
create index if not exists advanced_stats_scope_daily_season_period_idx
    on public.advanced_stats_scope_daily (tracking_id, scope, season_key, stat_date desc);

create or replace function public.normalize_advanced_stats_ranked_season_key_v1(
    p_scope text,
    p_season_key text
) returns text
language plpgsql
immutable
security invoker
set search_path = public, pg_temp
as $$
declare
    v_scope text := upper(btrim(coalesce(p_scope, '')));
    v_key text := btrim(coalesce(p_season_key, ''));
begin
    if v_scope not in ('NORMAL', 'WAR', 'RANKED') then
        raise exception 'Unsupported Advanced Stats scope: %', p_scope;
    end if;
    if v_scope <> 'RANKED' and v_key <> '' then
        raise exception 'A ranked season key is only valid for the RANKED scope';
    end if;
    if v_key <> '' and v_key !~ '^[1-9][0-9]{0,18}$' then
        raise exception 'Advanced Stats ranked season key must be positive Unix seconds';
    end if;
    return v_key;
end;
$$;

create or replace function public.guard_advanced_stats_scope_season_v1()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    v_provenance_key text;
begin
    new.source_season_key := public.normalize_advanced_stats_ranked_season_key_v1(
        new.scope, new.source_season_key);
    v_provenance_key := public.normalize_advanced_stats_ranked_season_key_v1(
        new.scope, new.source_provenance->>'rankedSeasonKey');
    if new.scope = 'RANKED' and new.source_season_key = '' and v_provenance_key <> '' then
        new.source_season_key := v_provenance_key;
    elsif new.scope = 'RANKED'
          and v_provenance_key <> ''
          and v_provenance_key <> new.source_season_key then
        raise exception 'Advanced Stats ranked season changed; rotate the active season first';
    end if;
    return new;
end;
$$;

create or replace function public.assign_advanced_stats_aggregate_season_v1()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    v_state_season text := '';
    v_requested text := btrim(coalesce(new.season_key, ''));
begin
    if new.scope = 'RANKED' then
        select source_season_key into v_state_season
          from public.advanced_stats_scope_state
         where tracking_id = new.tracking_id and scope = new.scope;
        if v_requested = '' then v_requested := coalesce(v_state_season, ''); end if;
        v_requested := public.normalize_advanced_stats_ranked_season_key_v1(new.scope, v_requested);
        if v_state_season is not null and v_state_season <> ''
           and v_requested <> v_state_season then
            raise exception 'Advanced Stats ranked aggregate season does not match active state';
        end if;
        if v_state_season is null or v_state_season = '' then
            if v_requested <> '' then
                raise exception 'Advanced Stats ranked season must be activated before aggregate writes';
            end if;
        end if;
        new.season_key := v_requested;
    else
        new.season_key := public.normalize_advanced_stats_ranked_season_key_v1(new.scope, '');
    end if;
    return new;
end;
$$;

drop trigger if exists advanced_stats_scope_state_season_guard on public.advanced_stats_scope_state;
create trigger advanced_stats_scope_state_season_guard
before insert or update of scope, source_season_key, source_provenance
on public.advanced_stats_scope_state
for each row execute function public.guard_advanced_stats_scope_season_v1();

drop trigger if exists advanced_stats_event_receipts_season_assign on public.advanced_stats_event_receipts;
create trigger advanced_stats_event_receipts_season_assign
before insert on public.advanced_stats_event_receipts
for each row execute function public.assign_advanced_stats_aggregate_season_v1();
drop trigger if exists advanced_stats_scope_unit_daily_season_assign on public.advanced_stats_scope_unit_daily;
create trigger advanced_stats_scope_unit_daily_season_assign
before insert on public.advanced_stats_scope_unit_daily
for each row execute function public.assign_advanced_stats_aggregate_season_v1();
drop trigger if exists advanced_stats_scope_army_daily_season_assign on public.advanced_stats_scope_army_daily;
create trigger advanced_stats_scope_army_daily_season_assign
before insert on public.advanced_stats_scope_army_daily
for each row execute function public.assign_advanced_stats_aggregate_season_v1();
drop trigger if exists advanced_stats_scope_daily_season_assign on public.advanced_stats_scope_daily;
create trigger advanced_stats_scope_daily_season_assign
before insert on public.advanced_stats_scope_daily
for each row execute function public.assign_advanced_stats_aggregate_season_v1();

revoke all on function public.normalize_advanced_stats_ranked_season_key_v1(text,text)
    from public, anon, authenticated;
grant execute on function public.normalize_advanced_stats_ranked_season_key_v1(text,text) to service_role;
revoke all on function public.guard_advanced_stats_scope_season_v1()
    from public, anon, authenticated;
grant execute on function public.guard_advanced_stats_scope_season_v1() to service_role;
revoke all on function public.assign_advanced_stats_aggregate_season_v1()
    from public, anon, authenticated;
grant execute on function public.assign_advanced_stats_aggregate_season_v1() to service_role;

-- Shared clan achievement state. Clan achievements belong to the clan tag
-- itself and never enter the personal achievement_progress XP ledger.

create table if not exists public.clan_achievement_progress (
    clan_tag text not null check (clan_tag ~ '^#[0289PYLQGRJCUV]{3,15}$'),
    achievement_key text not null,
    family_key text not null,
    title text not null,
    description text not null,
    category text not null,
    rarity text not null check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic')),
    tier smallint not null check (tier between 1 and 10),
    metric text not null,
    progress bigint not null default 0 check (progress >= 0),
    target bigint not null check (target > 0),
    unlocked boolean not null default false,
    unlocked_at timestamptz,
    evidence_timestamp bigint not null,
    evidence_source text not null,
    updated_at timestamptz not null default now(),
    primary key (clan_tag, achievement_key, tier)
);

create index if not exists clan_achievement_progress_family_idx
    on public.clan_achievement_progress (clan_tag, category, family_key, tier);

alter table public.clan_achievement_progress enable row level security;
revoke all on table public.clan_achievement_progress from public, anon, authenticated;
grant select, insert, update, delete on table public.clan_achievement_progress to service_role;

drop function if exists public.reconcile_clan_achievement_progress_v1(text, bigint, text, jsonb);
create function public.reconcile_clan_achievement_progress_v1(
    p_clan_tag text,
    p_evidence_timestamp bigint,
    p_evidence_source text,
    p_progress jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_item jsonb;
    v_saved integer := 0;
    v_new_unlocks integer := 0;
    v_was_unlocked boolean;
    v_previous_timestamp bigint;
begin
    if p_clan_tag is null
       or p_clan_tag !~ '^#[0289PYLQGRJCUV]{3,15}$'
       or p_evidence_timestamp is null
       or p_evidence_timestamp <= 0
       or nullif(btrim(p_evidence_source), '') is null then
        raise exception 'Invalid clan achievement evidence';
    end if;

    for v_item in
        -- Every caller acquires per-badge locks in the same order. This avoids
        -- A->B / B->A deadlocks when batches contain multiple clan badges.
        select item.value
          from jsonb_array_elements(coalesce(p_progress, '[]'::jsonb)) as item(value)
         order by item.value->>'achievement_key',
                  coalesce((item.value->>'tier')::smallint, 0),
                  item.value->>'scope'
    loop
        if coalesce(v_item->>'scope', '') <> 'clan' then
            continue;
        end if;

        -- Serialize the read/transition/write sequence for this exact shared
        -- badge. Without this lock, two first-unlock requests could both read
        -- false and both report newUnlocks=1 before their upserts converge.
        perform pg_advisory_xact_lock(hashtextextended(
            p_clan_tag || E'\x1f' || (v_item->>'achievement_key') || E'\x1f' || (v_item->>'tier'),
            0
        ));

        v_was_unlocked := null;
        v_previous_timestamp := null;
        select unlocked, evidence_timestamp into v_was_unlocked, v_previous_timestamp
          from public.clan_achievement_progress
         where clan_tag = p_clan_tag
           and achievement_key = v_item->>'achievement_key'
           and tier = (v_item->>'tier')::smallint;

        if v_previous_timestamp is not null and v_previous_timestamp > p_evidence_timestamp then
            continue;
        end if;

        if not coalesce(v_was_unlocked, false)
           and coalesce((v_item->>'unlocked')::boolean, false) then
            v_new_unlocks := v_new_unlocks + 1;
        end if;

        insert into public.clan_achievement_progress (
            clan_tag, achievement_key, family_key, title, description,
            category, rarity, tier, metric, progress, target, unlocked,
            unlocked_at, evidence_timestamp, evidence_source, updated_at
        ) values (
            p_clan_tag, v_item->>'achievement_key', v_item->>'family_key',
            v_item->>'title', v_item->>'description', v_item->>'category',
            v_item->>'rarity', (v_item->>'tier')::smallint, v_item->>'metric',
            greatest(coalesce((v_item->>'progress')::bigint, 0), 0),
            (v_item->>'target')::bigint,
            coalesce((v_item->>'unlocked')::boolean, false),
            case when coalesce((v_item->>'unlocked')::boolean, false) then now() else null end,
            p_evidence_timestamp, btrim(p_evidence_source), now()
        )
        on conflict (clan_tag, achievement_key, tier) do update
            set family_key = excluded.family_key,
                title = excluded.title,
                description = excluded.description,
                category = excluded.category,
                rarity = excluded.rarity,
                metric = excluded.metric,
                progress = greatest(public.clan_achievement_progress.progress, excluded.progress),
                target = excluded.target,
                unlocked = public.clan_achievement_progress.unlocked or excluded.unlocked,
                unlocked_at = case
                    when public.clan_achievement_progress.unlocked_at is not null
                        then public.clan_achievement_progress.unlocked_at
                    when excluded.unlocked then now()
                    else null
                end,
                evidence_timestamp = greatest(public.clan_achievement_progress.evidence_timestamp, excluded.evidence_timestamp),
                evidence_source = case
                    when excluded.evidence_timestamp >= public.clan_achievement_progress.evidence_timestamp
                        then excluded.evidence_source
                    else public.clan_achievement_progress.evidence_source
                end,
                updated_at = now();
        v_saved := v_saved + 1;
    end loop;

    return jsonb_build_object('clanTag', p_clan_tag, 'saved', v_saved, 'newUnlocks', v_new_unlocks);
end;
$$;

revoke all on function public.reconcile_clan_achievement_progress_v1(text, bigint, text, jsonb)
    from public, anon, authenticated;
grant execute on function public.reconcile_clan_achievement_progress_v1(text, bigint, text, jsonb)
    to service_role;

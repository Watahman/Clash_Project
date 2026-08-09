-- Rollback-only smoke test for duplicate clan-unlock reconciliation.
-- This verifies the state transition seen after requests have been serialized:
-- the first call reports one new unlock and a duplicate call reports none.
-- Concurrency safety itself is enforced and contract-tested structurally by
-- deterministic batch ordering plus the per-badge advisory transaction lock.
begin;

do $$
declare
    v_tag constant text := '#P0Y8LQ2';
    v_progress jsonb := jsonb_build_array(jsonb_build_object(
        'scope', 'clan',
        'achievement_key', 'CL_SMOKE_1',
        'family_key', 'CL_SMOKE',
        'title', 'Clan duplicate smoke',
        'description', 'Rollback-only verification',
        'category', 'clan',
        'rarity', 'common',
        'tier', 1,
        'metric', 'clan_level',
        'progress', 2,
        'target', 2,
        'unlocked', true
    ));
    v_first jsonb;
    v_duplicate jsonb;
    v_rows integer;
begin
    delete from public.clan_achievement_progress
     where clan_tag = v_tag and achievement_key = 'CL_SMOKE_1';

    v_first := public.reconcile_clan_achievement_progress_v1(
        v_tag, 1786291200, 'transactional_duplicate_smoke', v_progress
    );
    v_duplicate := public.reconcile_clan_achievement_progress_v1(
        v_tag, 1786291200, 'transactional_duplicate_smoke', v_progress
    );

    if (v_first->>'newUnlocks')::integer <> 1
       or (v_duplicate->>'newUnlocks')::integer <> 0 then
        raise exception 'Duplicate unlock transition was counted more than once: first=%, duplicate=%',
            v_first, v_duplicate;
    end if;

    select count(*) into v_rows
      from public.clan_achievement_progress
     where clan_tag = v_tag
       and achievement_key = 'CL_SMOKE_1'
       and unlocked;
    if v_rows <> 1 then
        raise exception 'Expected one monotone shared unlock row, found %', v_rows;
    end if;
end;
$$;

rollback;

select jsonb_build_object(
    'status', 'passed',
    'rollbackOnly', true,
    'contract', 'duplicate request after serialization does not recount the unlock'
) as clan_achievement_duplicate_smoke_test;

-- Transactional cursor tie-break verification for battles sharing the same timestamp.
-- Creates only synthetic rows and rolls all writes back.

begin;

do $$
declare
    v_user uuid := gen_random_uuid();
    v_tracking uuid;
    v_at timestamptz := date_trunc('second', now()) - interval '1 hour';
    v_page1 jsonb;
    v_page2 jsonb;
    v_cursor_at timestamptz;
    v_cursor_id uuid;
    v_ids text[];
    i integer;
begin
    insert into public.users (id, name, email, accounts, code)
    values (
        v_user,
        'Advanced Stats cursor smoke test',
        'advanced-stats-cursor-' || v_user || '@example.invalid',
        '[]'::jsonb,
        'ASQ' || replace(v_user::text, '-', '')
    );
    insert into public.advanced_stats_tracking(user_id, player_tag, status)
    values (v_user, '#P0Y2', 'ACTIVE') returning id into v_tracking;

    for i in 1..3 loop
        perform public.save_advanced_stats_battle_v3(
            v_tracking, '#P0Y2'::text, repeat(i::text,64), v_at, v_at,
            'multiplayer'::text, '#Q8G2'::text, ('Same Time ' || i)::text,
            17, 17, i::smallint, (20*i)::numeric, null::text, false,
            i::bigint, i::bigint, i::bigint, i::bigint, i::bigint, i::bigint,
            false, 1, '[]'::jsonb, null::text, null::jsonb
        );
    end loop;

    v_page1 := public.read_advanced_stats_battles_v1(v_tracking, null, 2, null, null);
    if jsonb_array_length(v_page1->'items') <> 2
       or (v_page1->>'hasMore')::boolean is not true then
        raise exception 'Same-time page 1 shape invalid: %', v_page1;
    end if;

    v_cursor_at := (v_page1->>'nextCursorAt')::timestamptz;
    v_cursor_id := (v_page1->>'nextCursorId')::uuid;
    v_page2 := public.read_advanced_stats_battles_v1(
        v_tracking, null, 2, v_cursor_at, v_cursor_id
    );
    if jsonb_array_length(v_page2->'items') <> 1
       or (v_page2->>'hasMore')::boolean is not false then
        raise exception 'Same-time page 2 shape invalid: %', v_page2;
    end if;

    select array_agg(id order by id) into v_ids
    from (
        select x->>'id' as id from jsonb_array_elements(v_page1->'items') x
        union all
        select x->>'id' as id from jsonb_array_elements(v_page2->'items') x
    ) q;

    if cardinality(v_ids) <> 3
       or (select count(distinct x) from unnest(v_ids) x) <> 3 then
        raise exception 'Same-time pagination duplicated or skipped an id: %', v_ids;
    end if;
end $$;

rollback;

select jsonb_build_object(
    'status', 'PASS',
    'persistence', 'ROLLBACK',
    'verified', jsonb_build_array('same-timestamp UUID cursor tie-break')
) as advanced_stats_cursor_smoke_test;

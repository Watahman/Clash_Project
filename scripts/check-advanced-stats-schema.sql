-- Read-only production/staging verification for compact Advanced Stats.
-- Raises an exception on schema, RLS, privilege, RPC or migration drift.

do $$
declare
    v_table text;
    v_function text;
    v_migration text;
    v_rls boolean;
    v_proc regprocedure;
    v_required_tables text[] := array[
        'advanced_stats_tracking', 'advanced_stats_army_dictionary',
        'advanced_stats_scope_state', 'advanced_stats_event_receipts',
        'advanced_stats_scope_unit_daily', 'advanced_stats_scope_army_daily',
        'advanced_stats_scope_daily'
    ];
    v_required_functions text[] := array[
        'public.claim_advanced_stats_trackers_v1(text,timestamptz,integer,integer)',
        'public.complete_advanced_stats_poll_v1(uuid,text,timestamptz,timestamptz,boolean)',
        'public.fail_advanced_stats_poll_v1(uuid,text,timestamptz,timestamptz,text,integer)',
        'public.delete_advanced_stats_tracking_v1(uuid,text)',
        'public.save_advanced_stats_compact_event_v1(uuid,text,text,text,timestamptz,timestamptz,smallint,numeric,bigint,bigint,bigint,jsonb,text,jsonb,text,timestamptz,text,text,timestamptz,text,jsonb,boolean,text)',
        'public.save_advanced_stats_compact_event_v2(uuid,text,text,text,timestamptz,timestamptz,smallint,numeric,bigint,bigint,bigint,jsonb,text,jsonb,text,timestamptz,text,text,timestamptz,text,jsonb,boolean,text,text)',
        'public.save_advanced_stats_compact_event_v3(uuid,text,text,text,timestamptz,timestamptz,smallint,numeric,boolean,bigint,bigint,bigint,jsonb,text,jsonb,text,timestamptz,text,text,timestamptz,text,jsonb,boolean,text,text)',
        'public.update_advanced_stats_scope_poll_v1(uuid,text,text,text,timestamptz,boolean,text,timestamptz,text,text,timestamptz,text,jsonb,text,text)',
        'public.update_advanced_stats_scope_poll_v2(uuid,text,text,text,timestamptz,boolean,text,timestamptz,text,text,timestamptz,text,jsonb,text,text,text)',
        'public.update_advanced_stats_bootstrap_v1(uuid,text,text,text,text,smallint,bigint,bigint,text,text,timestamptz)',
        'public.record_advanced_stats_scope_capability_v1(uuid,text,text,text,text,text,text,text,jsonb,timestamptz)',
        'public.initialize_advanced_stats_scope_state_v1()',
        'public.normalize_advanced_stats_ranked_season_key_v1(text,text)',
        'public.guard_advanced_stats_scope_season_v1()',
        'public.assign_advanced_stats_aggregate_season_v1()',
        'public.switch_advanced_stats_ranked_season_v1(uuid,text,text,text,text,timestamptz)',
        'public.prepare_advanced_stats_ranked_season_v1(uuid,text,text,text,timestamptz)',
        'public.save_advanced_stats_compact_page_v1(uuid,text,text,jsonb,timestamptz,text,timestamptz,text,text,timestamptz,text,jsonb,boolean,boolean,text)',
        'public.read_advanced_stats_compact_overview_v1(uuid,text,timestamptz)',
        'public.read_advanced_stats_compact_units_v1(uuid,text,timestamptz,text)',
        'public.read_advanced_stats_compact_armies_v1(uuid,text,timestamptz,integer)',
        'public.read_advanced_stats_compact_trends_v1(uuid,text,timestamptz)',
        'public.read_advanced_stats_compact_overview_v2(uuid,text,timestamptz,text)',
        'public.read_advanced_stats_compact_units_v2(uuid,text,timestamptz,text,text)',
        'public.read_advanced_stats_compact_armies_v2(uuid,text,timestamptz,integer,text)',
        'public.read_advanced_stats_compact_trends_v2(uuid,text,timestamptz,text)'
    ];
    v_invoker_functions text[] := array[
        'public.save_advanced_stats_compact_event_v1(uuid,text,text,text,timestamptz,timestamptz,smallint,numeric,bigint,bigint,bigint,jsonb,text,jsonb,text,timestamptz,text,text,timestamptz,text,jsonb,boolean,text)',
        'public.save_advanced_stats_compact_event_v2(uuid,text,text,text,timestamptz,timestamptz,smallint,numeric,bigint,bigint,bigint,jsonb,text,jsonb,text,timestamptz,text,text,timestamptz,text,jsonb,boolean,text,text)',
        'public.save_advanced_stats_compact_event_v3(uuid,text,text,text,timestamptz,timestamptz,smallint,numeric,boolean,bigint,bigint,bigint,jsonb,text,jsonb,text,timestamptz,text,text,timestamptz,text,jsonb,boolean,text,text)',
        'public.update_advanced_stats_scope_poll_v1(uuid,text,text,text,timestamptz,boolean,text,timestamptz,text,text,timestamptz,text,jsonb,text,text)',
        'public.update_advanced_stats_scope_poll_v2(uuid,text,text,text,timestamptz,boolean,text,timestamptz,text,text,timestamptz,text,jsonb,text,text,text)',
        'public.update_advanced_stats_bootstrap_v1(uuid,text,text,text,text,smallint,bigint,bigint,text,text,timestamptz)',
        'public.record_advanced_stats_scope_capability_v1(uuid,text,text,text,text,text,text,text,jsonb,timestamptz)',
        'public.initialize_advanced_stats_scope_state_v1()',
        'public.normalize_advanced_stats_ranked_season_key_v1(text,text)',
        'public.guard_advanced_stats_scope_season_v1()',
        'public.assign_advanced_stats_aggregate_season_v1()',
        'public.prepare_advanced_stats_ranked_season_v1(uuid,text,text,text,timestamptz)',
        'public.save_advanced_stats_compact_page_v1(uuid,text,text,jsonb,timestamptz,text,timestamptz,text,text,timestamptz,text,jsonb,boolean,boolean,text)',
        'public.read_advanced_stats_compact_overview_v1(uuid,text,timestamptz)',
        'public.read_advanced_stats_compact_units_v1(uuid,text,timestamptz,text)',
        'public.read_advanced_stats_compact_armies_v1(uuid,text,timestamptz,integer)',
        'public.read_advanced_stats_compact_trends_v1(uuid,text,timestamptz)',
        'public.read_advanced_stats_compact_overview_v2(uuid,text,timestamptz,text)',
        'public.read_advanced_stats_compact_units_v2(uuid,text,timestamptz,text,text)',
        'public.read_advanced_stats_compact_armies_v2(uuid,text,timestamptz,integer,text)',
        'public.read_advanced_stats_compact_trends_v2(uuid,text,timestamptz,text)'
    ];
    v_required_migrations text[] := array[
        'advanced_stats_compact_source_of_truth', 'advanced_stats_compact_backfill',
        'advanced_stats_compact_rpc_contract', 'advanced_stats_compact_reads',
        'advanced_stats_compact_bootstrap', 'advanced_stats_compact_capabilities',
        'advanced_stats_ranked_season_schema', 'advanced_stats_ranked_season_switch',
        'advanced_stats_ranked_season_v1_compat', 'advanced_stats_ranked_season_write_contract',
        'advanced_stats_ranked_season_overview_read', 'advanced_stats_ranked_season_units_read',
        'advanced_stats_ranked_season_armies_read', 'advanced_stats_ranked_season_trends_read',
        'advanced_stats_batched_collection',
        'advanced_stats_loot_and_army_compaction_foundation',
        'advanced_stats_loot_and_army_compaction_writes',
        'advanced_stats_loot_and_army_compaction_reads',
        'advanced_stats_army_dictionary_fk_index'
    ];
begin
    if has_schema_privilege('anon', 'public', 'CREATE')
       or has_schema_privilege('authenticated', 'public', 'CREATE') then
        raise exception 'A browser role can create objects in schema public';
    end if;

    foreach v_table in array v_required_tables loop
        if to_regclass(format('public.%I', v_table)) is null then
            raise exception 'Missing required table public.%', v_table;
        end if;
        select c.relrowsecurity into v_rls
          from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname = v_table and c.relkind = 'r';
        if coalesce(v_rls, false) is not true then
            raise exception 'RLS is not enabled on public.%', v_table;
        end if;
        if has_table_privilege('anon', format('public.%I', v_table), 'SELECT')
           or has_table_privilege('anon', format('public.%I', v_table), 'INSERT')
           or has_table_privilege('anon', format('public.%I', v_table), 'UPDATE')
           or has_table_privilege('anon', format('public.%I', v_table), 'DELETE')
           or has_table_privilege('authenticated', format('public.%I', v_table), 'SELECT')
           or has_table_privilege('authenticated', format('public.%I', v_table), 'INSERT')
           or has_table_privilege('authenticated', format('public.%I', v_table), 'UPDATE')
           or has_table_privilege('authenticated', format('public.%I', v_table), 'DELETE') then
            raise exception 'A browser role has direct table privileges on public.%', v_table;
        end if;
        if not has_table_privilege('service_role', format('public.%I', v_table), 'SELECT')
           or not has_table_privilege('service_role', format('public.%I', v_table), 'INSERT')
           or not has_table_privilege('service_role', format('public.%I', v_table), 'UPDATE')
           or not has_table_privilege('service_role', format('public.%I', v_table), 'DELETE') then
            raise exception 'service_role is missing CRUD privileges on public.%', v_table;
        end if;
    end loop;

    if not exists (
        select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'advanced_stats_scope_daily'
           and column_name = 'loot_known_attacks'
    ) or not exists (
        select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'advanced_stats_scope_daily'
           and column_name in (
               'reliable_gold_looted', 'reliable_elixir_looted', 'reliable_dark_elixir_looted',
               'best_gold_looted', 'best_elixir_looted', 'best_dark_elixir_looted'
           )
         group by table_name having count(*) = 6
    ) then
        raise exception 'Compact loot rollup columns are incomplete';
    end if;
    if not exists (
        select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'advanced_stats_event_receipts'
           and column_name in ('loot_available', 'loot_gold', 'loot_elixir',
                               'loot_dark_elixir', 'loot_totals_applied',
                               'loot_enrichment_eligible')
         group by table_name having count(*) = 6
    ) then
        raise exception 'Compact receipt loot-enrichment columns are incomplete';
    end if;
    if exists (
        select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'advanced_stats_scope_army_daily'
           and column_name = 'normalized_army_json'
    ) then
        raise exception 'Daily army rows still duplicate normalized army JSON';
    end if;
    if not exists (
        select 1 from pg_constraint
         where conrelid = 'public.advanced_stats_scope_army_daily'::regclass
           and conname = 'advanced_stats_scope_army_daily_army_dictionary_fkey'
    ) then
        raise exception 'Daily army rows are missing the dictionary foreign key';
    end if;
    if to_regclass('public.advanced_stats_scope_army_daily_army_hash_idx') is null then
        raise exception 'Daily army rows are missing the dictionary foreign-key index';
    end if;

    foreach v_function in array v_required_functions loop
        v_proc := to_regprocedure(v_function);
        if v_proc is null then raise exception 'Missing required RPC %', v_function; end if;
        if has_function_privilege('anon', v_proc, 'EXECUTE')
           or has_function_privilege('authenticated', v_proc, 'EXECUTE') then
            raise exception 'A browser role can execute backend-only RPC %', v_function;
        end if;
        if not has_function_privilege('service_role', v_proc, 'EXECUTE') then
            raise exception 'service_role cannot execute required RPC %', v_function;
        end if;
    end loop;

    foreach v_function in array v_invoker_functions loop
        select p.prosecdef into v_rls from pg_proc p where p.oid = to_regprocedure(v_function);
        if coalesce(v_rls, false) then
            raise exception 'Compact Advanced Stats RPC must remain SECURITY INVOKER: %', v_function;
        end if;
    end loop;

    foreach v_migration in array v_required_migrations loop
        if not exists (select 1 from supabase_migrations.schema_migrations where name = v_migration) then
            raise exception 'Supabase migration history is missing %', v_migration;
        end if;
    end loop;
end $$;

select jsonb_build_object(
    'status', 'PASS', 'tablesChecked', 7, 'functionsChecked', 26,
    'migrationsChecked', 19, 'browserSchemaCreate', 'DENIED',
    'browserTableAccess', 'DENIED', 'browserRpcExecute', 'DENIED',
    'serviceRoleAccess', 'REQUIRED'
) as advanced_stats_schema_verification;

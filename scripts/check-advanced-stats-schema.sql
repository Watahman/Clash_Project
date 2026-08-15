-- Read-only production/staging verification for Advanced Stats + Advanced Achievements.
-- Raises an exception on schema, RLS, privilege, RPC or migration drift.
-- Safe to run repeatedly.

do $$
declare
    v_table text;
    v_function text;
    v_migration text;
    v_rls boolean;
    v_proc regprocedure;
    v_required_tables text[] := array[
        'achievement_base_snapshots',
        'achievement_progress',
        'advanced_stats_tracking',
        'advanced_stats_battles',
        'advanced_stats_battle_units',
        'advanced_stats_unit_totals',
        'advanced_stats_army_totals',
        'advanced_stats_daily',
        'advanced_stats_tracking_gaps',
        'advanced_stats_scope_state',
        'advanced_stats_event_receipts',
        'advanced_stats_scope_unit_daily',
        'advanced_stats_scope_army_daily',
        'advanced_stats_scope_daily'
    ];
    v_required_functions text[] := array[
        'public.save_achievement_import(uuid,text,bigint,text,jsonb,jsonb,jsonb)',
        'public.save_advanced_stats_battle_v1(uuid,text,text,timestamptz,timestamptz,text,text,text,integer,integer,smallint,numeric,text,boolean,bigint,bigint,bigint,boolean,integer,jsonb,text,jsonb)',
        'public.save_advanced_stats_battle_v2(uuid,text,text,timestamptz,timestamptz,text,text,text,integer,integer,smallint,numeric,text,boolean,bigint,bigint,bigint,bigint,bigint,bigint,boolean,integer,jsonb,text,jsonb)',
        'public.save_advanced_stats_battle_v3(uuid,text,text,timestamptz,timestamptz,text,text,text,integer,integer,smallint,numeric,text,boolean,bigint,bigint,bigint,bigint,bigint,bigint,boolean,integer,jsonb,text,jsonb)',
        'public.save_advanced_stats_battle_v4(uuid,text,text,timestamptz,timestamptz,text,text,text,integer,integer,smallint,numeric,text,boolean,bigint,bigint,bigint,bigint,bigint,bigint,boolean,integer,jsonb,text,jsonb,text)',
        'public.record_advanced_stats_parser_error_v1(uuid,text,text,timestamptz,timestamptz,text,text,text,integer,integer,smallint,numeric,text,bigint,bigint,bigint,boolean,integer)',
        'public.record_advanced_stats_parser_error_v2(uuid,text,text,timestamptz,timestamptz,text,text,text,integer,integer,smallint,numeric,text,bigint,bigint,bigint,bigint,bigint,bigint,boolean,integer)',
        'public.record_advanced_stats_parser_error_v3(uuid,text,text,timestamptz,timestamptz,text,text,text,integer,integer,smallint,numeric,text,bigint,bigint,bigint,bigint,bigint,bigint,boolean,integer,text)',
        'public.claim_advanced_stats_trackers_v1(text,timestamptz,integer,integer)',
        'public.complete_advanced_stats_poll_v1(uuid,text,timestamptz,timestamptz,boolean)',
        'public.fail_advanced_stats_poll_v1(uuid,text,timestamptz,timestamptz,text,integer)',
        'public.read_advanced_stats_overview_v1(uuid,timestamptz)',
        'public.read_advanced_stats_units_v1(uuid,timestamptz,text)',
        'public.read_advanced_stats_armies_v1(uuid,timestamptz,integer)',
        'public.read_advanced_stats_battles_v1(uuid,timestamptz,integer,timestamptz,uuid)',
        'public.read_advanced_stats_trends_v1(uuid,timestamptz)',
        'public.read_advanced_stats_achievement_metrics_v1(uuid)',
        'public.reconcile_advanced_stats_achievement_progress_v1(uuid,text,bigint,jsonb)',
        'public.delete_advanced_stats_tracking_v1(uuid,text)',
        'public.save_advanced_stats_compact_event_v1(uuid,text,text,text,timestamptz,timestamptz,smallint,numeric,bigint,bigint,bigint,jsonb,text,jsonb,text,timestamptz,text,text,timestamptz,text,jsonb,boolean,text)',
        'public.update_advanced_stats_scope_poll_v1(uuid,text,text,text,timestamptz,boolean,text,timestamptz,text,text,timestamptz,text,jsonb,text,text)',
        'public.update_advanced_stats_bootstrap_v1(uuid,text,text,text,text,smallint,bigint,bigint,text,text,timestamptz)',
        'public.read_advanced_stats_compact_overview_v1(uuid,text,timestamptz)',
        'public.read_advanced_stats_compact_units_v1(uuid,text,timestamptz,text)',
        'public.read_advanced_stats_compact_armies_v1(uuid,text,timestamptz,integer)',
        'public.read_advanced_stats_compact_trends_v1(uuid,text,timestamptz)',
        'public.record_advanced_stats_scope_capability_v1(uuid,text,text,text,text,text,text,text,jsonb,timestamptz)',
        'public.initialize_advanced_stats_scope_state_v1()',
        'public.normalize_advanced_stats_ranked_season_key_v1(text,text)',
        'public.guard_advanced_stats_scope_season_v1()',
        'public.assign_advanced_stats_aggregate_season_v1()',
        'public.switch_advanced_stats_ranked_season_v1(uuid,text,text,text,text,timestamptz)',
        'public.prepare_advanced_stats_ranked_season_v1(uuid,text,text,text,timestamptz)',
        'public.save_advanced_stats_compact_event_v2(uuid,text,text,text,timestamptz,timestamptz,smallint,numeric,bigint,bigint,bigint,jsonb,text,jsonb,text,timestamptz,text,text,timestamptz,text,jsonb,boolean,text,text)',
        'public.update_advanced_stats_scope_poll_v2(uuid,text,text,text,timestamptz,boolean,text,timestamptz,text,text,timestamptz,text,jsonb,text,text,text)',
        'public.read_advanced_stats_compact_overview_v2(uuid,text,timestamptz,text)',
        'public.read_advanced_stats_compact_units_v2(uuid,text,timestamptz,text,text)',
        'public.read_advanced_stats_compact_armies_v2(uuid,text,timestamptz,integer,text)',
        'public.read_advanced_stats_compact_trends_v2(uuid,text,timestamptz,text)'
    ];
    v_invoker_functions text[] := array[
        'public.save_advanced_stats_compact_event_v1(uuid,text,text,text,timestamptz,timestamptz,smallint,numeric,bigint,bigint,bigint,jsonb,text,jsonb,text,timestamptz,text,text,timestamptz,text,jsonb,boolean,text)',
        'public.update_advanced_stats_scope_poll_v1(uuid,text,text,text,timestamptz,boolean,text,timestamptz,text,text,timestamptz,text,jsonb,text,text)',
        'public.update_advanced_stats_bootstrap_v1(uuid,text,text,text,text,smallint,bigint,bigint,text,text,timestamptz)',
        'public.read_advanced_stats_compact_overview_v1(uuid,text,timestamptz)',
        'public.read_advanced_stats_compact_units_v1(uuid,text,timestamptz,text)',
        'public.read_advanced_stats_compact_armies_v1(uuid,text,timestamptz,integer)',
        'public.read_advanced_stats_compact_trends_v1(uuid,text,timestamptz)',
        'public.record_advanced_stats_scope_capability_v1(uuid,text,text,text,text,text,text,text,jsonb,timestamptz)',
        'public.initialize_advanced_stats_scope_state_v1()',
        'public.normalize_advanced_stats_ranked_season_key_v1(text,text)',
        'public.guard_advanced_stats_scope_season_v1()',
        'public.assign_advanced_stats_aggregate_season_v1()',
        'public.switch_advanced_stats_ranked_season_v1(uuid,text,text,text,text,timestamptz)',
        'public.prepare_advanced_stats_ranked_season_v1(uuid,text,text,text,timestamptz)',
        'public.save_advanced_stats_compact_event_v2(uuid,text,text,text,timestamptz,timestamptz,smallint,numeric,bigint,bigint,bigint,jsonb,text,jsonb,text,timestamptz,text,text,timestamptz,text,jsonb,boolean,text,text)',
        'public.update_advanced_stats_scope_poll_v2(uuid,text,text,text,timestamptz,boolean,text,timestamptz,text,text,timestamptz,text,jsonb,text,text,text)',
        'public.read_advanced_stats_compact_overview_v2(uuid,text,timestamptz,text)',
        'public.read_advanced_stats_compact_units_v2(uuid,text,timestamptz,text,text)',
        'public.read_advanced_stats_compact_armies_v2(uuid,text,timestamptz,integer,text)',
        'public.read_advanced_stats_compact_trends_v2(uuid,text,timestamptz,text)'
    ];
    v_required_migrations text[] := array[
        'advanced_achievements_foundation',
        'advanced_stats_foundation',
        'advanced_stats_battle_ingestion',
        'advanced_stats_identity_hardening',
        'advanced_stats_scheduled_collection',
        'advanced_stats_read_models',
        'advanced_stats_exact_trends',
        'advanced_stats_achievements_integration',
        'advanced_stats_delete_cleanup',
        'advanced_stats_lifecycle_fence_and_delete_cleanup',
        'advanced_stats_compact_source_of_truth',
        'advanced_stats_compact_backfill',
        'advanced_stats_compact_rpc_contract',
        'advanced_stats_compact_reads',
        'advanced_stats_compact_bootstrap',
        'advanced_stats_compact_capabilities',
        'advanced_stats_ranked_season_schema',
        'advanced_stats_ranked_season_switch',
        'advanced_stats_ranked_season_v1_compat',
        'advanced_stats_ranked_season_write_contract',
        'advanced_stats_ranked_season_overview_read',
        'advanced_stats_ranked_season_units_read',
        'advanced_stats_ranked_season_armies_read',
        'advanced_stats_ranked_season_trends_read'
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

        select c.relrowsecurity
          into v_rls
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public'
           and c.relname = v_table
           and c.relkind = 'r';

        if coalesce(v_rls, false) is not true then
            raise exception 'RLS is not enabled on public.%', v_table;
        end if;

        if has_table_privilege('anon', format('public.%I', v_table), 'SELECT')
           or has_table_privilege('anon', format('public.%I', v_table), 'INSERT')
           or has_table_privilege('anon', format('public.%I', v_table), 'UPDATE')
           or has_table_privilege('anon', format('public.%I', v_table), 'DELETE') then
            raise exception 'anon has direct table privileges on public.%', v_table;
        end if;

        if has_table_privilege('authenticated', format('public.%I', v_table), 'SELECT')
           or has_table_privilege('authenticated', format('public.%I', v_table), 'INSERT')
           or has_table_privilege('authenticated', format('public.%I', v_table), 'UPDATE')
           or has_table_privilege('authenticated', format('public.%I', v_table), 'DELETE') then
            raise exception 'authenticated has direct table privileges on public.%', v_table;
        end if;

        if not has_table_privilege('service_role', format('public.%I', v_table), 'SELECT')
           or not has_table_privilege('service_role', format('public.%I', v_table), 'INSERT')
           or not has_table_privilege('service_role', format('public.%I', v_table), 'UPDATE')
           or not has_table_privilege('service_role', format('public.%I', v_table), 'DELETE') then
            raise exception 'service_role is missing CRUD privileges on public.%', v_table;
        end if;
    end loop;

    foreach v_function in array v_required_functions loop
        v_proc := to_regprocedure(v_function);
        if v_proc is null then
            raise exception 'Missing required RPC %', v_function;
        end if;

        if has_function_privilege('anon', v_proc, 'EXECUTE') then
            raise exception 'anon can execute backend-only RPC %', v_function;
        end if;
        if has_function_privilege('authenticated', v_proc, 'EXECUTE') then
            raise exception 'authenticated can execute backend-only RPC %', v_function;
        end if;
        if not has_function_privilege('service_role', v_proc, 'EXECUTE') then
            raise exception 'service_role cannot execute required RPC %', v_function;
        end if;
    end loop;

    foreach v_function in array v_invoker_functions loop
        select p.prosecdef
          into v_rls
          from pg_proc p
         where p.oid = to_regprocedure(v_function);
        if coalesce(v_rls, false) then
            raise exception 'Compact Advanced Stats RPC must remain SECURITY INVOKER: %', v_function;
        end if;
    end loop;

    foreach v_migration in array v_required_migrations loop
        if not exists (
            select 1
              from supabase_migrations.schema_migrations
             where name = v_migration
        ) then
            raise exception 'Supabase migration history is missing %', v_migration;
        end if;
    end loop;
end $$;

select jsonb_build_object(
    'status', 'PASS',
    'tablesChecked', 14,
    'functionsChecked', 39,
    'migrationsChecked', 24,
    'browserSchemaCreate', 'DENIED',
    'browserTableAccess', 'DENIED',
    'browserRpcExecute', 'DENIED',
    'serviceRoleAccess', 'REQUIRED'
) as advanced_stats_schema_verification;

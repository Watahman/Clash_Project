-- Cover the army dictionary foreign key for parent-key maintenance and cleanup.
-- Kept separate because the foundation migration reached the staged database
-- before the live Supabase performance advisor identified the missing index.

begin;

create index if not exists advanced_stats_scope_army_daily_army_hash_idx
    on public.advanced_stats_scope_army_daily (army_hash);

commit;

package Java.advancedstats;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class AdvancedStatsLifecycleFenceMigrationTest {
    private static final Path MIGRATION = Path.of(
            "database/migrations/20260809_014_advanced_stats_lifecycle_fence_and_delete_cleanup.sql"
    );

    @Test
    void guardedWritesRequireTheActiveWorkerLeaseAndRemainBackendOnly() throws Exception {
        String sql = Files.readString(MIGRATION);
        assertTrue(sql.contains("create or replace function public.save_advanced_stats_battle_v4"));
        assertTrue(sql.contains("t.locked_by = btrim(p_worker_id)"));
        assertTrue(sql.contains("t.locked_until > now()"));
        assertTrue(sql.contains("t.status in ('INITIALIZING', 'ACTIVE', 'DEGRADED')"));
        assertTrue(sql.contains("create or replace function public.record_advanced_stats_parser_error_v3"));
        assertTrue(sql.contains("from public, anon, authenticated"));
        assertTrue(sql.contains("to service_role"));
    }

    @Test
    void destructiveCleanupCoversEveryBroadAdvancedStatsMetric() throws Exception {
        String sql = Files.readString(MIGRATION);
        for (String metric : new String[]{
                "tracked_attack_count", "tracked_star_count", "tracked_three_star_count",
                "tracked_two_star_count", "tracked_one_star_count", "tracked_zero_star_count",
                "tracked_gold_looted", "tracked_elixir_looted", "tracked_dark_elixir_looted",
                "tracked_active_days"
        }) {
            assertTrue(sql.contains("'" + metric + "'"), metric);
        }
    }
}

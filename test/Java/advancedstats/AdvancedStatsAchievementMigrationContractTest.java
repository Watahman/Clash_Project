package Java.advancedstats;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdvancedStatsAchievementMigrationContractTest {
    @Test
    void integrationReadsExactProcessedAttackMetrics() throws Exception {
        String sql = migration();

        assertTrue(sql.contains("read_advanced_stats_achievement_metrics_v1"));
        assertTrue(sql.contains("count(*)::bigint as tracked_attack_count"));
        assertTrue(sql.contains("coalesce(sum(stars), 0)::bigint as tracked_star_count"));
        assertTrue(sql.contains("count(*) filter (where stars = 3)::bigint as tracked_three_star_count"));
        assertTrue(sql.contains("b.is_attack = true"));
        assertTrue(sql.contains("b.processing_status = 'PROCESSED'"));
        assertFalse(sql.contains("threeStarRate"));
        assertFalse(sql.contains("averageStars"));
    }

    @Test
    void reconciliationIsMonotonicAndWhitelistsBattleMetrics() throws Exception {
        String sql = migration();

        assertTrue(sql.contains("reconcile_advanced_stats_achievement_progress_v1"));
        assertTrue(sql.contains("greatest(public.achievement_progress.progress, excluded.progress)"));
        assertTrue(sql.contains("public.achievement_progress.unlocked or excluded.unlocked"));
        assertTrue(sql.contains("tracked_attack_count"));
        assertTrue(sql.contains("tracked_star_count"));
        assertTrue(sql.contains("tracked_three_star_count"));
        assertTrue(sql.contains("Unsupported Advanced Stats achievement metric"));
    }

    @Test
    void phaseSevenFunctionsRemainBackendOnly() throws Exception {
        String sql = migration();

        assertTrue(sql.contains("security definer"));
        assertTrue(sql.contains("set search_path = public, pg_temp"));
        assertTrue(sql.contains("from public, anon, authenticated"));
        assertTrue(sql.contains("to service_role"));
        assertFalse(sql.contains("to authenticated"));
    }

    private String migration() throws Exception {
        return Files.readString(Path.of(
                "database/migrations/20260807_007_advanced_stats_achievements_integration.sql"
        ));
    }
}
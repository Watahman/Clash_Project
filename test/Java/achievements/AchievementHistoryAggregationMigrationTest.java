package Java.achievements;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class AchievementHistoryAggregationMigrationTest {
    @Test
    void appliesCounterPeakAndLowestRankAggregationPolicies() throws Exception {
        String sql = Files.readString(Path.of(
                "database/migrations/20260809_012_achievement_history_metric_aggregation.sql"
        ));

        assertTrue(sql.contains("'raid_weekend_loot'"));
        assertTrue(sql.contains("'legend_best_season_trophies'"));
        assertTrue(sql.contains("'legend_best_season_rank'"));
        assertTrue(sql.contains("'ranking_best_global_rank'"));
        assertTrue(sql.contains("then max(value)::bigint"));
        assertTrue(sql.contains("then (min(value) filter (where value > 0))::bigint"));
        assertTrue(sql.contains("to service_role"));
        assertTrue(sql.contains("from public, anon, authenticated"));
    }
}

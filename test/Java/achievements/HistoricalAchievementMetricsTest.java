package Java.achievements;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class HistoricalAchievementMetricsTest {
    @Test
    void accumulatesOnlyPositiveChangesAcrossAllSnapshots() {
        var metrics = HistoricalAchievementMetrics.extract(List.of(
                new HistoricalAchievementMetrics.Snapshot(1_000_000L, Map.of(
                        "home_building_level_sum", 100L,
                        "home_wall_level_sum", 500L,
                        "home_hero_level_sum", 50L,
                        "equipment_level_sum", 20L,
                        "home_unit_level_sum", 80L,
                        "spell_level_sum", 20L,
                        "siege_level_sum", 10L,
                        "pet_level_sum", 10L,
                        "builder_building_level_sum", 200L,
                        "cosmetic_collection_count", 25L,
                        "active_upgrade_count", 2L
                )),
                new HistoricalAchievementMetrics.Snapshot(1_086_400L, Map.of(
                        "home_building_level_sum", 110L,
                        "home_wall_level_sum", 520L,
                        "home_hero_level_sum", 52L,
                        "equipment_level_sum", 25L,
                        "home_unit_level_sum", 82L,
                        "spell_level_sum", 21L,
                        "siege_level_sum", 10L,
                        "pet_level_sum", 10L,
                        "builder_building_level_sum", 204L,
                        "cosmetic_collection_count", 27L,
                        "active_upgrade_count", 0L
                )),
                new HistoricalAchievementMetrics.Snapshot(1_172_800L, Map.of(
                        "home_building_level_sum", 108L,
                        "home_wall_level_sum", 550L,
                        "home_hero_level_sum", 55L,
                        "equipment_level_sum", 28L,
                        "home_unit_level_sum", 85L,
                        "spell_level_sum", 23L,
                        "siege_level_sum", 11L,
                        "pet_level_sum", 12L,
                        "builder_building_level_sum", 210L,
                        "cosmetic_collection_count", 30L,
                        "active_upgrade_count", 1L
                ))
        ));

        assertEquals(3L, metrics.get("snapshot_import_count"));
        assertEquals(2L, metrics.get("tracked_days"));
        assertEquals(10L, metrics.get("tracked_home_building_levels"));
        assertEquals(50L, metrics.get("tracked_home_wall_levels"));
        assertEquals(5L, metrics.get("tracked_home_hero_levels"));
        assertEquals(8L, metrics.get("tracked_equipment_levels"));
        assertEquals(11L, metrics.get("tracked_army_levels"));
        assertEquals(10L, metrics.get("tracked_builder_building_levels"));
        assertEquals(5L, metrics.get("tracked_cosmetics_added"));
        assertEquals(2L, metrics.get("tracked_active_upgrade_observations"));
        assertEquals(2L, metrics.get("tracked_progress_intervals"));
        assertEquals(53L, metrics.get("tracked_largest_progress_jump"));
    }

    @Test
    void doesNotCountRestoredValuesTwiceAfterTemporaryDecrease() {
        var metrics = HistoricalAchievementMetrics.extract(List.of(
                new HistoricalAchievementMetrics.Snapshot(1_000L, Map.of("home_wall_level_sum", 100L)),
                new HistoricalAchievementMetrics.Snapshot(2_000L, Map.of("home_wall_level_sum", 80L)),
                new HistoricalAchievementMetrics.Snapshot(3_000L, Map.of("home_wall_level_sum", 100L)),
                new HistoricalAchievementMetrics.Snapshot(4_000L, Map.of("home_wall_level_sum", 105L))
        ));

        assertEquals(5L, metrics.get("tracked_home_wall_levels"));
        assertEquals(1L, metrics.get("tracked_progress_intervals"));
    }

    @Test
    void replacesDuplicateTimestampWithLatestSnapshot() {
        var metrics = HistoricalAchievementMetrics.extract(List.of(
                new HistoricalAchievementMetrics.Snapshot(1_000L, Map.of("home_wall_level_sum", 10L)),
                new HistoricalAchievementMetrics.Snapshot(1_000L, Map.of("home_wall_level_sum", 20L)),
                new HistoricalAchievementMetrics.Snapshot(2_000L, Map.of("home_wall_level_sum", 25L))
        ));

        assertEquals(2L, metrics.get("snapshot_import_count"));
        assertEquals(5L, metrics.get("tracked_home_wall_levels"));
    }
}

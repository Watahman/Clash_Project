package Java.achievements;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class HistoricalAchievementMetricsTest {
    @Test
    void accumulatesOnlyPositiveChangesAcrossAllSnapshots() {
        var metrics = HistoricalAchievementMetrics.extract(List.of(
                new HistoricalAchievementMetrics.Snapshot(1_000_000L, Map.ofEntries(
                        Map.entry("home_building_level_sum", 100L),
                        Map.entry("home_wall_level_sum", 500L),
                        Map.entry("home_hero_level_sum", 50L),
                        Map.entry("equipment_level_sum", 20L),
                        Map.entry("home_unit_level_sum", 80L),
                        Map.entry("spell_level_sum", 20L),
                        Map.entry("siege_level_sum", 10L),
                        Map.entry("pet_level_sum", 10L),
                        Map.entry("builder_building_level_sum", 200L),
                        Map.entry("cosmetic_collection_count", 25L),
                        Map.entry("active_upgrade_count", 2L)
                )),
                new HistoricalAchievementMetrics.Snapshot(1_086_400L, Map.ofEntries(
                        Map.entry("home_building_level_sum", 110L),
                        Map.entry("home_wall_level_sum", 520L),
                        Map.entry("home_hero_level_sum", 52L),
                        Map.entry("equipment_level_sum", 25L),
                        Map.entry("home_unit_level_sum", 82L),
                        Map.entry("spell_level_sum", 21L),
                        Map.entry("siege_level_sum", 10L),
                        Map.entry("pet_level_sum", 10L),
                        Map.entry("builder_building_level_sum", 204L),
                        Map.entry("cosmetic_collection_count", 27L),
                        Map.entry("active_upgrade_count", 0L)
                )),
                new HistoricalAchievementMetrics.Snapshot(1_172_800L, Map.ofEntries(
                        Map.entry("home_building_level_sum", 108L),
                        Map.entry("home_wall_level_sum", 550L),
                        Map.entry("home_hero_level_sum", 55L),
                        Map.entry("equipment_level_sum", 28L),
                        Map.entry("home_unit_level_sum", 85L),
                        Map.entry("spell_level_sum", 23L),
                        Map.entry("siege_level_sum", 11L),
                        Map.entry("pet_level_sum", 12L),
                        Map.entry("builder_building_level_sum", 210L),
                        Map.entry("cosmetic_collection_count", 30L),
                        Map.entry("active_upgrade_count", 1L)
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
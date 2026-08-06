package Java.achievements;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Derives cumulative, monotonic achievement metrics from stored base-data snapshots.
 * Only positive changes are counted so temporary parser changes or incomplete imports
 * cannot remove already observed progress.
 */
public final class HistoricalAchievementMetrics {
    private static final long SECONDS_PER_DAY = 86_400L;

    private static final String[] CORE_PROGRESS_METRICS = {
            "home_building_level_sum",
            "home_wall_level_sum",
            "home_hero_level_sum",
            "equipment_level_sum",
            "home_unit_level_sum",
            "spell_level_sum",
            "siege_level_sum",
            "pet_level_sum",
            "builder_building_level_sum"
    };

    private HistoricalAchievementMetrics() {}

    public static List<Snapshot> snapshotsFromJson(JsonArray rows) {
        List<Snapshot> snapshots = new ArrayList<>();
        if (rows == null) return snapshots;
        for (JsonElement element : rows) {
            if (!element.isJsonObject()) continue;
            JsonObject row = element.getAsJsonObject();
            JsonElement timestampElement = row.get("source_timestamp");
            JsonElement metricsElement = row.get("metrics");
            if (timestampElement == null || !timestampElement.isJsonPrimitive()
                    || !timestampElement.getAsJsonPrimitive().isNumber()) continue;
            if (metricsElement == null || !metricsElement.isJsonObject()) continue;
            snapshots.add(new Snapshot(
                    Math.max(0, timestampElement.getAsLong()),
                    numericMap(metricsElement.getAsJsonObject())
            ));
        }
        return snapshots;
    }

    public static Map<String, Long> extract(List<Snapshot> input) {
        TreeMap<Long, Map<String, Long>> ordered = new TreeMap<>();
        if (input != null) {
            for (Snapshot snapshot : input) {
                if (snapshot == null || snapshot.sourceTimestamp() <= 0 || snapshot.metrics() == null) continue;
                ordered.put(snapshot.sourceTimestamp(), Map.copyOf(snapshot.metrics()));
            }
        }

        Map<String, Long> result = emptyResult();
        if (ordered.isEmpty()) return Map.copyOf(result);

        List<Map.Entry<Long, Map<String, Long>>> snapshots = List.copyOf(ordered.entrySet());
        result.put("snapshot_import_count", (long) snapshots.size());
        long firstTimestamp = snapshots.getFirst().getKey();
        long lastTimestamp = snapshots.getLast().getKey();
        result.put("tracked_days", Math.max(0, (lastTimestamp - firstTimestamp) / SECONDS_PER_DAY));

        long activeUpgradeObservations = 0;
        for (Map.Entry<Long, Map<String, Long>> snapshot : snapshots) {
            if (value(snapshot.getValue(), "active_upgrade_count") > 0) activeUpgradeObservations++;
        }
        result.put("tracked_active_upgrade_observations", activeUpgradeObservations);

        long progressIntervals = 0;
        long largestProgressJump = 0;
        for (int index = 1; index < snapshots.size(); index++) {
            Map<String, Long> previous = snapshots.get(index - 1).getValue();
            Map<String, Long> current = snapshots.get(index).getValue();

            long buildingGain = positiveDelta(previous, current, "home_building_level_sum");
            long wallGain = positiveDelta(previous, current, "home_wall_level_sum");
            long heroGain = positiveDelta(previous, current, "home_hero_level_sum");
            long equipmentGain = positiveDelta(previous, current, "equipment_level_sum");
            long armyGain = positiveDelta(previous, current, "home_unit_level_sum")
                    + positiveDelta(previous, current, "spell_level_sum")
                    + positiveDelta(previous, current, "siege_level_sum")
                    + positiveDelta(previous, current, "pet_level_sum");
            long builderGain = positiveDelta(previous, current, "builder_building_level_sum");
            long collectionGain = positiveDelta(previous, current, "cosmetic_collection_count");

            add(result, "tracked_home_building_levels", buildingGain);
            add(result, "tracked_home_wall_levels", wallGain);
            add(result, "tracked_home_hero_levels", heroGain);
            add(result, "tracked_equipment_levels", equipmentGain);
            add(result, "tracked_army_levels", armyGain);
            add(result, "tracked_builder_building_levels", builderGain);
            add(result, "tracked_cosmetics_added", collectionGain);

            long intervalProgress = 0;
            for (String metric : CORE_PROGRESS_METRICS) {
                intervalProgress += positiveDelta(previous, current, metric);
            }
            intervalProgress += collectionGain;
            if (intervalProgress > 0) progressIntervals++;
            largestProgressJump = Math.max(largestProgressJump, intervalProgress);
        }

        result.put("tracked_progress_intervals", progressIntervals);
        result.put("tracked_largest_progress_jump", largestProgressJump);
        return Map.copyOf(result);
    }

    private static Map<String, Long> emptyResult() {
        Map<String, Long> result = new LinkedHashMap<>();
        for (String key : List.of(
                "snapshot_import_count",
                "tracked_days",
                "tracked_home_building_levels",
                "tracked_home_wall_levels",
                "tracked_home_hero_levels",
                "tracked_equipment_levels",
                "tracked_army_levels",
                "tracked_builder_building_levels",
                "tracked_cosmetics_added",
                "tracked_active_upgrade_observations",
                "tracked_progress_intervals",
                "tracked_largest_progress_jump"
        )) result.put(key, 0L);
        return result;
    }

    private static Map<String, Long> numericMap(JsonObject object) {
        Map<String, Long> result = new LinkedHashMap<>();
        for (Map.Entry<String, JsonElement> entry : object.entrySet()) {
            JsonElement value = entry.getValue();
            if (value == null || !value.isJsonPrimitive() || !value.getAsJsonPrimitive().isNumber()) continue;
            result.put(entry.getKey(), Math.max(0, value.getAsLong()));
        }
        return Map.copyOf(result);
    }

    private static long positiveDelta(Map<String, Long> previous, Map<String, Long> current, String metric) {
        return Math.max(0, value(current, metric) - value(previous, metric));
    }

    private static long value(Map<String, Long> values, String key) {
        if (values == null) return 0;
        return Math.max(0, values.getOrDefault(key, 0L));
    }

    private static void add(Map<String, Long> values, String key, long amount) {
        values.put(key, Math.max(0, values.getOrDefault(key, 0L)) + Math.max(0, amount));
    }

    public record Snapshot(long sourceTimestamp, Map<String, Long> metrics) {}
}

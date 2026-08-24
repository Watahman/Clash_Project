package Java.achievements;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.LinkedHashMap;
import java.util.Map;

/** Metrics that are useful to achievements but do not belong in the base parser itself. */
public final class AchievementBaseSnapshotMetrics {
    private static final String[] SECTIONS = {
            "helpers", "buildings", "traps", "decos", "obstacles", "units",
            "siege_machines", "heroes", "spells", "pets", "equipment",
            "house_parts", "skins", "sceneries", "buildings2", "traps2",
            "decos2", "obstacles2", "units2", "heroes2", "skins2", "sceneries2"
    };

    private AchievementBaseSnapshotMetrics() {}

    public static Map<String, Long> enrich(JsonObject payload, Map<String, Long> baseMetrics) {
        Map<String, Long> metrics = new LinkedHashMap<>();
        if (baseMetrics != null) metrics.putAll(baseMetrics);

        for (String section : SECTIONS) {
            JsonElement element = payload == null ? null : payload.get(section);
            metrics.put("snapshot_section_" + section,
                    element != null && element.isJsonArray() ? 1L : 0L);
        }

        long homeProgress = value(metrics, "home_building_level_sum")
                + value(metrics, "home_wall_level_sum")
                + value(metrics, "home_trap_level_sum");
        long builderProgress = value(metrics, "builder_building_level_sum")
                + value(metrics, "builder_wall_level_sum")
                + value(metrics, "builder_trap_level_sum")
                + value(metrics, "builder_unit_level_sum")
                + value(metrics, "builder_hero_level_sum");
        metrics.put("home_progress_score", homeProgress);
        metrics.put("builder_progress_score", builderProgress);
        return AchievementSpecBaseMetrics.enrich(payload, metrics);
    }

    private static long value(Map<String, Long> metrics, String key) {
        return Math.max(0, metrics.getOrDefault(key, 0L));
    }
}

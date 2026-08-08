package Java.achievements;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Direct v2 metrics whose semantics are provable from one imported payload. */
public final class AchievementSpecBaseMetrics {
    private static final List<String> TIMER_SECTIONS = List.of(
            "buildings", "traps", "units", "siege_machines", "heroes", "spells", "pets", "equipment",
            "buildings2", "traps2", "heroes2"
    );
    private static final List<String> COLLECTION_SECTIONS = List.of(
            "skins", "sceneries", "house_parts", "decos", "obstacles",
            "decos2", "obstacles2", "skins2", "sceneries2"
    );

    private AchievementSpecBaseMetrics() {}

    public static Map<String, Long> enrich(JsonObject payload, Map<String, Long> currentMetrics) {
        Map<String, Long> metrics = new LinkedHashMap<>();
        if (currentMetrics != null) metrics.putAll(currentMetrics);
        if (payload == null) return Map.copyOf(metrics);

        long structureTimers = timedEntries(payload, "buildings", "traps");
        long heroTimers = timedEntries(payload, "heroes");
        long researchTimers = timedEntries(payload, "units", "spells", "siege_machines");
        long petTimers = timedEntries(payload, "pets");
        long builderTimers = timedEntries(payload, "buildings2", "traps2", "heroes2");
        long homeBuilderTimers = structureTimers + heroTimers;

        metrics.put("base_active_structure_timers", structureTimers);
        metrics.put("base_active_hero_timers", heroTimers);
        metrics.put("base_active_research_timers", researchTimers);
        metrics.put("base_active_pet_timers", petTimers);
        metrics.put("builder_active_timer_count", builderTimers);
        metrics.put("base_active_system_count",
                (homeBuilderTimers > 0 ? 1L : 0L)
                        + (researchTimers > 0 ? 1L : 0L)
                        + (petTimers > 0 ? 1L : 0L));
        metrics.put("base_both_villages_busy", homeBuilderTimers > 0 && builderTimers > 0 ? 1L : 0L);

        TimerSummary timers = timerSummary(payload);
        metrics.put("base_max_timer_seconds", timers.max());
        if (timers.minPositive() > 0) metrics.put("base_min_positive_timer_seconds", timers.minPositive());
        metrics.put("base_timer_seconds_total", timers.total());

        long homeSceneries = value(metrics, "scenery_count");
        long builderSceneries = value(metrics, "builder_scenery_count");
        metrics.put("collection_two_village_sceneries", homeSceneries > 0 && builderSceneries > 0 ? 1L : 0L);

        long nonEmptyCategories = 0;
        for (String section : COLLECTION_SECTIONS) {
            if (!array(payload, section).isEmpty()) nonEmptyCategories++;
        }
        metrics.put("collection_non_empty_category_count", nonEmptyCategories);
        return Map.copyOf(metrics);
    }

    private static long timedEntries(JsonObject payload, String... sections) {
        long count = 0;
        for (String section : sections) {
            for (JsonElement element : array(payload, section)) {
                if (!element.isJsonObject()) continue;
                if (positiveLong(element.getAsJsonObject(), "timer") > 0) count++;
            }
        }
        return count;
    }

    private static TimerSummary timerSummary(JsonObject payload) {
        long max = 0;
        long min = Long.MAX_VALUE;
        long total = 0;
        for (String section : TIMER_SECTIONS) {
            for (JsonElement element : array(payload, section)) {
                if (!element.isJsonObject()) continue;
                long timer = positiveLong(element.getAsJsonObject(), "timer");
                if (timer <= 0) continue;
                max = Math.max(max, timer);
                min = Math.min(min, timer);
                total += timer;
            }
        }
        return new TimerSummary(max, min == Long.MAX_VALUE ? 0 : min, total);
    }

    private static JsonArray array(JsonObject root, String field) {
        JsonElement value = root.get(field);
        return value != null && value.isJsonArray() ? value.getAsJsonArray() : new JsonArray();
    }

    private static long positiveLong(JsonObject object, String field) {
        JsonElement value = object.get(field);
        if (value == null || !value.isJsonPrimitive() || !value.getAsJsonPrimitive().isNumber()) return 0L;
        return Math.max(0L, value.getAsLong());
    }

    private static long value(Map<String, Long> metrics, String key) {
        return Math.max(0L, metrics.getOrDefault(key, 0L));
    }

    private record TimerSummary(long max, long minPositive, long total) {}
}

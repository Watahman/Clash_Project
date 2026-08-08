package Java.achievements;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.util.LinkedHashMap;
import java.util.Map;

/** Keeps runtime official-achievement badges sticky without changing the v2 catalog. */
public final class DynamicOfficialAchievementProgress {
    private static final String PREFIX = "OFFICIAL_";

    private DynamicOfficialAchievementProgress() {}

    public static JsonArray merge(String storedProgressJson, JsonArray current, boolean sourceAvailable) {
        Map<String, JsonObject> stored = storedOfficialRows(storedProgressJson);
        JsonArray result = new JsonArray();
        Map<String, Boolean> seen = new LinkedHashMap<>();

        if (current != null) {
            for (JsonElement element : current) {
                if (!element.isJsonObject()) continue;
                JsonObject row = element.getAsJsonObject().deepCopy();
                String key = string(row, "achievement_key");
                if (!key.startsWith(PREFIX)) continue;
                JsonObject previous = stored.get(key);
                if (previous != null) {
                    long storedProgress = number(previous, "progress");
                    row.addProperty("progress", Math.max(number(row, "progress"), storedProgress));
                    row.addProperty("unlocked", bool(row, "unlocked") || bool(previous, "unlocked"));
                    copyOptional(previous, row, "unlocked_at");
                    copyOptional(previous, row, "updated_at");
                }
                row.addProperty("progress_known", sourceAvailable);
                row.addProperty("source_available", sourceAvailable);
                row.addProperty("has_stored_progress", previous != null
                        && (number(previous, "progress") > 0 || bool(previous, "unlocked")));
                result.add(row);
                seen.put(key, true);
            }
        }

        // Preserve badges that were proven earlier but are missing from the current
        // response. They remain last-known evidence and do not create new unlocks.
        for (Map.Entry<String, JsonObject> entry : stored.entrySet()) {
            if (seen.containsKey(entry.getKey())) continue;
            JsonObject previous = entry.getValue();
            if (!bool(previous, "unlocked") && number(previous, "progress") <= 0) continue;
            JsonObject row = previous.deepCopy();
            row.addProperty("source", AchievementSources.LIVE_PROFILE);
            row.addProperty("category_label", "Dynamic official achievements");
            row.addProperty("spec_metric", "achievement.value >= achievement.target");
            row.addProperty("evaluation_mode", "DIRECT");
            row.addProperty("priority", "P0");
            row.addProperty("tier_label", "Unlocked");
            row.addProperty("threshold_text", String.valueOf(Math.max(1L, number(row, "target"))));
            row.addProperty("progress_known", false);
            row.addProperty("source_available", false);
            row.addProperty("has_stored_progress", true);
            row.addProperty("catalog_template", false);
            row.addProperty("dynamic_official", true);
            result.add(row);
        }
        return result;
    }

    private static Map<String, JsonObject> storedOfficialRows(String json) {
        Map<String, JsonObject> result = new LinkedHashMap<>();
        if (json == null || json.isBlank()) return result;
        JsonElement parsed = JsonParser.parseString(json);
        if (!parsed.isJsonArray()) return result;
        for (JsonElement element : parsed.getAsJsonArray()) {
            if (!element.isJsonObject()) continue;
            JsonObject row = element.getAsJsonObject();
            String key = string(row, "achievement_key");
            if (key.startsWith(PREFIX)) result.put(key, row);
        }
        return result;
    }

    private static String string(JsonObject object, String field) {
        JsonElement value = object.get(field);
        return value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isString()
                ? value.getAsString() : "";
    }

    private static long number(JsonObject object, String field) {
        JsonElement value = object.get(field);
        if (value == null || !value.isJsonPrimitive() || !value.getAsJsonPrimitive().isNumber()) return 0L;
        return Math.max(0L, value.getAsLong());
    }

    private static boolean bool(JsonObject object, String field) {
        JsonElement value = object.get(field);
        return value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isBoolean() && value.getAsBoolean();
    }

    private static void copyOptional(JsonObject source, JsonObject target, String field) {
        JsonElement value = source.get(field);
        if (value != null && !value.isJsonNull()) target.add(field, value.deepCopy());
    }
}

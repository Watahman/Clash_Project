package Java.achievements;

import Java.AchievementProgressMerge;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.Map;

/** Scope-aware selection and write diffing for personal versus shared ledgers. */
public final class AchievementScopedProgress {
    private AchievementScopedProgress() {}

    public static JsonObject storedFor(
            JsonObject catalogRow,
            Map<String, JsonObject> personal,
            Map<String, JsonObject> clan
    ) {
        String key = string(catalogRow, "achievement_key");
        return (isClan(catalogRow) ? clan : personal).get(key);
    }

    public static JsonArray changedClanRows(Map<String, JsonObject> stored, JsonArray completeRows) {
        JsonArray changed = new JsonArray();
        for (JsonElement element : completeRows) {
            if (!element.isJsonObject()) continue;
            JsonObject row = element.getAsJsonObject();
            if (!isClan(row) || !bool(row, "progress_known")) continue;
            String key = string(row, "achievement_key");
            JsonObject previous = stored.get(key);
            long progress = number(row, "progress");
            boolean unlocked = bool(row, "unlocked");
            boolean improved = previous == null
                    ? progress > 0 || unlocked
                    : AchievementProgressMerge.improved(key, progress, number(previous, "progress"))
                            || (unlocked && !bool(previous, "unlocked"))
                            || number(row, "target") != number(previous, "target");
            if (improved) changed.add(row.deepCopy());
        }
        return changed;
    }

    private static boolean isClan(JsonObject row) {
        return "clan".equalsIgnoreCase(string(row, "scope"));
    }

    private static String string(JsonObject row, String key) {
        JsonElement value = row.get(key);
        return value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isString()
                ? value.getAsString() : "";
    }

    private static boolean bool(JsonObject row, String key) {
        JsonElement value = row.get(key);
        return value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isBoolean()
                && value.getAsBoolean();
    }

    private static long number(JsonObject row, String key) {
        JsonElement value = row.get(key);
        return value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isNumber()
                ? Math.max(0, value.getAsLong()) : 0;
    }
}

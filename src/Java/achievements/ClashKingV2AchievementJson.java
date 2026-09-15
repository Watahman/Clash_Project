package Java.achievements;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/** Small, strict readers for the numeric/nullable forms in the V2 schema. */
final class ClashKingV2AchievementJson {
    private ClashKingV2AchievementJson() {}

    static JsonObject object(JsonObject parent, String... keys) {
        JsonElement value = value(parent, keys);
        return value != null && value.isJsonObject() ? value.getAsJsonObject() : null;
    }

    static JsonArray array(JsonObject parent, String... keys) {
        JsonElement value = value(parent, keys);
        return value != null && value.isJsonArray() ? value.getAsJsonArray() : null;
    }

    static String text(JsonObject parent, String... keys) {
        JsonElement value = value(parent, keys);
        if (value == null || value.isJsonNull() || !value.isJsonPrimitive()) return "";
        try {
            return value.getAsString();
        } catch (RuntimeException ignored) {
            return "";
        }
    }

    static Long whole(JsonObject parent, String... keys) {
        Double value = decimal(parent, keys);
        if (value == null) return null;
        return Math.round(value);
    }

    static Double decimal(JsonObject parent, String... keys) {
        JsonElement value = value(parent, keys);
        if (value == null || value.isJsonNull() || !value.isJsonPrimitive()) return null;
        try {
            double number = value.getAsDouble();
            return Double.isFinite(number) ? number : null;
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    static Boolean bool(JsonObject parent, String... keys) {
        JsonElement value = value(parent, keys);
        if (value == null || value.isJsonNull() || !value.isJsonPrimitive()) return null;
        try {
            return value.getAsBoolean();
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    static String tag(JsonObject parent, String... keys) {
        return ClashKingV2WarAchievementProvider.normalizedTag(text(parent, keys));
    }

    private static JsonElement value(JsonObject parent, String... keys) {
        if (parent == null || keys == null) return null;
        for (String key : keys) {
            if (key != null && parent.has(key)) return parent.get(key);
        }
        return null;
    }
}

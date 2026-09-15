package Java.achievements;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.Locale;

/** Strict JSON helpers kept private to the player-history achievement reducer. */
final class ClashKingV2PlayerHistoryJson {
    private ClashKingV2PlayerHistoryJson() {}

    static Long optionalNumber(JsonObject object, String field) {
        JsonElement value = object == null ? null : object.get(field);
        if (value == null || value.isJsonNull()) return null;
        if (!value.isJsonPrimitive() || !value.getAsJsonPrimitive().isNumber()) {
            throw new IllegalArgumentException("Expected numeric field: " + field);
        }
        try {
            return value.getAsLong();
        } catch (RuntimeException error) {
            throw new IllegalArgumentException("Invalid numeric field: " + field, error);
        }
    }

    static String requiredString(JsonObject object, String field) {
        JsonElement value = object == null ? null : object.get(field);
        if (value == null || !value.isJsonPrimitive() || !value.getAsJsonPrimitive().isString()) {
            throw new IllegalArgumentException("Missing string field: " + field);
        }
        String text = value.getAsString().trim();
        if (text.isBlank()) throw new IllegalArgumentException("Missing string field: " + field);
        return text;
    }

    static long nestedLevel(JsonElement value) {
        if (value == null || value.isJsonNull()) return 0L;
        if (value.isJsonPrimitive()) return number(value);
        if (!value.isJsonObject()) return 0L;
        JsonObject object = value.getAsJsonObject();
        for (String field : new String[]{"level", "value", "count", "trophies"}) {
            JsonElement candidate = object.get(field);
            if (candidate != null && candidate.isJsonPrimitive()
                    && candidate.getAsJsonPrimitive().isNumber()) return number(candidate);
        }
        return 0L;
    }

    static long number(JsonElement value) {
        if (value == null || !value.isJsonPrimitive()
                || !value.getAsJsonPrimitive().isNumber()) return 0L;
        try {
            return value.getAsLong();
        } catch (RuntimeException ignored) {
            return 0L;
        }
    }

    static String normalizedType(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT)
                .replace('-', '_').replace(' ', '_');
    }

    static String normalizedTag(String value) {
        if (value == null || value.isBlank()) return "";
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        return normalized.startsWith("#") ? normalized : "#" + normalized;
    }
}

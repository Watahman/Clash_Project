package Java.performance;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

final class HistoricalJson {
    private static final DateTimeFormatter CLASH_TIME =
            DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss.SSS'Z'");

    private HistoricalJson() {}

    static JsonObject object(JsonObject parent, String... keys) {
        JsonElement value = value(parent, keys);
        return value != null && value.isJsonObject() ? value.getAsJsonObject() : null;
    }

    static JsonArray array(JsonObject parent, String... keys) {
        JsonElement value = value(parent, keys);
        return value != null && value.isJsonArray() ? value.getAsJsonArray() : null;
    }

    static String string(JsonObject parent, String... keys) {
        JsonElement value = value(parent, keys);
        if (value == null || value.isJsonNull() || !value.isJsonPrimitive()) return "";
        try {
            return value.getAsString();
        } catch (RuntimeException ignored) {
            return "";
        }
    }

    static int integer(JsonObject parent, int fallback, String... keys) {
        JsonElement value = value(parent, keys);
        if (value == null || value.isJsonNull() || !value.isJsonPrimitive()) return fallback;
        try {
            return value.getAsInt();
        } catch (RuntimeException ignored) {
            return fallback;
        }
    }

    static double decimal(JsonObject parent, double fallback, String... keys) {
        JsonElement value = value(parent, keys);
        if (value == null || value.isJsonNull() || !value.isJsonPrimitive()) return fallback;
        try {
            return value.getAsDouble();
        } catch (RuntimeException ignored) {
            return fallback;
        }
    }

    static Instant instant(JsonObject parent, String... keys) {
        String value = string(parent, keys);
        if (value.isBlank()) return null;
        try {
            if (value.chars().allMatch(Character::isDigit)) {
                long timestamp = Long.parseLong(value);
                return Instant.ofEpochSecond(timestamp > 10_000_000_000L ? timestamp / 1000 : timestamp);
            }
            return Instant.parse(value);
        } catch (DateTimeParseException | NumberFormatException ignored) {
            try {
                return LocalDateTime.parse(value, CLASH_TIME).toInstant(ZoneOffset.UTC);
            } catch (DateTimeParseException invalidClashTime) {
                return null;
            }
        }
    }

    static String normalizeTag(String value) {
        String tag = value == null ? "" : value.trim().toUpperCase();
        if (tag.isBlank()) return "";
        return tag.startsWith("#") ? tag : "#" + tag;
    }

    private static JsonElement value(JsonObject parent, String... keys) {
        if (parent == null || keys == null) return null;
        for (String key : keys) {
            if (key != null && parent.has(key)) return parent.get(key);
        }
        return null;
    }
}

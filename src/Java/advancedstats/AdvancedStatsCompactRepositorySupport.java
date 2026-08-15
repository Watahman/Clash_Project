package Java.advancedstats;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonNull;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.time.Instant;
import java.time.OffsetDateTime;

/** Small JSON and timestamp helpers kept separate from the RPC orchestration. */
final class AdvancedStatsCompactRepositorySupport {
    private AdvancedStatsCompactRepositorySupport() {}

    static JsonArray parseArray(String value) {
        JsonElement parsed = JsonParser.parseString(value == null || value.isBlank() ? "[]" : value);
        if (!parsed.isJsonArray()) throw new IllegalStateException("Advanced Stats response must be an array");
        return parsed.getAsJsonArray();
    }

    static JsonObject parseObject(String value) {
        JsonElement parsed = JsonParser.parseString(value == null || value.isBlank() ? "{}" : value);
        if (!parsed.isJsonObject()) throw new IllegalStateException("Advanced Stats RPC response must be an object");
        return parsed.getAsJsonObject();
    }

    static String requiredString(JsonObject row, String field) {
        String value = optionalString(row, field);
        if (value == null || value.isBlank()) throw new IllegalStateException("Missing database field: " + field);
        return value;
    }

    static String optionalString(JsonObject row, String field) {
        JsonElement value = row.get(field);
        return value == null || value.isJsonNull() ? null : value.getAsString();
    }

    static long optionalLong(JsonObject row, String field, long fallback) {
        JsonElement value = row.get(field);
        return value == null || value.isJsonNull() ? fallback : value.getAsLong();
    }

    static Instant optionalInstant(JsonObject row, String field) {
        String value = optionalString(row, field);
        if (value == null || value.isBlank()) return null;
        try {
            return Instant.parse(value);
        } catch (RuntimeException ignored) {
            return OffsetDateTime.parse(value).toInstant();
        }
    }

    static boolean booleanValue(JsonObject row, String field, boolean fallback) {
        JsonElement value = row.get(field);
        return value == null || value.isJsonNull() ? fallback : value.getAsBoolean();
    }

    static void addInteger(JsonObject object, String field, Integer value) {
        if (value == null) object.add(field, JsonNull.INSTANCE); else object.addProperty(field, value);
    }

    static void addDouble(JsonObject object, String field, Double value) {
        if (value == null) object.add(field, JsonNull.INSTANCE); else object.addProperty(field, value);
    }

    static void addLong(JsonObject object, String field, Long value) {
        if (value == null) object.add(field, JsonNull.INSTANCE); else object.addProperty(field, value);
    }
}

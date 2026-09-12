package Java.advancedstats;

import com.google.gson.JsonElement;
import com.google.gson.JsonNull;
import com.google.gson.JsonObject;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

/** Shared encoding and response helpers for the ownership-safe read service. */
final class AdvancedStatsReadResponseSupport {
    private AdvancedStatsReadResponseSupport() {}

    static int boundedLimit(int requested, int fallback, int maximum) {
        if (requested <= 0) return fallback;
        return Math.min(requested, maximum);
    }

    static String encodeCursor(AdvancedStatsReadService.Cursor cursor) {
        if (cursor == null || cursor.at() == null || cursor.id() == null) {
            throw new IllegalArgumentException("cursor is incomplete");
        }
        String value = cursor.at().toString() + "|" + cursor.id();
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    static AdvancedStatsReadService.Cursor decodeCursor(String rawCursor) {
        if (rawCursor == null || rawCursor.isBlank()) return null;
        try {
            String decoded = new String(
                    Base64.getUrlDecoder().decode(rawCursor.trim()),
                    StandardCharsets.UTF_8
            );
            String[] parts = decoded.split("\\|", -1);
            if (parts.length != 2) throw new IllegalArgumentException();
            return new AdvancedStatsReadService.Cursor(Instant.parse(parts[0]), UUID.fromString(parts[1]));
        } catch (RuntimeException invalid) {
            throw new IllegalArgumentException("Ongeldige Advanced Stats cursor");
        }
    }

    static JsonElement copyOrNull(JsonObject source, String field) {
        JsonElement value = source.get(field);
        return value == null ? JsonNull.INSTANCE : value.deepCopy();
    }

    static boolean hasText(JsonObject source, String field) {
        JsonElement value = source.get(field);
        return value != null && !value.isJsonNull() && !value.getAsString().isBlank();
    }
}

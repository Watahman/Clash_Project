package Java.advancedstats;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;

/** Defensive JSON and scalar decoding shared by the ClashKing V2 parser. */
final class ClashKingV2AdvancedStatsParserSupport {
    private static final List<DateTimeFormatter> CLASH_TIME_FORMATS = List.of(
            DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss.SSSX").withZone(ZoneOffset.UTC),
            DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmssX").withZone(ZoneOffset.UTC));

    private ClashKingV2AdvancedStatsParserSupport() {}

    static JsonArray array(JsonObject row, String name) {
        JsonElement value = row == null ? null : row.get(name);
        return value != null && value.isJsonArray() ? value.getAsJsonArray() : new JsonArray();
    }

    static JsonObject object(JsonElement value) {
        return value != null && value.isJsonObject() ? value.getAsJsonObject() : null;
    }

    static String text(JsonObject row, String... names) {
        if (row == null) return "";
        for (String name : names) {
            String text = textPrimitive(row.get(name));
            if (!text.isBlank()) return text;
        }
        return "";
    }

    static String textPrimitive(JsonElement value) {
        if (value == null || value.isJsonNull() || !value.isJsonPrimitive()) return "";
        try { return value.getAsString().trim(); } catch (RuntimeException ignored) { return ""; }
    }

    static Integer integer(JsonObject row, String... names) {
        if (row == null) return null;
        for (String name : names) {
            JsonElement value = row.get(name);
            if (value == null || value.isJsonNull()) continue;
            try { return value.getAsInt(); } catch (RuntimeException ignored) { }
        }
        return null;
    }

    static Double percentage(JsonObject row, String... names) {
        Double value = decimal(row, names);
        return value == null || value < 0 || value > 100 ? null : value;
    }

    static Double decimal(JsonObject row, String... names) {
        if (row == null) return null;
        for (String name : names) {
            JsonElement value = row.get(name);
            if (value == null || value.isJsonNull()) continue;
            try {
                double parsed = value.getAsDouble();
                if (Double.isFinite(parsed)) return parsed;
            } catch (RuntimeException ignored) { }
        }
        return null;
    }

    static int number(JsonElement value, int fallback) {
        if (value == null || value.isJsonNull()) return fallback;
        try { return value.getAsInt(); } catch (RuntimeException ignored) { return fallback; }
    }

    static Long longValue(JsonObject row, String... names) {
        if (row == null) return null;
        for (String name : names) {
            JsonElement value = row.get(name);
            if (value == null || value.isJsonNull()) continue;
            try { return value.getAsLong(); } catch (RuntimeException ignored) { }
        }
        return null;
    }

    static Instant instant(JsonObject row, Instant fallback, String... names) {
        String value = text(row, names);
        if (value.isBlank()) return fallback;
        if (value.chars().allMatch(Character::isDigit)) {
            try {
                long timestamp = Long.parseLong(value);
                return Instant.ofEpochSecond(timestamp > 10_000_000_000L ? timestamp / 1000 : timestamp);
            } catch (RuntimeException ignored) { }
        }
        try { return Instant.parse(value); } catch (DateTimeParseException ignored) { }
        try { return OffsetDateTime.parse(value).toInstant(); } catch (DateTimeParseException ignored) { }
        for (DateTimeFormatter formatter : CLASH_TIME_FORMATS) {
            try { return Instant.from(formatter.parse(value)); } catch (DateTimeParseException ignored) { }
        }
        return fallback;
    }

    static Integer positive(Integer value) { return value == null || value <= 0 ? null : value; }
}

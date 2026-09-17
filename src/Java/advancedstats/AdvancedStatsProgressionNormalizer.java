package Java.advancedstats;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;

import static Java.advancedstats.AdvancedStatsProgressionModels.Coverage;
import static Java.advancedstats.AdvancedStatsProgressionModels.Event;
import static Java.advancedstats.AdvancedStatsProgressionModels.Kind;

/** Strict, raw-payload-free normalization for the two supported V2 history routes. */
public final class AdvancedStatsProgressionNormalizer {
    private AdvancedStatsProgressionNormalizer() {}

    public record Result(List<Event> events, int records, int invalidRecords) {
        public Result {
            events = events == null ? List.of() : List.copyOf(events);
            if (records < 0 || invalidRecords < 0 || invalidRecords > records) {
                throw new IllegalArgumentException("invalid normalization counts");
            }
        }
    }

    public static Result changes(JsonElement response, Instant observedAt, String source) {
        return normalizeRows(response, observedAt, source, false);
    }

    public static Result donations(JsonElement response, Instant observedAt, String source) {
        return normalizeRows(response, observedAt, source, true);
    }

    private static Result normalizeRows(
            JsonElement response, Instant observedAt, String source, boolean donationRows
    ) {
        if (observedAt == null) throw new IllegalArgumentException("observedAt is required");
        JsonArray rows = items(response);
        List<Event> events = new ArrayList<>();
        int invalid = 0;
        for (JsonElement rowElement : rows) {
            if (!rowElement.isJsonObject()) {
                invalid++;
                continue;
            }
            try {
                Event event = donationRows
                        ? donation(rowElement.getAsJsonObject(), observedAt, source)
                        : change(rowElement.getAsJsonObject(), observedAt, source);
                if (event != null) events.add(event);
            } catch (RuntimeException malformed) {
                invalid++;
            }
        }
        return new Result(events, rows.size(), invalid);
    }

    private static Event change(JsonObject row, Instant observedAt, String source) {
        Instant eventAt = instant(requiredString(row, "time"));
        Kind kind = kind(normalized(requiredString(row, "type")));
        if (kind == null) return null;

        String entityKey = kind == Kind.TOWN_HALL ? "townhall" : entityKey(row, kind);
        String name = kind == Kind.TOWN_HALL ? "Town Hall" : entityName(row);
        Long previous = level(row.get("previous"));
        Long current = level(row.get("current"));
        if (kind == Kind.TOWN_HALL && current == null) current = number(row.get("townhall_level"));
        if (current == null || (previous != null && previous.equals(current))) return null;
        Long delta = previous == null ? null : current - previous;
        String key = fingerprint(kind, entityKey, eventAt, previous, current);
        return new Event(key, kind, entityKey, name, previous, current, delta,
                eventAt, observedAt, source, Coverage.COMPLETE);
    }

    private static Event donation(JsonObject row, Instant observedAt, String source) {
        if (!"donated".equals(normalized(requiredString(row, "statType")))) return null;
        Instant eventAt = instant(requiredString(row, "eventTime"));
        Long previous = number(row.get("previousValue"));
        Long current = number(row.get("currentValue"));
        Long reportedDelta = number(row.get("delta"));
        if (previous == null || current == null) return null;
        long difference = current - previous;
        Long delta = reportedDelta != null && reportedDelta > 0 ? reportedDelta : difference;
        if (delta <= 0) return null;
        String key = fingerprint(Kind.DONATION, "donations", eventAt, previous, current);
        return new Event(key, Kind.DONATION, "donations", "Donations", previous, current, delta,
                eventAt, observedAt, source, Coverage.COMPLETE);
    }

    private static JsonArray items(JsonElement response) {
        if (response == null || !response.isJsonObject()) {
            throw new IllegalArgumentException("history response is not an object");
        }
        JsonElement value = response.getAsJsonObject().get("items");
        if (value == null || !value.isJsonArray()) {
            throw new IllegalArgumentException("history response has no items array");
        }
        return value.getAsJsonArray();
    }

    private static Kind kind(String type) {
        if (type.contains("townhall") || type.contains("town_hall")) return Kind.TOWN_HALL;
        if (type.contains("hero")) return Kind.HERO;
        if (type.contains("pet")) return Kind.PET;
        if (type.contains("equipment")) return Kind.EQUIPMENT;
        return null;
    }

    private static String entityKey(JsonObject row, Kind kind) {
        JsonObject item = object(row.get("item"));
        Long id = number(item.get("id"));
        if (id != null && id > 0) return "id:" + id;
        String name = entityName(row);
        if (name.isBlank()) throw new IllegalArgumentException("change item is missing identity");
        return kind.apiValue() + ":" + slug(name);
    }

    private static String entityName(JsonObject row) {
        String name = string(object(row.get("item")), "name");
        if (name.isBlank()) throw new IllegalArgumentException("change item is missing name");
        return name;
    }

    private static Long level(JsonElement value) {
        Long direct = number(value);
        if (direct != null) return direct;
        JsonObject object = object(value);
        for (String field : new String[]{"level", "value", "count", "trophies"}) {
            Long nested = number(object.get(field));
            if (nested != null) return nested;
        }
        return null;
    }

    private static Long number(JsonElement value) {
        if (value == null || value.isJsonNull() || !value.isJsonPrimitive()
                || !value.getAsJsonPrimitive().isNumber()) return null;
        try {
            long result = value.getAsLong();
            return result < 0 ? null : result;
        } catch (RuntimeException invalid) {
            return null;
        }
    }

    private static JsonObject object(JsonElement value) {
        return value != null && value.isJsonObject() ? value.getAsJsonObject() : new JsonObject();
    }

    private static String requiredString(JsonObject object, String field) {
        String value = string(object, field);
        if (value.isBlank()) throw new IllegalArgumentException("missing " + field);
        return value;
    }

    private static String string(JsonObject object, String field) {
        JsonElement value = object == null ? null : object.get(field);
        return value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isString()
                ? value.getAsString().trim() : "";
    }

    private static Instant instant(String value) {
        try {
            return Instant.parse(value);
        } catch (DateTimeParseException invalid) {
            throw new IllegalArgumentException("invalid history timestamp", invalid);
        }
    }

    private static String normalized(String value) {
        return value.trim().toLowerCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
    }

    private static String slug(String value) {
        return value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-|-$", "");
    }

    private static String fingerprint(Kind kind, String entityKey, Instant eventAt,
                                      Long previous, Long current) {
        String canonical = kind.apiValue() + "|" + entityKey + "|" + eventAt
                + "|" + previous + "|" + current;
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(canonical.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception unavailable) {
            throw new IllegalStateException("SHA-256 is unavailable", unavailable);
        }
    }
}

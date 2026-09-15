package Java.achievements;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.time.Instant;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;

/** Normalizes the four public positive-stat history variants into achievement metrics. */
public final class ClashKingV2StatsNormalizer {
    private ClashKingV2StatsNormalizer() {}

    public record Slice(Map<String, Long> metrics, int records, String latestSeason)
            implements ClashKingV2AchievementSlice {
        public Slice {
            metrics = Map.copyOf(metrics == null ? Map.of() : metrics);
            latestSeason = latestSeason == null ? "" : latestSeason;
        }
    }

    public static Slice normalize(String type, JsonElement response) {
        String base = baseMetric(type);
        JsonArray rows = items(response);
        long lifetime = 0L;
        long latest = 0L;
        String latestSeason = "";
        Map<YearMonth, Long> seasons = new LinkedHashMap<>();

        for (JsonElement element : rows) {
            JsonObject row = object(element, "stats item");
            String rowType = ClashKingV2PlayerHistoryJson.requiredString(row, "statType");
            if (!type.equals(rowType)) throw new IllegalArgumentException("Stats type mismatch");
            validateClanTag(row);
            String eventTime = ClashKingV2PlayerHistoryJson.requiredString(row, "eventTime");
            YearMonth season = season(eventTime);
            long previous = requiredNumber(row, "previousValue");
            long current = requiredNumber(row, "currentValue");
            long delta = requiredNumber(row, "delta");
            long positive = Math.max(0L, delta > 0 ? delta : current - previous);
            lifetime = safeAdd(lifetime, positive);
            latest = Math.max(latest, Math.max(0L, current));
            seasons.merge(season, positive, ClashKingV2StatsNormalizer::safeAdd);
        }

        long maxSeason = seasons.values().stream().mapToLong(Long::longValue).max().orElse(0L);
        if (!seasons.isEmpty()) latestSeason = seasons.keySet().stream().max(YearMonth::compareTo).orElseThrow().toString();
        return new Slice(metrics(base, lifetime, latest, maxSeason, rows.size()), rows.size(), latestSeason);
    }

    private static Map<String, Long> metrics(
            String base, long lifetime, long latest, long maxSeason, int records
    ) {
        Map<String, Long> metrics = new LinkedHashMap<>();
        metrics.put("sea_" + base, maxSeason);
        metrics.put("sea_" + base + "_lifetime", lifetime);
        metrics.put("history_" + base + "_current", latest);
        metrics.put("history_" + base + "_events", (long) records);
        return Map.copyOf(metrics);
    }

    private static String baseMetric(String type) {
        return switch (type == null ? "" : type) {
            case "donated" -> "donations";
            case "received" -> "donations_received";
            case "clan_games" -> "clan_games_points";
            case "capital_gold_donated" -> "capital_gold_donated";
            default -> throw new IllegalArgumentException("Unsupported stats type: " + type);
        };
    }

    private static JsonArray items(JsonElement response) {
        if (response == null || !response.isJsonObject()) throw new IllegalArgumentException("Stats response is not an object");
        JsonElement value = response.getAsJsonObject().get("items");
        if (value == null || !value.isJsonArray()) throw new IllegalArgumentException("Stats response has no items array");
        return value.getAsJsonArray();
    }

    private static JsonObject object(JsonElement value, String label) {
        if (value == null || !value.isJsonObject()) throw new IllegalArgumentException(label + " is not an object");
        return value.getAsJsonObject();
    }

    private static long requiredNumber(JsonObject object, String field) {
        Long value = ClashKingV2PlayerHistoryJson.optionalNumber(object, field);
        if (value == null) throw new IllegalArgumentException("Missing numeric field: " + field);
        return Math.max(0L, value);
    }

    private static void validateClanTag(JsonObject row) {
        if (!row.has("clanTag")) throw new IllegalArgumentException("Missing stats clanTag");
        JsonElement value = row.get("clanTag");
        if (!value.isJsonNull() && (!value.isJsonPrimitive()
                || !value.getAsJsonPrimitive().isString())) {
            throw new IllegalArgumentException("Invalid stats clanTag");
        }
    }

    private static YearMonth season(String value) {
        try {
            return YearMonth.from(Instant.parse(value).atZone(ZoneOffset.UTC));
        } catch (DateTimeParseException error) {
            throw new IllegalArgumentException("Invalid stats eventTime", error);
        }
    }

    private static long safeAdd(long left, long right) {
        if (right <= 0) return left;
        if (Long.MAX_VALUE - left < right) return Long.MAX_VALUE;
        return left + right;
    }
}

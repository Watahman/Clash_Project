package Java.achievements;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Converts ClashKing legend rankings into one compact record per valid season. */
public final class LegendHistoryNormalizer {
    private LegendHistoryNormalizer() {}

    public static History normalize(JsonArray response, String playerTag, Instant fetchedAt) {
        JsonArray rows = response == null ? new JsonArray() : response;
        String requestedTag = normalizedTag(playerTag);
        Instant checkedAt = fetchedAt == null ? Instant.now() : fetchedAt;
        YearMonth currentMonth = YearMonth.from(checkedAt.atZone(ZoneOffset.UTC));
        int invalidSeasonRecords = 0;
        int invalidRankRecords = 0;
        int mismatchedPlayerRecords = 0;
        int duplicateRecords = 0;
        int nonFinalRecords = 0;
        Map<String, SeasonRecord> unique = new LinkedHashMap<>();

        for (JsonElement element : rows) {
            if (!element.isJsonObject()) continue;
            JsonObject row = element.getAsJsonObject();
            if (!requestedTag.equals(normalizedTag(string(row, "tag")))) {
                mismatchedPlayerRecords++;
                continue;
            }
            String seasonText = string(row, "season");
            YearMonth season = season(seasonText);
            if (season == null) {
                invalidSeasonRecords++;
                continue;
            }
            long rank = positiveLong(row, "rank");
            if (rank <= 0) {
                invalidRankRecords++;
                continue;
            }
            long trophies = nonNegativeLong(row, "trophies");
            boolean finalState = season.isBefore(currentMonth);
            if (!finalState) {
                nonFinalRecords++;
                continue;
            }
            Map<String, Long> metrics = new LinkedHashMap<>();
            metrics.put("legend_ranked_seasons", 1L);
            metrics.put("legend_best_season_trophies", trophies);
            metrics.put("legend_best_season_rank", rank);
            metrics.put("ranking_best_global_rank", rank);
            Instant timestamp = season.plusMonths(1).atDay(1).atStartOfDay()
                    .toInstant(ZoneOffset.UTC).minusSeconds(1);
            SeasonRecord candidate = new SeasonRecord(
                    season.toString(),
                    timestamp,
                    finalState,
                    normalizedTag(string(row, "tag")),
                    string(row, "name"),
                    Map.copyOf(metrics)
            );
            SeasonRecord existing = unique.get(season.toString());
            if (existing != null) {
                duplicateRecords++;
                candidate = better(existing, candidate);
            }
            unique.put(season.toString(), candidate);
        }

        List<SeasonRecord> records = new ArrayList<>(unique.values());
        records.sort(Comparator.comparing(SeasonRecord::season).reversed());
        long finalRecords = records.stream().filter(SeasonRecord::finalState).count();
        Instant oldest = records.stream().map(SeasonRecord::recordTimestamp)
                .min(Comparator.naturalOrder()).orElse(null);
        Instant newest = records.stream().map(SeasonRecord::recordTimestamp)
                .max(Comparator.naturalOrder()).orElse(null);
        Coverage coverage = new Coverage(
                rows.size(),
                records.size(),
                mismatchedPlayerRecords,
                invalidSeasonRecords,
                invalidRankRecords,
                duplicateRecords,
                nonFinalRecords,
                Math.toIntExact(finalRecords),
                oldest,
                newest,
                checkedAt
        );
        return new History(List.copyOf(records), coverage);
    }

    private static SeasonRecord better(SeasonRecord left, SeasonRecord right) {
        long leftRank = left.metrics().get("legend_best_season_rank");
        long rightRank = right.metrics().get("legend_best_season_rank");
        long leftTrophies = left.metrics().get("legend_best_season_trophies");
        long rightTrophies = right.metrics().get("legend_best_season_trophies");
        long bestRank = Math.min(leftRank, rightRank);
        long bestTrophies = Math.max(leftTrophies, rightTrophies);
        SeasonRecord preferred = rightRank < leftRank ? right : left;
        Map<String, Long> metrics = new LinkedHashMap<>(preferred.metrics());
        metrics.put("legend_best_season_rank", bestRank);
        metrics.put("ranking_best_global_rank", bestRank);
        metrics.put("legend_best_season_trophies", bestTrophies);
        return new SeasonRecord(
                preferred.season(),
                preferred.recordTimestamp(),
                preferred.finalState(),
                preferred.playerTag(),
                preferred.playerName(),
                Map.copyOf(metrics)
        );
    }

    private static YearMonth season(String value) {
        if (value == null || !value.matches("^20\\d{2}-(0[1-9]|1[0-2])$")) return null;
        try {
            return YearMonth.parse(value);
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }

    private static String normalizedTag(String value) {
        if (value == null) return "";
        String result = value.trim().toUpperCase(Locale.ROOT);
        if (result.isBlank()) return "";
        return result.startsWith("#") ? result : "#" + result;
    }

    private static long positiveLong(JsonObject object, String field) {
        long value = longValue(object, field);
        return value > 0 ? value : 0;
    }

    private static long nonNegativeLong(JsonObject object, String field) {
        return Math.max(0, longValue(object, field));
    }

    private static long longValue(JsonObject object, String field) {
        JsonElement value = object == null ? null : object.get(field);
        if (value == null || !value.isJsonPrimitive() || !value.getAsJsonPrimitive().isNumber()) return 0;
        try {
            return value.getAsLong();
        } catch (RuntimeException ignored) {
            return 0;
        }
    }

    private static String string(JsonObject object, String field) {
        JsonElement value = object == null ? null : object.get(field);
        return value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isString()
                ? value.getAsString()
                : "";
    }

    public record History(List<SeasonRecord> records, Coverage coverage) {}

    public record SeasonRecord(
            String season,
            Instant recordTimestamp,
            boolean finalState,
            String playerTag,
            String playerName,
            Map<String, Long> metrics
    ) {
        public String recordKey() {
            return season;
        }

        public JsonObject metadata() {
            JsonObject result = new JsonObject();
            result.addProperty("final", finalState);
            result.addProperty("season", season);
            result.addProperty("playerPresent", true);
            result.addProperty("playerTag", playerTag);
            result.addProperty("playerName", playerName);
            return result;
        }
    }

    public record Coverage(
            int sourceRecords,
            int measurableRecords,
            int mismatchedPlayerRecords,
            int invalidSeasonRecords,
            int invalidRankRecords,
            int duplicateRecords,
            int nonFinalRecords,
            int finalRecords,
            Instant oldestTimestamp,
            Instant newestTimestamp,
            Instant fetchedAt
    ) {
        public JsonObject metadata() {
            JsonObject result = new JsonObject();
            result.addProperty("availableRecords", sourceRecords);
            result.addProperty("measurableRecords", measurableRecords);
            result.addProperty("mismatchedPlayerRecords", mismatchedPlayerRecords);
            result.addProperty("invalidSeasonRecords", invalidSeasonRecords);
            result.addProperty("invalidRankRecords", invalidRankRecords);
            result.addProperty("duplicateRecords", duplicateRecords);
            result.addProperty("nonFinalRecords", nonFinalRecords);
            result.addProperty("finalRecords", finalRecords);
            if (oldestTimestamp != null) result.addProperty("oldestTimestamp", oldestTimestamp.toString());
            if (newestTimestamp != null) result.addProperty("newestTimestamp", newestTimestamp.toString());
            result.addProperty("fetchedAt", fetchedAt.toString());
            return result;
        }
    }
}

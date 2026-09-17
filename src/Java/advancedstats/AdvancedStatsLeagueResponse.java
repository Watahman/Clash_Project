package Java.advancedstats;

import Java.HttpException;
import Java.achievements.LegendHistoryNormalizer;
import Java.advancedstats.AdvancedStatsHistoryModels.AttackObservation;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static Java.advancedstats.ClashKingV2AdvancedStatsParserSupport.text;

/** Response shaping and conservative source metadata for the league reader. */
final class AdvancedStatsLeagueResponse {
    private AdvancedStatsLeagueResponse() {}

    static JsonObject mode(String name) {
        JsonObject result = new JsonObject();
        result.addProperty("mode", name);
        result.add("seasons", new JsonArray());
        result.add("daily", new JsonArray());
        result.add("summary", AdvancedStatsLeagueParser.aggregate(List.of()));
        return result;
    }

    static JsonArray daily(List<AttackObservation> rows, Instant now, String note) {
        Map<String, List<AttackObservation>> grouped = new LinkedHashMap<>();
        for (AttackObservation row : rows) {
            String day = row.occurredAt().atZone(ZoneOffset.UTC).toLocalDate().toString();
            grouped.computeIfAbsent(day, ignored -> new java.util.ArrayList<>()).add(row);
        }
        JsonArray result = new JsonArray();
        grouped.entrySet().stream().sorted(Map.Entry.comparingByKey()).forEach(entry -> {
            JsonObject day = AdvancedStatsLeagueParser.aggregate(entry.getValue());
            day.addProperty("day", entry.getKey());
            day.addProperty("status", "COMPLETE");
            day.add("provenance", provenance("clashking-v2", now, note));
            result.add(day);
        });
        return result;
    }

    static JsonObject seasonBlock(String season, List<AttackObservation> rows,
                                 AdvancedStatsLeagueModels.Coverage coverage,
                                 Instant now, String status) {
        JsonObject result = AdvancedStatsLeagueParser.aggregate(rows);
        result.addProperty("season", season);
        result.addProperty("status", status);
        result.add("coverage", AdvancedStatsLeagueParser.coverage(coverage));
        result.add("provenance", provenance("clashking-v2", now,
                "ranked season battlelog; attacks only"));
        return result;
    }

    static JsonObject failedSeason(String season, String code, Exception failure) {
        JsonObject result = new JsonObject();
        result.addProperty("season", season);
        result.addProperty("status", "UNAVAILABLE");
        result.add("summary", AdvancedStatsLeagueParser.aggregate(List.of()));
        result.add("error", error(code, failure));
        return result;
    }

    static List<String> rankedSeasons(JsonObject history, int maxSeasons) {
        return validRankedSeasonIds(history).stream()
                .sorted(Comparator.comparingLong((String id) -> Long.parseLong(id)).reversed())
                .limit(maxSeasons).toList();
    }

    static int rankedSeasonCount(JsonObject history) {
        return validRankedSeasonIds(history).size();
    }

    static boolean verifiedCurrentSeason(JsonObject history, String seasonId) {
        for (JsonElement element : array(history, "items")) {
            if (!element.isJsonObject()) continue;
            JsonObject row = element.getAsJsonObject();
            if (!seasonId.equals(text(row, "seasonId", "season_id", "season"))) continue;
            for (String field : new String[]{"current", "active", "isCurrent", "currentSeason"}) {
                JsonElement value = row.get(field);
                if (value != null && value.isJsonPrimitive()) {
                    try {
                        if (value.getAsBoolean()) return true;
                    } catch (RuntimeException ignored) { }
                }
            }
        }
        return false;
    }

    static JsonObject seasonSelection(List<String> seasons, boolean requestedCurrent,
                                      boolean verifiedCurrent, boolean truncated) {
        JsonObject result = new JsonObject();
        result.addProperty("requested", requestedCurrent ? "current-season" : "all-ranked-seasons");
        if (seasons.isEmpty()) result.add("selectedSeasonId", com.google.gson.JsonNull.INSTANCE);
        else result.addProperty("selectedSeasonId", seasons.getFirst());
        result.addProperty("verifiedCurrent", verifiedCurrent);
        result.addProperty("basis", !requestedCurrent ? "ranked_history_window"
                : verifiedCurrent ? "explicit_upstream_current_marker"
                : "latest_observed_player_history");
        result.addProperty("status", requestedCurrent && !verifiedCurrent ? "PARTIAL"
                : truncated ? "PARTIAL" : seasons.isEmpty() ? "NO_DATA" : "COMPLETE");
        return result;
    }

    static JsonObject selectionUnavailable(String reason) {
        JsonObject result = new JsonObject();
        result.addProperty("requested", "current-season");
        result.add("selectedSeasonId", com.google.gson.JsonNull.INSTANCE);
        result.addProperty("verifiedCurrent", false);
        result.addProperty("basis", "unavailable");
        result.addProperty("status", "UNAVAILABLE");
        result.addProperty("reason", reason);
        return result;
    }

    static JsonArray legendRows(JsonElement response) {
        if (response == null) return new JsonArray();
        if (response.isJsonArray()) return response.getAsJsonArray();
        if (!response.isJsonObject()) return new JsonArray();
        JsonObject root = response.getAsJsonObject();
        return array(root, root.has("items") ? "items" : "value");
    }

    static String legendDay(JsonObject dates) {
        return text(dates, "legend", "legendDay", "legend_day", "day");
    }

    static String currentRankedSeason(JsonObject ranked) {
        JsonArray seasons = array(ranked, "seasons");
        return seasons.size() == 0 ? "" : text(seasons.get(0).getAsJsonObject(), "season");
    }

    static JsonObject modes(JsonObject ranked, JsonObject legend) {
        JsonObject result = new JsonObject();
        result.add("ranked", ranked);
        result.add("legend", legend);
        return result;
    }

    static JsonObject combinedCoverage(JsonObject ranked, JsonObject legend) {
        JsonObject result = new JsonObject();
        result.add("ranked", ranked.getAsJsonObject("coverage"));
        result.add("legend", legend.getAsJsonObject("coverage"));
        return result;
    }

    static JsonObject combinedProvenance(JsonObject ranked, JsonObject legend) {
        JsonObject result = new JsonObject();
        result.add("ranked", ranked.getAsJsonObject("provenance"));
        result.add("legend", legend.getAsJsonObject("provenance"));
        return result;
    }

    static String combinedStatus(JsonObject ranked, JsonObject legend) {
        String left = ranked.get("status").getAsString();
        String right = legend.get("status").getAsString();
        if ("COMPLETE".equals(left) && "COMPLETE".equals(right)) return "COMPLETE";
        if ("UNAVAILABLE".equals(left) && "UNAVAILABLE".equals(right)) return "UNAVAILABLE";
        if ("NO_DATA".equals(left) && "NO_DATA".equals(right)) return "NO_DATA";
        return "PARTIAL";
    }

    static String modeStatus(int seasons, int rows, int failed,
                             boolean truncated, boolean selectionPartial) {
        if (seasons == 0) return "NO_DATA";
        if (rows == 0 && failed == seasons) return "UNAVAILABLE";
        if (truncated || selectionPartial) return "PARTIAL";
        return failed == 0 ? rows == 0 ? "NO_DATA" : "COMPLETE" : "PARTIAL";
    }

    static JsonObject modeCoverage(int seasons, int rows, int failed) {
        return modeCoverage(seasons, rows, failed, seasons, false);
    }

    static JsonObject modeCoverage(int seasons, int rows, int failed,
                                   int availableSeasons, boolean truncated) {
        JsonObject result = new JsonObject();
        result.addProperty("seasonCount", seasons);
        result.addProperty("availableSeasonCount", availableSeasons);
        result.addProperty("successfulSeasonCount", seasons - failed);
        result.addProperty("failedSeasonCount", failed);
        result.addProperty("attackCount", rows);
        result.addProperty("bounded", truncated);
        return result;
    }

    static void unavailableMetrics(JsonObject result, String reason) {
        JsonObject unavailable = new JsonObject();
        for (String key : new String[]{"offensiveTrophyGain", "defensiveTrophyLoss", "netTrophyChange",
                "defenses", "defensivePerformance", "itemPerformance"}) {
            unavailable.addProperty(key, "UNAVAILABLE");
        }
        JsonObject summary = result.getAsJsonObject("summary");
        JsonObject army = summary == null ? null : summary.getAsJsonObject("army");
        if (army == null || !"COMPLETE".equals(army.get("status").getAsString())) {
            unavailable.addProperty("armyUsage", "UNAVAILABLE");
            unavailable.addProperty("armyPerformance", "UNAVAILABLE");
        }
        unavailable.addProperty("reason", reason);
        result.add("unavailable", unavailable);
    }

    static void unavailable(JsonObject result, String code, Exception failure, Instant now) {
        result.addProperty("status", "UNAVAILABLE");
        result.add("error", error(code, failure));
        result.add("coverage", modeCoverage(0, 0, 0));
        result.add("provenance", provenance("clashking-v2", now, code));
    }

    static JsonObject unavailableBlock(String code) {
        JsonObject result = new JsonObject();
        result.addProperty("status", "UNAVAILABLE");
        result.addProperty("reason", code);
        return result;
    }

    static JsonObject error(String code, Exception failure) {
        JsonObject result = new JsonObject();
        result.addProperty("code", code);
        result.addProperty("retryable", failure instanceof HttpException
                && ((HttpException) failure).getStatusCode() >= 500);
        return result;
    }

    static JsonObject provenance(String source, Instant fetchedAt, String note) {
        JsonObject result = new JsonObject();
        result.addProperty("source", source);
        result.addProperty("fetchedAt", fetchedAt.toString());
        result.addProperty("note", note);
        return result;
    }

    static long value(LegendHistoryNormalizer.SeasonRecord record, String key) {
        return Math.max(0, record.metrics().getOrDefault(key, 0L));
    }

    private static JsonArray array(JsonObject root, String key) {
        JsonElement value = root == null ? null : root.get(key);
        return value != null && value.isJsonArray() ? value.getAsJsonArray() : new JsonArray();
    }

    private static List<String> validRankedSeasonIds(JsonObject history) {
        Map<String, String> unique = new LinkedHashMap<>();
        for (JsonElement element : array(history, "items")) {
            if (!element.isJsonObject()) continue;
            JsonObject row = element.getAsJsonObject();
            if (!"ranked".equalsIgnoreCase(text(row, "mode", "type"))) continue;
            String id = text(row, "seasonId", "season_id", "season");
            if (id.matches("[1-9][0-9]{0,18}")) unique.put(id, id);
        }
        return List.copyOf(unique.keySet());
    }
}

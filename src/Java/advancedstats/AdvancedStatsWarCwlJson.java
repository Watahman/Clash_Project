package Java.advancedstats;

import Java.performance.HistoricalAttack;
import Java.performance.HistoricalPlayerData;
import com.google.gson.JsonArray;
import com.google.gson.JsonNull;
import com.google.gson.JsonObject;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;

/** JSON shape for the War and CWL section, kept separate from source orchestration. */
final class AdvancedStatsWarCwlJson {
    private AdvancedStatsWarCwlJson() {}

    static JsonObject envelope(
            String playerTag, AdvancedStatsPeriod period, Instant from, boolean sourceAvailable
    ) {
        JsonObject result = new JsonObject();
        result.addProperty("playerTag", playerTag);
        result.addProperty("period", period.apiValue());
        addNullable(result, "from", from == null ? null : from.toString());
        result.addProperty("sourceAvailable", sourceAvailable);
        return result;
    }

    static JsonObject metrics(AdvancedStatsWarCwlMetrics.AttackMetrics value) {
        JsonObject result = new JsonObject();
        result.addProperty("status", value.status());
        addNullable(result, "warCount", value.warCount());
        addNullable(result, "availableAttacks", value.availableAttacks());
        addNullable(result, "usedAttacks", value.usedAttacks());
        addNullable(result, "missedAttacks", value.missedAttacks());
        addNullable(result, "attackCount", value.attackCount());
        addNullable(result, "totalStars", totalStars(value.starBuckets()));
        addNullable(result, "avgStars", value.avgStars());
        addNullable(result, "avgDestruction", value.avgDestruction());
        addNullable(result, "tripleRate", value.tripleRate());
        addNullable(result, "offensivePerformance", value.offensivePerformance());
        result.add("defensivePerformance", JsonNull.INSTANCE);
        addStarBuckets(result, value.starBuckets());
        addMatchups(result, value.matchups());
        result.add("trend", trend(value.trend()));
        addUnknown(result, value.unknown());
        return result;
    }

    static JsonObject trend(AdvancedStatsWarCwlMetrics.Trend value) {
        JsonObject result = new JsonObject();
        if (value == null) {
            result.addProperty("direction", "unavailable");
            result.add("deltaStarsPerAttack", JsonNull.INSTANCE);
            result.add("points", new JsonArray());
            return result;
        }
        result.addProperty("direction", value.direction());
        addNullable(result, "deltaStarsPerAttack", value.deltaStarsPerAttack());
        JsonArray points = new JsonArray();
        value.points().forEach(point -> {
            JsonObject row = new JsonObject();
            row.addProperty("bucket", point.bucket());
            row.addProperty("attackCount", point.attackCount());
            addNullable(row, "avgStars", point.avgStars());
            addNullable(row, "avgDestruction", point.avgDestruction());
            points.add(row);
        });
        result.add("points", points);
        return result;
    }

    static JsonObject unavailable(String code) {
        JsonObject result = new JsonObject();
        result.addProperty("status", "error");
        result.add("unknown", arrayOf(code));
        return result;
    }

    static JsonObject coverage(
            HistoricalPlayerData data,
            JsonObject regular,
            JsonObject cwl,
            String source,
            String status
    ) {
        JsonObject result = new JsonObject();
        result.addProperty("state", status);
        result.addProperty("source", source);
        addNullable(result, "trackedFrom", trackedBoundary(data, true));
        addNullable(result, "trackedTo", trackedBoundary(data, false));
        addNullable(result, "attackCount", totalCount(regular, cwl, "attackCount"));
        addNullable(result, "warCount", totalCount(regular, cwl, "warCount"));
        addNullable(result, "seasonCount", seasonCount(cwl));
        return result;
    }

    static JsonArray unknownCodes(boolean historyFailure, JsonObject regular, JsonObject cwl) {
        List<String> values = new ArrayList<>();
        if (historyFailure) values.add("player_history_unavailable");
        collectUnknown(values, regular);
        collectUnknown(values, cwl);
        return arrayOf(values);
    }

    static String overallStatus(
            boolean historyFailure, JsonObject regular, JsonObject cwl
    ) {
        String regularStatus = property(regular, "status");
        String cwlStatus = property(cwl, "status");
        boolean anyData = "ready".equals(regularStatus) || "ready".equals(cwlStatus)
                || "partial".equals(regularStatus) || "partial".equals(cwlStatus);
        if (!anyData && historyFailure) return "error";
        if (!anyData) return "no_data";
        return hasUnknown(regular) || hasUnknown(cwl) || !"ready".equals(regularStatus)
                || !"ready".equals(cwlStatus) ? "partial" : "ready";
    }

    static void addUnknown(JsonObject target, List<String> values) {
        target.add("unknown", arrayOf(values));
    }

    static void addNullable(JsonObject target, String name, Object value) {
        if (value == null) target.add(name, JsonNull.INSTANCE);
        else if (value instanceof Number number) target.addProperty(name, number);
        else target.addProperty(name, String.valueOf(value));
    }

    static List<String> unique(List<String> values) {
        return new ArrayList<>(new LinkedHashSet<>(values == null ? List.of() : values));
    }

    private static void addStarBuckets(
            JsonObject target, AdvancedStatsWarCwlMetrics.StarBuckets value
    ) {
        if (value == null) {
            target.add("starBuckets", JsonNull.INSTANCE);
            return;
        }
        JsonObject stars = new JsonObject();
        addNullable(stars, "zero", value.zero());
        addNullable(stars, "one", value.one());
        addNullable(stars, "two", value.two());
        addNullable(stars, "three", value.three());
        target.add("starBuckets", stars);
    }

    private static Integer totalStars(AdvancedStatsWarCwlMetrics.StarBuckets value) {
        if (value == null) return null;
        return value.one() + 2 * value.two() + 3 * value.three();
    }

    private static void addMatchups(
            JsonObject target, AdvancedStatsWarCwlMetrics.Matchups value
    ) {
        if (value == null) {
            target.add("matchups", JsonNull.INSTANCE);
            return;
        }
        JsonObject matchups = new JsonObject();
        addNullable(matchups, "same", value.same());
        addNullable(matchups, "up", value.up());
        addNullable(matchups, "down", value.down());
        target.add("matchups", matchups);
    }

    private static String trackedBoundary(HistoricalPlayerData data, boolean first) {
        if (data == null) return null;
        return data.attacks().stream()
                .map(HistoricalAttack::warEndTime).filter(value -> value != null)
                .sorted(first ? Comparator.naturalOrder() : Comparator.reverseOrder())
                .findFirst().map(Instant::toString).orElse(null);
    }

    private static Integer totalCount(JsonObject first, JsonObject second, String field) {
        Integer left = integer(first, field);
        Integer right = integer(second, field);
        if (left == null && right == null) return null;
        return (left == null ? 0 : left) + (right == null ? 0 : right);
    }

    private static Integer seasonCount(JsonObject cwl) {
        if (!cwl.has("seasons") || !cwl.get("seasons").isJsonArray()) return null;
        int count = cwl.getAsJsonArray("seasons").size();
        return count == 0 ? null : count;
    }

    private static boolean hasUnknown(JsonObject section) {
        return section.has("unknown") && section.getAsJsonArray("unknown").size() > 0;
    }

    private static void collectUnknown(List<String> values, JsonObject section) {
        if (!section.has("unknown") || !section.get("unknown").isJsonArray()) return;
        section.getAsJsonArray("unknown").forEach(item -> values.add(item.getAsString()));
    }

    private static String property(JsonObject object, String name) {
        return object.has(name) && !object.get(name).isJsonNull() ? object.get(name).getAsString() : "";
    }

    private static Integer integer(JsonObject object, String name) {
        if (!object.has(name) || object.get(name).isJsonNull()) return null;
        return object.get(name).getAsInt();
    }

    private static JsonArray arrayOf(String value) {
        return arrayOf(List.of(value));
    }

    private static JsonArray arrayOf(List<String> values) {
        JsonArray result = new JsonArray();
        unique(values).forEach(result::add);
        return result;
    }
}

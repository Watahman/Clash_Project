package Java.achievements;

import Java.Config;
import Java.performance.ClashKingHttpClient;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

/** Fetches current public ClashKing V2 sources used by player achievements. */
public final class ClashKingV2AchievementProvider {
    private static final String[] STAT_TYPES = {
            "donated", "received", "clan_games", "capital_gold_donated"
    };
    private final ClashKingHttpClient client;
    private final ClashKingV2LegendHistoryProvider legendProvider;

    public ClashKingV2AchievementProvider(Config config) {
        this(config.getClashKingBaseUrl());
    }

    public ClashKingV2AchievementProvider(String baseUrl) {
        client = new ClashKingHttpClient(baseUrl, "ClashKing V2 achievements");
        legendProvider = new ClashKingV2LegendHistoryProvider(baseUrl);
    }

    public Result collect(String playerTag) {
        String tag = ClashKingV2PlayerHistoryJson.normalizedTag(playerTag);
        if (tag.isBlank()) throw new IllegalArgumentException("playerTag is required");
        Map<String, Long> metrics = new LinkedHashMap<>();
        JsonObject coverage = new JsonObject();
        boolean available = false;
        SourceResult stats = readStats(tag, metrics);
        coverage.add("historyStats", stats.coverage());
        available |= stats.available();
        SourceResult changes = readChanges(tag, metrics);
        coverage.add("historyChanges", changes.coverage());
        available |= changes.available();
        SourceResult social = readSocialTotals(tag, metrics);
        coverage.add("joinLeaveTotals", social.coverage());
        available |= social.available();
        SourceResult rankings = readRankings(tag, metrics);
        coverage.add("rankings", rankings.coverage());
        available |= rankings.available();
        SourceResult legends = readLegendHistory(tag, metrics);
        coverage.add("legendHistory", legends.coverage());
        available |= legends.available();
        coverage.addProperty("availableSources", countAvailable(coverage));
        coverage.addProperty("sourceCount", coverage.size() - 1);
        return new Result(Map.copyOf(metrics), available, coverage);
    }

    /** Alias matching the other ClashKing provider APIs. */
    public Result fetch(String playerTag) {
        return collect(playerTag);
    }

    private SourceResult readStats(String tag, Map<String, Long> metrics) {
        JsonObject source = new JsonObject();
        JsonObject types = new JsonObject();
        boolean available = false;
        int records = 0;
        for (String type : STAT_TYPES) {
            JsonObject status = new JsonObject();
            try {
                ClashKingV2StatsNormalizer.Slice slice = ClashKingV2StatsNormalizer.normalize(
                        type, client.getElement(path(tag, "/history/stats?type=" + type))
                );
                merge(metrics, slice.metrics());
                status.addProperty("available", true);
                status.addProperty("records", slice.records());
                if (!slice.latestSeason().isBlank()) status.addProperty("latestSeason", slice.latestSeason());
                records += slice.records();
                available = true;
            } catch (Exception error) {
                addFailure(status, error);
            }
            types.add(type, status);
        }
        source.add("types", types);
        source.addProperty("available", available);
        source.addProperty("records", records);
        return new SourceResult(available, source);
    }

    private SourceResult readChanges(String tag, Map<String, Long> metrics) {
        return readSingle(
                "changes",
                () -> ClashKingV2ChangesNormalizer.normalize(client.getElement(path(tag, "/history/changes"))),
                metrics
        );
    }

    private SourceResult readSocialTotals(String tag, Map<String, Long> metrics) {
        return readSingle(
                "joinLeaveTotals",
                () -> ClashKingV2SocialRankingNormalizer.joinLeaveTotals(
                        client.getElement(path(tag, "/join-leave/totals"))
                ),
                metrics
        );
    }

    private SourceResult readRankings(String tag, Map<String, Long> metrics) {
        return readSingle(
                "rankings",
                () -> ClashKingV2SocialRankingNormalizer.rankings(
                        client.getElement(path(tag, "/rankings")), tag
                ),
                metrics
        );
    }

    private SourceResult readLegendHistory(String tag, Map<String, Long> metrics) {
        JsonObject coverage = new JsonObject();
        try {
            LegendHistoryNormalizer.History history = legendProvider.getHistory(tag);
            LegendHistoryNormalizer.Coverage sourceCoverage = history.coverage();
            if (sourceCoverage.invalidSeasonRecords() > 0
                    || sourceCoverage.invalidRankRecords() > 0
                    || sourceCoverage.mismatchedPlayerRecords() > 0) {
                throw new IllegalArgumentException("Legend history schema mismatch");
            }
            ClashKingV2SocialRankingNormalizer.Slice slice =
                    ClashKingV2SocialRankingNormalizer.legendHistory(history);
            merge(metrics, slice.metrics());
            coverage.addProperty("available", true);
            coverage.addProperty("records", slice.records());
            return new SourceResult(true, coverage);
        } catch (Exception error) {
            addFailure(coverage, error);
            return new SourceResult(false, coverage);
        }
    }

    private SourceResult readSingle(
            String name, SliceReader reader, Map<String, Long> metrics
    ) {
        JsonObject coverage = new JsonObject();
        try {
            ClashKingV2AchievementSlice slice = reader.read();
            merge(metrics, slice.metrics());
            coverage.addProperty("available", true);
            coverage.addProperty("records", slice.records());
            return new SourceResult(true, coverage);
        } catch (Exception error) {
            addFailure(coverage, error);
            return new SourceResult(false, coverage);
        }
    }

    private static String path(String tag, String suffix) {
        return "/v2/player/" + URLEncoder.encode(tag, StandardCharsets.UTF_8) + suffix;
    }

    private static int countAvailable(JsonObject coverage) {
        int count = 0;
        for (Map.Entry<String, JsonElement> entry : coverage.entrySet()) {
            if (!entry.getValue().isJsonObject()) continue;
            JsonElement value = entry.getValue().getAsJsonObject().get("available");
            if (value != null && value.isJsonPrimitive() && value.getAsBoolean()) count++;
        }
        return count;
    }

    private static void addFailure(JsonObject coverage, Exception error) {
        coverage.addProperty("available", false);
        coverage.addProperty("error", error.getClass().getSimpleName());
    }

    private static void merge(Map<String, Long> target, Map<String, Long> source) {
        for (Map.Entry<String, Long> entry : source.entrySet()) {
            long value = Math.max(0L, entry.getValue() == null ? 0L : entry.getValue());
            target.merge(entry.getKey(), value, (left, right) ->
                    entry.getKey().contains("rank")
                            ? minPositive(left, right)
                            : Math.max(left, right));
        }
    }

    private static long minPositive(long left, long right) {
        if (left <= 0L) return right;
        if (right <= 0L) return left;
        return Math.min(left, right);
    }

    public record Result(Map<String, Long> metrics, boolean available, JsonObject coverage) {
        public Result {
            metrics = Map.copyOf(metrics == null ? Map.of() : metrics);
            coverage = coverage == null ? new JsonObject() : coverage.deepCopy();
        }
    }

    private record SourceResult(boolean available, JsonObject coverage) {}

    @FunctionalInterface
    private interface SliceReader {
        ClashKingV2AchievementSlice read() throws Exception;
    }
}

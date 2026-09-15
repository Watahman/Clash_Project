package Java.achievements;

import Java.API_Utils;
import Java.Config;
import Java.cache.CachePolicy;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.util.LinkedHashMap;
import java.util.Map;

/** Coordinates the optional provider calls used by deep achievement refreshes. */
final class AchievementDeepHistorySources {
    private final ClashKingV2AchievementProvider clashKingHistoryProvider;
    private final ClashKingV2AchievementMetrics clashKingWarMetrics;
    private final OfficialClanCapitalRaidProvider officialRaidProvider;

    AchievementDeepHistorySources(Config config) {
        clashKingHistoryProvider = new ClashKingV2AchievementProvider(config);
        clashKingWarMetrics = new ClashKingV2AchievementMetrics(config);
        officialRaidProvider = createOfficialRaidProvider(config);
    }

    Result collect(String playerTag, String clanTag, Long memberCount) {
        Map<String, Long> metrics = new LinkedHashMap<>();
        boolean clashKingAvailable = false;
        boolean legendAvailable = false;
        boolean warAvailable = false;
        boolean cwlAvailable = false;
        boolean raidAvailable = false;

        try {
            ClashKingV2AchievementProvider.Result result =
                    clashKingHistoryProvider.collect(playerTag);
            metrics.putAll(result.metrics());
            clashKingAvailable = result.available();
            legendAvailable = rankingCoverageAvailable(result.coverage());
        } catch (Exception ignored) {
            // Deep-history sources are optional; cached history still remains usable.
        }
        try {
            ClashKingV2AchievementMetrics.Result result = clashKingWarMetrics.collect(playerTag);
            metrics.putAll(result.metrics());
            warAvailable = result.warAvailable();
            cwlAvailable = result.cwlAvailable();
        } catch (Exception ignored) {
            // Keep the independent player-history result when war/CWL is unavailable.
        }
        if (clanTag != null && !clanTag.isBlank()) {
            try {
                OfficialClanCapitalRaidNormalizer.Result result = officialRaidProvider.fetch(
                        clanTag, playerTag, knownInteger(memberCount)
                );
                metrics.putAll(result.metrics());
                raidAvailable = result.sourceAvailable();
            } catch (Exception ignored) {
                // A missing clan or temporarily unavailable official endpoint is non-fatal.
            }
        }
        return new Result(metrics, clashKingAvailable, legendAvailable,
                warAvailable, cwlAvailable, raidAvailable);
    }

    private static OfficialClanCapitalRaidProvider createOfficialRaidProvider(Config config) {
        API_Utils utils = new API_Utils(config);
        return new OfficialClanCapitalRaidProvider(path -> JsonParser.parseString(
                utils.clashGetCachedValue(path, CachePolicy.CLAN_RAID_SEASONS)
        ));
    }

    private static boolean rankingCoverageAvailable(JsonObject coverage) {
        return sourceAvailable(coverage, "rankings") || sourceAvailable(coverage, "legendHistory");
    }

    private static boolean sourceAvailable(JsonObject coverage, String source) {
        if (coverage == null || !coverage.has(source) || !coverage.get(source).isJsonObject()) return false;
        JsonObject item = coverage.getAsJsonObject(source);
        return item.has("available") && item.get("available").getAsBoolean();
    }

    private static Integer knownInteger(Long value) {
        if (value == null || value < 0L || value > Integer.MAX_VALUE) return null;
        return value.intValue();
    }

    record Result(
            Map<String, Long> metrics,
            boolean clashKingAvailable,
            boolean legendAvailable,
            boolean warAvailable,
            boolean cwlAvailable,
            boolean raidAvailable
    ) {
        Result {
            metrics = Map.copyOf(metrics == null ? Map.of() : metrics);
        }

        static Result empty() {
            return new Result(Map.of(), false, false, false, false, false);
        }
    }
}

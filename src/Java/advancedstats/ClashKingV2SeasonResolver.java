package Java.advancedstats;

import Java.HttpException;
import com.google.gson.JsonObject;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;

/** Resolves and caches player season/Legend metadata for one collection pass. */
final class ClashKingV2SeasonResolver {
    static final int MAX_HISTORY_DAYS = 365;

    private final ClashKingV2AdvancedStatsSource.Transport transport;
    private final Long configuredSeason;
    private final Map<String, String> resolvedSeasons = new HashMap<>();
    private final Map<String, String> seasonReasons = new HashMap<>();
    private final Map<String, String> resolvedLegendDays = new HashMap<>();

    ClashKingV2SeasonResolver(ClashKingV2AdvancedStatsSource.Transport transport, Long configuredSeason) {
        this.transport = transport;
        this.configuredSeason = configuredSeason;
    }

    synchronized String season(String playerTag, Instant requestedAt) throws Exception {
        if (configuredSeason != null) return Long.toString(configuredSeason);
        if (transport == null) return null;
        String cacheKey = playerTag + "|" + utcDate(requestedAt);
        if (resolvedSeasons.containsKey(cacheKey)) return resolvedSeasons.get(cacheKey);
        try {
            JsonObject history = transport.leagueHistory(playerTag, historyStart(requestedAt), requestedAt);
            String season = ClashKingV2AdvancedStatsRoutes.latestRankedSeason(history);
            if (season == null) {
                seasonReasons.put(cacheKey, "ClashKing V2 returned no valid ranked season");
            } else {
                seasonReasons.remove(cacheKey);
                resolvedSeasons.put(cacheKey, season);
            }
            return season;
        } catch (HttpException missingRoute) {
            if (!ClashKingV2AdvancedStatsRoutes.isMissingRoute(missingRoute)) throw missingRoute;
            seasonReasons.put(cacheKey, "ClashKing V2 player league history could not be resolved");
            return null;
        }
    }

    synchronized String legendDay(Instant requestedAt) throws Exception {
        String cacheKey = utcDate(requestedAt);
        String cached = resolvedLegendDays.get(cacheKey);
        if (cached != null) return cached;
        try {
            String day = transport.currentLegendDay();
            if (day == null || day.isBlank()) {
                resolvedLegendDays.put(cacheKey, "");
                return "";
            }
            day = day.trim();
            LocalDate.parse(day);
            resolvedLegendDays.put(cacheKey, day);
            return day;
        } catch (HttpException missingRoute) {
            if (!ClashKingV2AdvancedStatsRoutes.isMissingRoute(missingRoute)) throw missingRoute;
            resolvedLegendDays.put(cacheKey, "");
            return "";
        }
    }

    String reason(String playerTag, Instant requestedAt) {
        String key = playerTag + "|" + utcDate(requestedAt);
        return seasonReasons.getOrDefault(key, "ClashKing V2 player ranked season is unavailable");
    }

    static Instant historyStart(Instant requestedAt) {
        return requestedAt.minus(MAX_HISTORY_DAYS - 1L, ChronoUnit.DAYS);
    }

    private static String utcDate(Instant requestedAt) {
        return requestedAt.atZone(ZoneOffset.UTC).toLocalDate().toString();
    }
}

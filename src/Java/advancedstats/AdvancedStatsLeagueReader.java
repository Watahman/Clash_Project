package Java.advancedstats;

import Java.Config;
import Java.HttpException;
import Java.achievements.LegendHistoryNormalizer;
import Java.advancedstats.AdvancedStatsHistoryModels.AttackObservation;
import Java.cache.CacheKeys;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.google.gson.JsonArray;
import com.google.gson.JsonNull;
import com.google.gson.JsonObject;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import static Java.advancedstats.AdvancedStatsLeagueResponse.*;

/** Read service for separate Ranked and Legend insights. */
public final class AdvancedStatsLeagueReader {
    public static final int MAX_RANKED_SEASONS = 8;
    private static final Duration CACHE_TTL = Duration.ofMinutes(5);
    private static final int HISTORY_DAYS = 365;

    private final AdvancedStatsLeagueSource.Fetcher fetcher;
    private final Clock clock;
    private final Cache<String, JsonObject> cache;

    public AdvancedStatsLeagueReader(Config config) {
        this(new AdvancedStatsLeagueSource.HttpFetcher(config), Clock.systemUTC());
    }

    public AdvancedStatsLeagueReader(AdvancedStatsLeagueSource.Fetcher fetcher) {
        this(fetcher, Clock.systemUTC());
    }

    public AdvancedStatsLeagueReader(AdvancedStatsLeagueSource.Fetcher fetcher, Clock clock) {
        this.fetcher = java.util.Objects.requireNonNull(fetcher, "fetcher");
        this.clock = java.util.Objects.requireNonNull(clock, "clock");
        cache = Caffeine.newBuilder().maximumSize(500).expireAfterWrite(CACHE_TTL).build();
    }

    /** Reads a typed period. The caller remains responsible for account ownership. */
    public JsonObject read(String rawPlayerTag, AdvancedStatsPeriod period, Instant from) throws Exception {
        AdvancedStatsPeriod selected = period == null ? AdvancedStatsPeriod.ALL : period;
        if ("current-season".equals(selected.apiValue()) || "current_season".equals(selected.apiValue())) {
            return readInternal(rawPlayerTag, "current-season", null, true);
        }
        return readInternal(rawPlayerTag, selected.apiValue(), from, false);
    }

    /** Supports the UI's current-season filter without guessing a calendar boundary. */
    public JsonObject read(String rawPlayerTag, String rawPeriod, Instant from) throws Exception {
        String period = rawPeriod == null || rawPeriod.isBlank()
                ? AdvancedStatsPeriod.ALL.apiValue() : rawPeriod.trim().toLowerCase(Locale.ROOT);
        if ("current-season".equals(period) || "current_season".equals(period)) {
            return readInternal(rawPlayerTag, "current-season", null, true);
        }
        return read(rawPlayerTag, AdvancedStatsPeriod.parse(period), from);
    }

    public void clearCache() {
        cache.invalidateAll();
    }

    private JsonObject readInternal(String rawTag, String period, Instant from, boolean currentSeason)
            throws Exception {
        String tag = CacheKeys.requireValidTag(rawTag);
        String key = tag + "|" + period;
        JsonObject cached = cache.getIfPresent(key);
        if (cached != null) return cached.deepCopy();
        Instant now = clock.instant();
        JsonObject result = new JsonObject();
        result.addProperty("section", "league");
        result.addProperty("period", period);
        if (from == null) result.add("from", JsonNull.INSTANCE);
        else result.addProperty("from", from.toString());
        result.addProperty("lastUpdated", now.toString());

        JsonObject ranked = readRanked(tag, from, now, currentSeason);
        JsonObject legend = readLegend(tag, from, now, ranked);
        result.add("modes", modes(ranked, legend));
        result.add("coverage", combinedCoverage(ranked, legend));
        result.add("provenance", combinedProvenance(ranked, legend));
        result.addProperty("status", combinedStatus(ranked, legend));
        cache.put(key, result.deepCopy());
        return result;
    }

    private JsonObject readRanked(String tag, Instant from, Instant now, boolean currentSeason) {
        JsonObject result = mode("ranked");
        JsonObject history;
        try {
            history = fetcher.leagueHistory(tag, now.minus(HISTORY_DAYS - 1L, ChronoUnit.DAYS), now);
        } catch (Exception failure) {
            unavailable(result, "ranked_season_discovery_unavailable", failure, clock.instant());
            result.add("selection", selectionUnavailable("ranked_season_discovery_unavailable"));
            return result;
        }
        List<String> seasons = rankedSeasons(history, MAX_RANKED_SEASONS);
        if (currentSeason && !seasons.isEmpty()) seasons = List.of(seasons.getFirst());
        int availableSeasons = rankedSeasonCount(history);
        boolean truncated = !currentSeason && availableSeasons > seasons.size();
        boolean verifiedCurrent = currentSeason && !seasons.isEmpty()
                && verifiedCurrentSeason(history, seasons.getFirst());
        JsonArray seasonRows = new JsonArray();
        List<AttackObservation> all = new ArrayList<>();
        int failed = 0;
        int invalidRows = 0;
        for (String season : seasons) {
            try {
                AdvancedStatsLeagueModels.ParsedAttacks parsed = AdvancedStatsLeagueParser.ranked(
                        fetcher.ranked(tag, season), season, tag, now);
                invalidRows += parsed.coverage().invalidRows();
                List<AttackObservation> rows = inPeriod(parsed.observations(), from);
                all.addAll(rows);
                seasonRows.add(seasonBlock(season, rows, parsed.coverage(), now,
                        parsed.coverage().invalidRows() > 0 ? "PARTIAL"
                                : rows.isEmpty() ? "NO_DATA" : "COMPLETE"));
            } catch (Exception failure) {
                failed++;
                seasonRows.add(failedSeason(season, "ranked_season_unavailable", failure));
            }
        }
        result.add("seasons", seasonRows);
        JsonObject summary = AdvancedStatsLeagueParser.aggregate(all);
        summary.addProperty("mode", "ranked");
        result.add("summary", summary);
        result.add("daily", daily(all, now, "ranked season battlelogs; attacks only"));
        result.addProperty("status", modeStatus(seasons.size(), all.size(), failed,
                truncated, invalidRows > 0 || currentSeason && !verifiedCurrent));
        result.add("coverage", modeCoverage(seasons.size(), all.size(), failed,
                availableSeasons, truncated));
        result.add("selection", seasonSelection(seasons, currentSeason, verifiedCurrent,
                truncated));
        result.add("provenance", provenance("clashking-v2", now,
                "league history plus ranked season battlelogs; attacks only"));
        unavailableMetrics(result, "Ranked V2 does not provide reliable defensive or trophy deltas");
        return result;
    }

    private JsonObject readLegend(String tag, Instant from, Instant now, JsonObject ranked) {
        JsonObject result = mode("legend");
        String seasonId = currentRankedSeason(ranked);
        String day;
        try {
            day = legendDay(fetcher.currentDates());
            if (day.isBlank()) throw new IllegalStateException("legend day is missing");
            AdvancedStatsLeagueModels.ParsedAttacks parsed = AdvancedStatsLeagueParser.legend(
                    fetcher.legend(tag, day), seasonId, day, tag, now);
            List<AttackObservation> rows = inPeriod(parsed.observations(), from);
            result.add("daily", daily(rows, now, "current Legend day battlelog; attacks only"));
            JsonObject summary = AdvancedStatsLeagueParser.aggregate(rows);
            summary.addProperty("mode", "legend");
            result.add("summary", summary);
            // The endpoint exposes the current Legend day only, even for wider filters.
            result.addProperty("status", rows.isEmpty() && parsed.coverage().invalidRows() == 0
                    ? "NO_DATA" : "PARTIAL");
            result.add("coverage", modeCoverage(1, rows.size(), parsed.coverage().invalidRows()));
        } catch (Exception failure) {
            unavailable(result, "legend_daily_unavailable", failure, now);
            result.add("dailyError", unavailableBlock("legend_daily_unavailable"));
            JsonObject summary = AdvancedStatsLeagueParser.aggregate(List.of());
            summary.addProperty("mode", "legend");
            result.add("summary", summary);
        }
        JsonObject seasonHistory = legendSeasons(tag, now);
        result.add("seasons", seasonHistory.get("items"));
        result.add("seasonHistory", seasonHistory);
        result.add("provenance", provenance("clashking-v2", now,
                "Legend day battlelog and legend-history; attacks only"));
        unavailableMetrics(result, "Legend endpoints expose no reliable defense or trophy delta history");
        return result;
    }

    private JsonObject legendSeasons(String tag, Instant now) {
        JsonObject result = new JsonObject();
        result.add("items", new JsonArray());
        try {
            LegendHistoryNormalizer.History history = LegendHistoryNormalizer.normalize(
                    legendRows(fetcher.legendHistory(tag)), tag, now);
            JsonArray seasons = new JsonArray();
            for (LegendHistoryNormalizer.SeasonRecord record : history.records()) {
                JsonObject season = new JsonObject();
                season.addProperty("season", record.season());
                season.addProperty("bestTrophies", value(record, "legend_best_season_trophies"));
                season.addProperty("bestRank", value(record, "legend_best_season_rank"));
                season.addProperty("status", "COMPLETE");
                season.add("coverage", history.coverage().metadata());
                seasons.add(season);
            }
            result.add("items", seasons);
            result.addProperty("status", seasons.isEmpty() ? "NO_DATA"
                    : history.coverage().invalidSeasonRecords() > 0
                    || history.coverage().invalidRankRecords() > 0 ? "PARTIAL" : "COMPLETE");
            result.add("coverage", history.coverage().metadata());
            result.add("provenance", provenance("clashking-v2", now, "legend-history"));
            return result;
        } catch (Exception ignored) {
            result.addProperty("status", "UNAVAILABLE");
            result.addProperty("reason", "legend_history_unavailable");
            result.add("coverage", modeCoverage(0, 0, 0));
            result.add("provenance", provenance("clashking-v2", now, "legend_history_unavailable"));
            return result;
        }
    }

    private static List<AttackObservation> inPeriod(List<AttackObservation> rows, Instant from) {
        return rows.stream().filter(row -> from == null || !row.occurredAt().isBefore(from)).toList();
    }
}

package Java.advancedstats;

import Java.cache.CacheKeys;
import Java.cwlhistory.HistoricalCwlSeasonSummary;
import Java.cwlhistory.HistoricalCwlService;
import Java.performance.HistoricalAttack;
import Java.performance.HistoricalParticipation;
import Java.performance.HistoricalPlayerData;
import Java.performance.HistoricalPlayerDataProvider;
import Java.performance.HistoricalWarType;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Reads bounded, source-backed War and CWL insights for one linked player. */
public final class AdvancedStatsWarCwlService {
    public static final int MAX_CWL_SEASONS = 24;
    private static final Duration HISTORY_CACHE_TTL = Duration.ofMinutes(10);

    private final AdvancedStatsWarCwlProvider provider;
    private final Clock clock;
    private final Cache<String, HistoricalPlayerData> historyCache;

    public AdvancedStatsWarCwlService(AdvancedStatsWarCwlProvider provider) {
        this(provider, Clock.systemUTC());
    }

    public AdvancedStatsWarCwlService(
            HistoricalPlayerDataProvider playerProvider,
            HistoricalCwlService cwlService
    ) {
        this(new AdvancedStatsWarCwlExistingProvider(playerProvider, cwlService));
    }

    AdvancedStatsWarCwlService(AdvancedStatsWarCwlProvider provider, Clock clock) {
        if (provider == null) throw new IllegalArgumentException("provider is required");
        this.provider = provider;
        this.clock = clock == null ? Clock.systemUTC() : clock;
        historyCache = Caffeine.newBuilder()
                .maximumSize(2_000)
                .expireAfterWrite(HISTORY_CACHE_TTL)
                .build();
    }

    /** Convenience read when no verified clan tag is available for CWL metadata. */
    public JsonObject read(
            String playerTag, AdvancedStatsPeriod period, Instant from
    ) throws Exception {
        return read(playerTag, null, period, from);
    }

    /**
     * Reads one player's War and CWL section. The optional clan tag must already
     * be verified by the ownership-aware route before it is supplied here.
     */
    public JsonObject read(
            String requestedPlayerTag,
            String requestedClanTag,
            AdvancedStatsPeriod requestedPeriod,
            Instant requestedFrom
    ) throws Exception {
        String playerTag = CacheKeys.requireValidTag(requestedPlayerTag);
        String clanTag = optionalTag(requestedClanTag);
        AdvancedStatsPeriod period = requestedPeriod == null
                ? AdvancedStatsPeriod.ALL : requestedPeriod;
        Instant now = clock.instant();
        Instant from = requestedFrom == null ? period.from(now) : requestedFrom;
        HistoricalRead history = loadHistory(playerTag);
        JsonObject regular = regularSection(history, from, now);
        JsonObject cwl = cwlSection(playerTag, clanTag, history, from, now);
        String status = AdvancedStatsWarCwlJson.overallStatus(
                history.failure() != null, regular, cwl
        );
        JsonObject response = AdvancedStatsWarCwlJson.envelope(
                playerTag, period, from, history.failure() == null
        );
        response.addProperty("status", status);
        response.add("coverage", AdvancedStatsWarCwlJson.coverage(
                history.data(), regular, cwl, provider.sourceName(), status
        ));
        response.add("regular", regular);
        response.add("cwl", cwl);
        response.add("unknown", AdvancedStatsWarCwlJson.unknownCodes(
                history.failure() != null, regular, cwl
        ));
        return response;
    }

    private HistoricalRead loadHistory(String playerTag) {
        HistoricalPlayerData cached = historyCache.getIfPresent(playerTag);
        if (cached != null) return new HistoricalRead(cached, null);
        try {
            HistoricalPlayerData loaded = provider.playerHistory(playerTag);
            if (loaded == null) return new HistoricalRead(null, new Exception("empty source"));
            if (!loaded.available()) {
                return new HistoricalRead(loaded, new Exception("source unavailable"));
            }
            historyCache.put(playerTag, loaded);
            return new HistoricalRead(loaded, null);
        } catch (Exception failure) {
            return new HistoricalRead(null, failure);
        }
    }

    private JsonObject regularSection(HistoricalRead history, Instant from, Instant now) {
        if (history.failure() != null) {
            return AdvancedStatsWarCwlJson.unavailable("player_history_unavailable");
        }
        List<HistoricalAttack> attacks = attacksOf(history.data(), HistoricalWarType.REGULAR);
        List<HistoricalParticipation> participation = participationOf(
                history.data(), HistoricalWarType.REGULAR
        );
        return AdvancedStatsWarCwlJson.metrics(AdvancedStatsWarCwlMetrics.aggregate(
                attacks, participation, from, now, false
        ));
    }

    private JsonObject cwlSection(
            String playerTag,
            String clanTag,
            HistoricalRead history,
            Instant from,
            Instant now
    ) {
        List<HistoricalAttack> attacks = history.data() == null
                ? List.of() : attacksOf(history.data(), HistoricalWarType.CWL);
        List<HistoricalParticipation> participation = history.data() == null
                ? List.of() : participationOf(history.data(), HistoricalWarType.CWL);
        List<String> unknown = new ArrayList<>();
        List<HistoricalCwlSeasonSummary> summaries = loadSeasonIndex(clanTag, unknown);
        Map<String, AdvancedStatsWarCwlSeasonReader.SeasonData> seasons =
                AdvancedStatsWarCwlSeasonReader.build(
                        provider, playerTag, clanTag, summaries,
                        attacks, participation, from, now, unknown
                );
        if (clanTag == null) unknown.add("cwl_league_position_unavailable");
        JsonObject result = new JsonObject();
        result.addProperty("status", cwlStatus(seasons, clanTag));
        JsonArray rows = new JsonArray();
        seasons.values().forEach(item -> rows.add(item.json()));
        result.add("seasons", rows);
        AdvancedStatsWarCwlMetrics.AttackMetrics all = AdvancedStatsWarCwlMetrics.aggregate(
                attacks, participation, from, now, false
        );
        result.add("trend", AdvancedStatsWarCwlJson.trend(all.trend()));
        AdvancedStatsWarCwlJson.addUnknown(result, unknown);
        return result;
    }

    private List<HistoricalCwlSeasonSummary> loadSeasonIndex(
            String clanTag, List<String> unknown
    ) {
        if (clanTag == null) return List.of();
        try {
            List<HistoricalCwlSeasonSummary> result = provider.cwlSeasons(
                    clanTag, MAX_CWL_SEASONS
            );
            return result == null ? List.of() : result;
        } catch (Exception failure) {
            unknown.add("cwl_season_index_unavailable");
            return List.of();
        }
    }

    private static String cwlStatus(
            Map<String, AdvancedStatsWarCwlSeasonReader.SeasonData> seasons,
            String clanTag
    ) {
        if (seasons.isEmpty()) return clanTag == null ? "unavailable" : "no_data";
        boolean ready = seasons.values().stream().anyMatch(item ->
                "ready".equals(item.metrics().status()));
        boolean complete = seasons.values().stream().allMatch(item -> item.unknown().isEmpty());
        return ready && complete ? "ready" : "partial";
    }

    private static List<HistoricalAttack> attacksOf(
            HistoricalPlayerData data, HistoricalWarType type
    ) {
        return data.attacks().stream().filter(attack -> attack.warType() == type).toList();
    }

    private static List<HistoricalParticipation> participationOf(
            HistoricalPlayerData data, HistoricalWarType type
    ) {
        return data.participation().stream().filter(item -> item.warType() == type).toList();
    }

    private static String optionalTag(String value) {
        return value == null || value.isBlank() ? null : CacheKeys.requireValidTag(value);
    }

    private record HistoricalRead(HistoricalPlayerData data, Exception failure) {}
}

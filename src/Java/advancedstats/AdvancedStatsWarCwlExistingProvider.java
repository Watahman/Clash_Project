package Java.advancedstats;

import Java.cache.CacheKeys;
import Java.cwlhistory.HistoricalCwlSeason;
import Java.cwlhistory.HistoricalCwlSeasonSummary;
import Java.cwlhistory.HistoricalCwlService;
import Java.performance.HistoricalPlayerData;
import Java.performance.HistoricalPlayerDataProvider;

import java.util.List;
import java.util.Map;

/** Adapts the existing performance and CWL services to the stats source boundary. */
public final class AdvancedStatsWarCwlExistingProvider
        implements AdvancedStatsWarCwlProvider {
    private final HistoricalPlayerDataProvider playerProvider;
    private final HistoricalCwlService cwlService;
    private final AdvancedStatsPlayerCwlHistory playerCwlHistory;

    public AdvancedStatsWarCwlExistingProvider(
            HistoricalPlayerDataProvider playerProvider,
            HistoricalCwlService cwlService
    ) {
        this(playerProvider, cwlService, null);
    }

    public AdvancedStatsWarCwlExistingProvider(
            HistoricalPlayerDataProvider playerProvider,
            HistoricalCwlService cwlService,
            AdvancedStatsPlayerCwlHistory playerCwlHistory
    ) {
        if (playerProvider == null) throw new IllegalArgumentException("playerProvider is required");
        this.playerProvider = playerProvider;
        this.cwlService = cwlService;
        this.playerCwlHistory = playerCwlHistory;
    }

    @Override
    public HistoricalPlayerData playerHistory(String playerTag) throws Exception {
        String tag = CacheKeys.requireValidTag(playerTag);
        Map<String, HistoricalPlayerData> result = playerProvider.getPlayerWarHistory(List.of(tag));
        return result == null ? null : result.get(tag);
    }

    @Override
    public List<HistoricalCwlSeasonSummary> cwlSeasons(String clanTag, int limit)
            throws Exception {
        if (cwlService == null) return List.of();
        return cwlService.getAvailableSeasons(CacheKeys.requireValidTag(clanTag), limit);
    }

    @Override
    public HistoricalCwlSeason cwlSeason(String clanTag, String season)
            throws Exception {
        if (cwlService == null) return null;
        return cwlService.getSeason(CacheKeys.requireValidTag(clanTag), season);
    }

    @Override
    public String sourceName() {
        return AdvancedStatsSourcePresentation.fromInternalId(playerProvider.providerName()).label();
    }

    @Override
    public List<AdvancedStatsWarCwlSeasonReader.SeasonData> playerCwlSeasons(
            String playerTag, int limit) throws Exception {
        return playerCwlHistory == null ? null
                : playerCwlHistory.seasons(CacheKeys.requireValidTag(playerTag), limit);
    }
}

package Java.cwlhistory;

import java.util.List;

public final class FallbackHistoricalCwlDataProvider
        implements HistoricalCwlDataProvider {
    private final HistoricalCwlDataProvider primary;
    private final HistoricalCwlDataProvider fallback;

    public FallbackHistoricalCwlDataProvider(
            HistoricalCwlDataProvider primary,
            HistoricalCwlDataProvider fallback
    ) {
        this.primary = primary;
        this.fallback = fallback;
    }

    @Override
    public List<HistoricalCwlSeasonSummary> getAvailableSeasons(
            String clanTag,
        int limit
    ) throws Exception {
        try {
            List<HistoricalCwlSeasonSummary> result =
                    primary.getAvailableSeasons(clanTag, limit);
            return result.isEmpty()
                    ? fallback.getAvailableSeasons(clanTag, limit)
                    : result;
        } catch (Exception primaryFailure) {
            return fallback.getAvailableSeasons(clanTag, limit);
        }
    }

    @Override
    public HistoricalCwlSeason getSeason(String clanTag, String season)
            throws Exception {
        try {
            return primary.getSeason(clanTag, season);
        } catch (Exception primaryFailure) {
            return fallback.getSeason(clanTag, season);
        }
    }

    @Override
    public String providerName() {
        return primary.providerName() + "-with-"
                + fallback.providerName() + "-fallback";
    }

    HistoricalCwlDataProvider primaryProvider() {
        return primary;
    }

    HistoricalCwlDataProvider fallbackProvider() {
        return fallback;
    }
}

package Java.cwlhistory;

import java.util.List;

public interface HistoricalCwlDataProvider {
    List<HistoricalCwlSeasonSummary> getAvailableSeasons(String clanTag, int limit)
            throws Exception;

    HistoricalCwlSeason getSeason(String clanTag, String season) throws Exception;

    default List<HistoricalCwlSeason> enrichOverview(
            String clanTag,
            List<HistoricalCwlSeason> seasons
    ) throws Exception {
        return seasons;
    }

    default void clearCaches() {}

    String providerName();
}

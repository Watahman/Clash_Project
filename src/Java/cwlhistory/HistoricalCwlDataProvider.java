package Java.cwlhistory;

import java.util.List;

public interface HistoricalCwlDataProvider {
    List<HistoricalCwlSeasonSummary> getAvailableSeasons(String clanTag, int limit)
            throws Exception;

    HistoricalCwlSeason getSeason(String clanTag, String season) throws Exception;

    String providerName();
}

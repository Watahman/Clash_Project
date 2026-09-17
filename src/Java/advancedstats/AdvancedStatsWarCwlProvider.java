package Java.advancedstats;

import Java.cwlhistory.HistoricalCwlSeason;
import Java.cwlhistory.HistoricalCwlSeasonSummary;
import Java.performance.HistoricalPlayerData;

import java.util.List;

/**
 * Bounded source boundary for the War and CWL Advanced Stats section.
 * Implementations must return normalized, ownership-independent source data.
 */
public interface AdvancedStatsWarCwlProvider {
    HistoricalPlayerData playerHistory(String playerTag) throws Exception;

    default List<HistoricalCwlSeasonSummary> cwlSeasons(String clanTag, int limit)
            throws Exception {
        return List.of();
    }

    default HistoricalCwlSeason cwlSeason(String clanTag, String season)
            throws Exception {
        return null;
    }

    String sourceName();
}

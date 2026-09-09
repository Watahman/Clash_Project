package Java.advancedstats;

import Java.advancedstats.AdvancedStatsHistoryModels.HistoryPage;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryRequest;

import java.time.Instant;

/** Source adapter contract. Implementations return normalized observations, never raw upstream payloads. */
public interface AdvancedStatsHistorySource {
    String sourceId();

    AdvancedStatsSourceCapabilities capabilities();

    /** Positive Unix-seconds season key for a season-partitioned scope, or blank when not applicable. */
    default String seasonKey(AdvancedStatsScope scope) {
        return "";
    }

    /**
     * Returns the season partition for one player at the requested collection time.
     * Sources that do not use a player-specific partition retain the legacy value.
     */
    default String seasonKey(AdvancedStatsScope scope, String playerTag, Instant requestedAt) {
        return seasonKey(scope);
    }

    HistoryPage fetch(HistoryRequest request) throws Exception;
}

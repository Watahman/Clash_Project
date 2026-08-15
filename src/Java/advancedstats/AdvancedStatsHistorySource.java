package Java.advancedstats;

import Java.advancedstats.AdvancedStatsHistoryModels.HistoryPage;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryRequest;

/** Source adapter contract. Implementations return normalized observations, never raw upstream payloads. */
public interface AdvancedStatsHistorySource {
    String sourceId();

    AdvancedStatsSourceCapabilities capabilities();

    /** Positive Unix-seconds season key for a season-partitioned scope, or blank when not applicable. */
    default String seasonKey(AdvancedStatsScope scope) {
        return "";
    }

    HistoryPage fetch(HistoryRequest request) throws Exception;
}

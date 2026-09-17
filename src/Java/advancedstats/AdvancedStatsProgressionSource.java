package Java.advancedstats;

import Java.advancedstats.AdvancedStatsProgressionModels.SourceData;

import java.time.Instant;

/** Provider boundary for dated progression evidence. */
public interface AdvancedStatsProgressionSource {
    String sourceId();

    /**
     * Fetches a bounded set of normalized events. Implementations must not return raw
     * upstream payloads and should report per-source failures in SourceData.
     */
    SourceData fetch(String playerTag, Instant observedAt) throws Exception;
}

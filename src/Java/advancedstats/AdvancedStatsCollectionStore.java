package Java.advancedstats;

import Java.advancedstats.AdvancedStatsCollectionModels.PageCommit;
import Java.advancedstats.AdvancedStatsCollectionModels.ScopeState;

import java.time.Instant;
import java.util.UUID;

/** Compact persistence contract. Implementations must aggregate and advance the checkpoint atomically. */
public interface AdvancedStatsCollectionStore {
    ScopeState load(UUID trackingId, AdvancedStatsScope scope) throws Exception;

    void markBootstrapStarted(UUID trackingId, AdvancedStatsScope scope, Instant startedAt) throws Exception;

    AdvancedStatsCollectionModels.PageApplyResult applyPageAndAdvance(PageCommit commit) throws Exception;

    default void switchRankedSeason(UUID trackingId, String playerTag, String workerId,
                                    String expectedSeasonKey, String newSeasonKey, Instant now) throws Exception {
        throw new UnsupportedOperationException("ranked season switching is not configured");
    }

    void markCapabilityUnavailable(UUID trackingId, AdvancedStatsScope scope,
                                   AdvancedStatsCapability capability, Instant observedAt) throws Exception;

    void markFailure(UUID trackingId, AdvancedStatsScope scope, String message, Instant failedAt) throws Exception;
}

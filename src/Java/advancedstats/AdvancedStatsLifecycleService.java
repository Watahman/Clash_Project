package Java.advancedstats;

import Java.HttpException;

import java.time.Clock;
import java.time.Instant;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Ownership-safe lifecycle orchestration. No battle collection happens here.
 */
public final class AdvancedStatsLifecycleService {
    public interface Store {
        Optional<AdvancedStatsModels.TrackingState> findTracking(UUID userId, String playerTag) throws Exception;
        AdvancedStatsModels.TrackingState startTracking(UUID userId, String playerTag) throws Exception;
        AdvancedStatsModels.TrackingState pauseTracking(UUID userId, String playerTag, Instant gapStartedAt) throws Exception;
        AdvancedStatsModels.TrackingState resumeTracking(UUID userId, String playerTag, Instant resumeRequestedAt) throws Exception;
        AdvancedStatsModels.TrackingState stopTracking(UUID userId, String playerTag, Instant gapStartedAt) throws Exception;
        boolean deleteTracking(UUID userId, String playerTag) throws Exception;
    }

    public interface Ownership {
        String requireLinkedAccount(UUID userId, String rawPlayerTag) throws Exception;
    }

    private final Store store;
    private final Ownership ownership;
    private final Clock clock;
    private final AdvancedStatsRolloutPolicy rolloutPolicy;

    public AdvancedStatsLifecycleService() {
        this(
                new AdvancedStatsRepository(),
                new AdvancedStatsAccountOwnership(),
                Clock.systemUTC(),
                new AdvancedStatsRolloutPolicy()
        );
    }

    AdvancedStatsLifecycleService(Store store, Ownership ownership, Clock clock) {
        this(store, ownership, clock, new AdvancedStatsRolloutPolicy(true, Set.of()));
    }

    AdvancedStatsLifecycleService(
            Store store,
            Ownership ownership,
            Clock clock,
            AdvancedStatsRolloutPolicy rolloutPolicy
    ) {
        this.store = store;
        this.ownership = ownership;
        this.clock = clock;
        this.rolloutPolicy = rolloutPolicy;
    }

    public AdvancedStatsModels.TrackingState start(UUID userId, String rawPlayerTag) throws Exception {
        rolloutPolicy.requireCanStart(userId);
        String playerTag = ownership.requireLinkedAccount(userId, rawPlayerTag);
        return store.startTracking(userId, playerTag);
    }

    public Optional<AdvancedStatsModels.TrackingState> status(UUID userId, String rawPlayerTag) throws Exception {
        String playerTag = ownership.requireLinkedAccount(userId, rawPlayerTag);
        return store.findTracking(userId, playerTag);
    }

    public AdvancedStatsModels.TrackingState pause(UUID userId, String rawPlayerTag) throws Exception {
        String playerTag = ownership.requireLinkedAccount(userId, rawPlayerTag);
        AdvancedStatsModels.TrackingState current = requireTracking(userId, playerTag);
        if (current.status() == AdvancedStatsTrackingStatus.PAUSED) return current;
        if (current.status() == AdvancedStatsTrackingStatus.STOPPED) {
            throw lifecycleConflict("Stopped tracking cannot be paused. Resume tracking first.");
        }

        Instant gapStartedAt = current.gapStartedAt() == null ? clock.instant() : current.gapStartedAt();
        return store.pauseTracking(userId, playerTag, gapStartedAt);
    }

    public AdvancedStatsModels.TrackingState resume(UUID userId, String rawPlayerTag) throws Exception {
        String playerTag = ownership.requireLinkedAccount(userId, rawPlayerTag);
        AdvancedStatsModels.TrackingState current = requireTracking(userId, playerTag);

        if (current.status() == AdvancedStatsTrackingStatus.ACTIVE
                || current.status() == AdvancedStatsTrackingStatus.INITIALIZING) {
            return current;
        }

        return store.resumeTracking(userId, playerTag, clock.instant());
    }

    public Optional<AdvancedStatsModels.TrackingState> stop(UUID userId, String rawPlayerTag) throws Exception {
        String playerTag = ownership.requireLinkedAccount(userId, rawPlayerTag);
        Optional<AdvancedStatsModels.TrackingState> existing = store.findTracking(userId, playerTag);
        if (existing.isEmpty()) return Optional.empty();
        AdvancedStatsModels.TrackingState current = existing.get();
        if (current.status() == AdvancedStatsTrackingStatus.STOPPED) return existing;

        Instant gapStartedAt = current.gapStartedAt() == null ? clock.instant() : current.gapStartedAt();
        return Optional.of(store.stopTracking(userId, playerTag, gapStartedAt));
    }

    public boolean delete(UUID userId, String rawPlayerTag) throws Exception {
        String playerTag = ownership.requireLinkedAccount(userId, rawPlayerTag);
        return store.deleteTracking(userId, playerTag);
    }

    private AdvancedStatsModels.TrackingState requireTracking(UUID userId, String playerTag) throws Exception {
        return store.findTracking(userId, playerTag).orElseThrow(() -> new HttpException(
                404,
                "{\"error\":\"Advanced Stats tracking is niet ingeschakeld\",\"code\":\"ADVANCED_STATS_NOT_ENABLED\"}"
        ));
    }

    private HttpException lifecycleConflict(String message) {
        return new HttpException(
                409,
                "{\"error\":\"" + escapeJson(message) + "\",\"code\":\"ADVANCED_STATS_STATE_CONFLICT\"}"
        );
    }

    private String escapeJson(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
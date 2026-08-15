package Java.advancedstats;

import Java.advancedstats.AdvancedStatsHistoryModels.Checkpoint;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryPage;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** Durable-state boundary for compact Advanced Stats collection. Raw attacks do not cross this boundary. */
public final class AdvancedStatsCollectionModels {
    private AdvancedStatsCollectionModels() {}

    public enum BootstrapStatus {
        PENDING,
        RUNNING,
        COMPLETE,
        PARTIAL,
        FAILED,
        UNSUPPORTED
    }

    public record ScopeState(
            UUID trackingId,
            String playerTag,
            AdvancedStatsScope scope,
            BootstrapStatus bootstrapStatus,
            Checkpoint checkpoint,
            AdvancedStatsCapabilityStatus capabilityStatus,
            String sourceSeasonKey,
            String sourceId,
            long observationsProcessed,
            Instant lastAttemptAt,
            Instant lastSuccessAt,
            String lastError
    ) {
        public ScopeState {
            Objects.requireNonNull(trackingId, "trackingId");
            if (playerTag == null || playerTag.isBlank()) throw new IllegalArgumentException("playerTag is required");
            Objects.requireNonNull(scope, "scope");
            Objects.requireNonNull(bootstrapStatus, "bootstrapStatus");
            checkpoint = checkpoint == null ? Checkpoint.initial() : checkpoint;
            Objects.requireNonNull(capabilityStatus, "capabilityStatus");
            sourceSeasonKey = normalize(sourceSeasonKey);
            if (scope != AdvancedStatsScope.RANKED && !sourceSeasonKey.isBlank()) {
                throw new IllegalArgumentException("season key is only valid for ranked scope");
            }
            sourceId = normalize(sourceId);
            if (observationsProcessed < 0) throw new IllegalArgumentException("observationsProcessed cannot be negative");
            lastError = normalize(lastError);
        }

        public ScopeState(UUID trackingId, String playerTag, AdvancedStatsScope scope,
                          BootstrapStatus bootstrapStatus, Checkpoint checkpoint,
                          AdvancedStatsCapabilityStatus capabilityStatus, String sourceId,
                          long observationsProcessed, Instant lastAttemptAt, Instant lastSuccessAt,
                          String lastError) {
            this(trackingId, playerTag, scope, bootstrapStatus, checkpoint, capabilityStatus,
                    "", sourceId, observationsProcessed, lastAttemptAt, lastSuccessAt, lastError);
        }

        public boolean bootstrapped() {
            return bootstrapStatus == BootstrapStatus.COMPLETE
                    || bootstrapStatus == BootstrapStatus.PARTIAL
                    || bootstrapStatus == BootstrapStatus.UNSUPPORTED;
        }
    }

    public record PageCommit(
            UUID trackingId,
            String playerTag,
            AdvancedStatsScope scope,
            AdvancedStatsCapabilityOperation operation,
            Checkpoint expectedCheckpoint,
            AdvancedStatsCapability capability,
            HistoryPage page,
            Instant committedAt
    ) {
        public PageCommit {
            Objects.requireNonNull(trackingId, "trackingId");
            if (playerTag == null || playerTag.isBlank()) throw new IllegalArgumentException("playerTag is required");
            Objects.requireNonNull(scope, "scope");
            Objects.requireNonNull(operation, "operation");
            expectedCheckpoint = expectedCheckpoint == null ? Checkpoint.initial() : expectedCheckpoint;
            Objects.requireNonNull(capability, "capability");
            Objects.requireNonNull(page, "page");
            Objects.requireNonNull(committedAt, "committedAt");
            page.observations().forEach(observation -> {
                if (observation.scope() != scope) {
                    throw new IllegalArgumentException("observation scope does not match page scope");
                }
            });
        }
    }

    public record PageApplyResult(ScopeState state, int inserted, int duplicates, int skipped) {
        public PageApplyResult {
            Objects.requireNonNull(state, "state");
            if (inserted < 0 || duplicates < 0 || skipped < 0) {
                throw new IllegalArgumentException("page counters cannot be negative");
            }
        }
    }

    public record CollectionResult(
            UUID trackingId,
            AdvancedStatsScope scope,
            AdvancedStatsCapabilityStatus capabilityStatus,
            BootstrapStatus status,
            int observationsSeen,
            long observationsProcessed,
            int inserted,
            int duplicates,
            int skipped,
            Checkpoint checkpoint,
            String sourceId,
            String message
    ) {
        public CollectionResult {
            Objects.requireNonNull(trackingId, "trackingId");
            Objects.requireNonNull(scope, "scope");
            Objects.requireNonNull(capabilityStatus, "capabilityStatus");
            Objects.requireNonNull(status, "status");
            if (observationsSeen < 0 || observationsProcessed < 0 || inserted < 0 || duplicates < 0 || skipped < 0
                    || inserted + duplicates + skipped > observationsSeen) {
                throw new IllegalArgumentException("observation counts cannot be negative");
            }
            checkpoint = checkpoint == null ? Checkpoint.initial() : checkpoint;
            sourceId = normalize(sourceId);
            message = normalize(message);
        }

        public static CollectionResult unsupported(UUID trackingId, AdvancedStatsScope scope,
                                                    AdvancedStatsCapability capability) {
            return new CollectionResult(trackingId, scope, capability.status(), BootstrapStatus.UNSUPPORTED,
                    0, 0, 0, 0, 0, Checkpoint.initial(), capability.sourceId(), capability.reason());
        }

        public CollectionResult(UUID trackingId, AdvancedStatsScope scope,
                                AdvancedStatsCapabilityStatus capabilityStatus, BootstrapStatus status,
                                int observationsSeen, long observationsProcessed, Checkpoint checkpoint,
                                String sourceId, String message) {
            this(trackingId, scope, capabilityStatus, status, observationsSeen, observationsProcessed,
                    0, 0, 0, checkpoint, sourceId, message);
        }
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}

package Java.advancedstats;

import Java.advancedstats.AdvancedStatsCollectionModels.BootstrapStatus;
import Java.advancedstats.AdvancedStatsCollectionModels.CollectionResult;
import Java.advancedstats.AdvancedStatsCollectionModels.ScopeState;
import Java.advancedstats.AdvancedStatsHistoryModels.Checkpoint;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryRequest;

import java.time.Instant;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/** Coordinates explicit all-history bootstrap and later one-page incremental passes per scope. */
public final class AdvancedStatsCollectionCoordinator {
    private final AdvancedStatsHistorySource source;
    private final AdvancedStatsCollectionStore store;
    private final AdvancedStatsScopedCollector collector;

    public AdvancedStatsCollectionCoordinator(AdvancedStatsHistorySource source, AdvancedStatsCollectionStore store) {
        this.source = Objects.requireNonNull(source, "source");
        this.store = Objects.requireNonNull(store, "store");
        this.collector = new AdvancedStatsScopedCollector(source, store);
    }

    public RunResult bootstrap(UUID trackingId, String playerTag, int pageSize, int maxPages,
                               Instant requestedAt) throws Exception {
        return run(trackingId, playerTag, pageSize, maxPages, requestedAt,
                AdvancedStatsCapabilityOperation.BOOTSTRAP, EnumSet.allOf(AdvancedStatsScope.class));
    }

    public RunResult incremental(UUID trackingId, String playerTag, int pageSize,
                                 Instant requestedAt) throws Exception {
        return run(trackingId, playerTag, pageSize, 1, requestedAt,
                AdvancedStatsCapabilityOperation.INCREMENTAL, EnumSet.allOf(AdvancedStatsScope.class));
    }

    public RunResult run(UUID trackingId, String playerTag, int pageSize, int maxPages, Instant requestedAt,
                         AdvancedStatsCapabilityOperation operation, EnumSet<AdvancedStatsScope> scopes)
            throws Exception {
        if (trackingId == null || playerTag == null || playerTag.isBlank()) {
            throw new IllegalArgumentException("tracking identity is required");
        }
        if (maxPages < 1) throw new IllegalArgumentException("maxPages must be positive");
        Objects.requireNonNull(requestedAt, "requestedAt");
        Objects.requireNonNull(operation, "operation");
        Objects.requireNonNull(scopes, "scopes");
        EnumMap<AdvancedStatsScope, CollectionResult> results = new EnumMap<>(AdvancedStatsScope.class);
        for (AdvancedStatsScope scope : scopes) {
            results.put(scope, collectScope(trackingId, playerTag, scope, pageSize, maxPages,
                    requestedAt, operation));
        }
        return new RunResult(operation, results);
    }

    private CollectionResult collectScope(UUID trackingId, String playerTag, AdvancedStatsScope scope,
                                          int pageSize, int maxPages, Instant requestedAt,
                                          AdvancedStatsCapabilityOperation operation) throws Exception {
        CollectionResult result = null;
        for (int page = 0; page < maxPages; page++) {
            ScopeState state = store.load(trackingId, scope);
            Checkpoint checkpoint = state == null ? Checkpoint.initial() : state.checkpoint();
            if (operation == AdvancedStatsCapabilityOperation.INCREMENTAL
                    && state != null && state.bootstrapStatus() == BootstrapStatus.UNSUPPORTED) {
                return terminalUnsupported(trackingId, scope, state);
            }
            HistoryRequest request = new HistoryRequest(trackingId, playerTag, scope, operation,
                    checkpoint, pageSize, requestedAt);
            result = collector.collect(request);
            if (result.status() != BootstrapStatus.RUNNING) return result;
        }
        return result;
    }

    private CollectionResult terminalUnsupported(UUID trackingId, AdvancedStatsScope scope, ScopeState state) {
        return new CollectionResult(trackingId, scope, state.capabilityStatus(), BootstrapStatus.UNSUPPORTED,
                0, state.observationsProcessed(), state.checkpoint(), state.sourceId(), state.lastError());
    }

    public record RunResult(AdvancedStatsCapabilityOperation operation,
                            Map<AdvancedStatsScope, CollectionResult> scopes) {
        public RunResult {
            Objects.requireNonNull(operation, "operation");
            EnumMap<AdvancedStatsScope, CollectionResult> copy = new EnumMap<>(AdvancedStatsScope.class);
            if (scopes != null) copy.putAll(scopes);
            scopes = Map.copyOf(copy);
        }

        public boolean complete() {
            return scopes.values().stream().allMatch(result -> result.status() == BootstrapStatus.COMPLETE);
        }

        public boolean hasPartialCoverage() {
            return scopes.values().stream().anyMatch(result -> result.status() == BootstrapStatus.PARTIAL);
        }

        public boolean terminal() {
            return scopes.values().stream().allMatch(result -> result.status() == BootstrapStatus.COMPLETE
                    || result.status() == BootstrapStatus.PARTIAL
                    || result.status() == BootstrapStatus.UNSUPPORTED);
        }
    }
}

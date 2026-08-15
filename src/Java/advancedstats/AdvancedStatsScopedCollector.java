package Java.advancedstats;

import Java.advancedstats.AdvancedStatsCollectionModels.BootstrapStatus;
import Java.advancedstats.AdvancedStatsCollectionModels.CollectionResult;
import Java.advancedstats.AdvancedStatsCollectionModels.PageCommit;
import Java.advancedstats.AdvancedStatsCollectionModels.PageApplyResult;
import Java.advancedstats.AdvancedStatsCollectionModels.ScopeState;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryPage;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryRequest;

import java.time.Instant;
import java.util.Objects;

/** Orchestrates bootstrap and cursor-based collection while keeping raw source data transient. */
public final class AdvancedStatsScopedCollector {
    private final AdvancedStatsHistorySource source;
    private final AdvancedStatsCollectionStore store;

    public AdvancedStatsScopedCollector(AdvancedStatsHistorySource source, AdvancedStatsCollectionStore store) {
        this.source = Objects.requireNonNull(source, "source");
        this.store = Objects.requireNonNull(store, "store");
    }

    public CollectionResult collect(HistoryRequest request) throws Exception {
        Objects.requireNonNull(request, "request");
        AdvancedStatsCapability capability = source.capabilities()
                .forOperation(request.scope(), request.operation());
        if (!capability.usable()) return unavailable(request, capability);
        ScopeState state = store.load(request.trackingId(), request.scope());
        validateCheckpoint(request, state);
        if (request.operation() == AdvancedStatsCapabilityOperation.BOOTSTRAP) {
            store.markBootstrapStarted(request.trackingId(), request.scope(), request.requestedAt());
        }
        try {
            HistoryPage page = source.fetch(request);
            if (page.coverage() == AdvancedStatsHistoryModels.Coverage.UNAVAILABLE) {
                String message = page.provenance().sourceId() + " reported unavailable coverage";
                store.markFailure(request.trackingId(), request.scope(), message, Instant.now());
                return failed(request, capability, new IllegalStateException(message));
            }
            return commit(request, effectiveCapability(request, capability, page), state, page);
        } catch (UnsupportedOperationException unsupported) {
            AdvancedStatsCapability unavailable = unsupportedCapability(capability, unsupported.getMessage());
            store.markCapabilityUnavailable(request.trackingId(), request.scope(), unavailable, Instant.now());
            return CollectionResult.unsupported(request.trackingId(), request.scope(), unavailable);
        } catch (AdvancedStatsSourceUnavailableException unavailable) {
            store.markFailure(request.trackingId(), request.scope(), unavailable.getMessage(), Instant.now());
            return failed(request, capability, unavailable);
        } catch (Exception failure) {
            store.markFailure(request.trackingId(), request.scope(), failure.getMessage(), Instant.now());
            return failed(request, capability, failure);
        }
    }

    private CollectionResult commit(HistoryRequest request, AdvancedStatsCapability capability,
                                    ScopeState state, HistoryPage page) throws Exception {
        PageCommit commit = new PageCommit(request.trackingId(), request.playerTag(), request.scope(), request.operation(),
                state.checkpoint(), capability, page, request.requestedAt());
        PageApplyResult applied = store.applyPageAndAdvance(commit);
        ScopeState updated = applied.state();
        return new CollectionResult(request.trackingId(), request.scope(), capability.status(),
                updated.bootstrapStatus(), page.observations().size(), updated.observationsProcessed(),
                applied.inserted(), applied.duplicates(), applied.skipped(),
                updated.checkpoint(), page.provenance().sourceId(), page.coverage().name());
    }

    private AdvancedStatsCapability effectiveCapability(HistoryRequest request,
                                                        AdvancedStatsCapability declared,
                                                        HistoryPage page) {
        AdvancedStatsCapabilityStatus status = page.coverage() == AdvancedStatsHistoryModels.Coverage.PARTIAL
                ? AdvancedStatsCapabilityStatus.PARTIAL : declared.status();
        String reason = page.provenance().note();
        if (status == AdvancedStatsCapabilityStatus.PARTIAL && reason.isBlank()) {
            reason = "source reported partial coverage";
        }
        if (status == AdvancedStatsCapabilityStatus.SUPPORTED) reason = "";
        return new AdvancedStatsCapability(request.scope(), request.operation(), status,
                page.provenance().sourceId(), reason);
    }

    private void validateCheckpoint(HistoryRequest request, ScopeState state) {
        if (state == null) throw new IllegalStateException("scope state is missing");
        if (!state.checkpoint().equals(request.checkpoint())) {
            throw new IllegalStateException("scope checkpoint changed; retry with the latest cursor");
        }
        if (request.operation() == AdvancedStatsCapabilityOperation.INCREMENTAL && !state.bootstrapped()) {
            throw new IllegalStateException("incremental collection requires completed bootstrap");
        }
    }

    private CollectionResult unavailable(HistoryRequest request, AdvancedStatsCapability capability) throws Exception {
        store.markCapabilityUnavailable(request.trackingId(), request.scope(), capability, request.requestedAt());
        return CollectionResult.unsupported(request.trackingId(), request.scope(), capability);
    }

    private AdvancedStatsCapability unsupportedCapability(AdvancedStatsCapability capability, String message) {
        if (capability.status() == AdvancedStatsCapabilityStatus.UNSUPPORTED) return capability;
        String reason = message == null || message.isBlank()
                ? "source rejected this scope at runtime" : message.trim();
        return new AdvancedStatsCapability(capability.scope(), capability.operation(),
                AdvancedStatsCapabilityStatus.UNSUPPORTED, capability.sourceId(), reason);
    }

    private static CollectionResult failed(HistoryRequest request, AdvancedStatsCapability capability, Exception failure) {
        return new CollectionResult(request.trackingId(), request.scope(), capability.status(), BootstrapStatus.FAILED,
                0, 0, request.checkpoint(), capability.sourceId(), normalizeFailure(failure));
    }

    private static String normalizeFailure(Exception failure) {
        String message = failure.getMessage();
        return message == null || message.isBlank() ? failure.getClass().getSimpleName() : message.trim();
    }
}

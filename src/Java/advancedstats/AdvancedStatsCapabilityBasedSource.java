package Java.advancedstats;

import Java.advancedstats.AdvancedStatsHistoryModels.HistoryPage;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryRequest;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/** Selects the first declared source that can serve each capability. */
public final class AdvancedStatsCapabilityBasedSource implements AdvancedStatsHistorySource {
    private final List<AdvancedStatsHistorySource> sources;
    private final AdvancedStatsSourceCapabilities capabilities;

    public AdvancedStatsCapabilityBasedSource(List<AdvancedStatsHistorySource> sources) {
        if (sources == null || sources.isEmpty()) throw new IllegalArgumentException("at least one source is required");
        this.sources = List.copyOf(sources);
        this.capabilities = buildCapabilities(this.sources);
    }

    @Override
    public String sourceId() {
        return "capability-chain";
    }

    @Override
    public AdvancedStatsSourceCapabilities capabilities() {
        return capabilities;
    }

    @Override
    public String seasonKey(AdvancedStatsScope scope) {
        for (AdvancedStatsHistorySource source : sources) {
            String season = source.seasonKey(scope);
            if (season != null && !season.isBlank()) return season.trim();
        }
        return "";
    }

    @Override
    public HistoryPage fetch(HistoryRequest request) throws Exception {
        Objects.requireNonNull(request, "request");
        AdvancedStatsCapability selected = capabilities.forOperation(request.scope(), request.operation());
        if (!selected.usable()) {
            throw new UnsupportedOperationException(selected.reason());
        }
        AdvancedStatsHistorySource primary = sourceFor(selected.sourceId());
        Exception failure = null;
        for (AdvancedStatsHistorySource candidate : fallbackCandidates(primary, request)) {
            try {
                HistoryPage page = candidate.fetch(request);
                if (page.coverage() == AdvancedStatsHistoryModels.Coverage.UNAVAILABLE) {
                    throw new AdvancedStatsSourceUnavailableException(candidate.sourceId() + " returned unavailable");
                }
                return page;
            } catch (Exception candidateFailure) {
                if (failure == null) failure = candidateFailure;
                else failure.addSuppressed(candidateFailure);
            }
        }
        throw failure == null ? new IllegalStateException("No source candidate is configured") : failure;
    }

    private AdvancedStatsHistorySource sourceFor(String sourceId) {
        return sources.stream().filter(source -> source.sourceId().equals(sourceId)).findFirst()
                .orElseThrow(() -> new IllegalStateException("Capability source is not configured: " + sourceId));
    }

    private List<AdvancedStatsHistorySource> fallbackCandidates(
            AdvancedStatsHistorySource primary, HistoryRequest request) {
        List<AdvancedStatsHistorySource> candidates = new ArrayList<>();
        candidates.add(primary);
        for (AdvancedStatsHistorySource source : sources) {
            if (source == primary) continue;
            if (source.capabilities().usable(request.scope(), request.operation())) candidates.add(source);
        }
        return candidates;
    }

    private static AdvancedStatsSourceCapabilities buildCapabilities(List<AdvancedStatsHistorySource> sources) {
        List<AdvancedStatsCapability> declarations = new ArrayList<>();
        for (AdvancedStatsScope scope : AdvancedStatsScope.values()) {
            for (AdvancedStatsCapabilityOperation operation : AdvancedStatsCapabilityOperation.values()) {
                declarations.add(select(sources, scope, operation));
            }
        }
        return new AdvancedStatsSourceCapabilities(declarations);
    }

    private static AdvancedStatsCapability select(
            List<AdvancedStatsHistorySource> sources,
            AdvancedStatsScope scope,
            AdvancedStatsCapabilityOperation operation
    ) {
        AdvancedStatsCapability partial = null;
        for (AdvancedStatsHistorySource source : sources) {
            Objects.requireNonNull(source, "source");
            AdvancedStatsCapability capability = source.capabilities().forOperation(scope, operation);
            if (capability.status() == AdvancedStatsCapabilityStatus.SUPPORTED) return capability;
            if (capability.status() == AdvancedStatsCapabilityStatus.PARTIAL && partial == null) partial = capability;
        }
        if (partial != null) return partial;
        return new AdvancedStatsCapability(scope, operation, AdvancedStatsCapabilityStatus.UNSUPPORTED,
                "capability-chain", "no configured source supports this scope and operation");
    }
}

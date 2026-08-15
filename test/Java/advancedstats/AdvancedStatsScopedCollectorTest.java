package Java.advancedstats;

import Java.advancedstats.AdvancedStatsCollectionModels.BootstrapStatus;
import Java.advancedstats.AdvancedStatsCollectionModels.PageCommit;
import Java.advancedstats.AdvancedStatsCollectionModels.ScopeState;
import Java.advancedstats.AdvancedStatsHistoryModels.AttackObservation;
import Java.advancedstats.AdvancedStatsHistoryModels.Checkpoint;
import Java.advancedstats.AdvancedStatsHistoryModels.Coverage;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryPage;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryRequest;
import Java.advancedstats.AdvancedStatsHistoryModels.Provenance;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AdvancedStatsScopedCollectorTest {
    private static final UUID TRACKING_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final Instant NOW = Instant.parse("2026-08-14T20:00:00Z");

    @Test
    void commitsBootstrapBeforeIncrementalAndCarriesOpaqueCheckpoint() throws Exception {
        FakeSource source = new FakeSource();
        FakeStore store = new FakeStore();
        AdvancedStatsScopedCollector collector = new AdvancedStatsScopedCollector(source, store);

        var bootstrap = collector.collect(request(AdvancedStatsCapabilityOperation.BOOTSTRAP,
                Checkpoint.initial()));
        var incremental = collector.collect(request(AdvancedStatsCapabilityOperation.INCREMENTAL,
                new Checkpoint("bootstrap-cursor", NOW)));

        assertEquals(BootstrapStatus.COMPLETE, bootstrap.status());
        assertEquals(BootstrapStatus.COMPLETE, incremental.status());
        assertEquals(2, store.commits);
        assertEquals(new Checkpoint("incremental-cursor", NOW), incremental.checkpoint());
        assertEquals(List.of(Checkpoint.initial(), new Checkpoint("bootstrap-cursor", NOW)), source.requests);
    }

    @Test
    void unsupportedScopeIsPersistedAsExplicitStatus() throws Exception {
        FakeSource source = new FakeSource();
        FakeStore store = new FakeStore();
        AdvancedStatsScopedCollector collector = new AdvancedStatsScopedCollector(source, store);
        HistoryRequest request = new HistoryRequest(TRACKING_ID, "#P0Y8LQ", AdvancedStatsScope.RANKED_LEGEND,
                AdvancedStatsCapabilityOperation.BOOTSTRAP, Checkpoint.initial(), 50, NOW);

        var result = collector.collect(request);

        assertEquals(BootstrapStatus.UNSUPPORTED, result.status());
        assertEquals(1, store.unavailableCalls);
        assertEquals(0, store.commits);
    }

    @Test
    void incrementalCollectionCannotBypassBootstrap() {
        FakeSource source = new FakeSource();
        FakeStore store = new FakeStore();
        AdvancedStatsScopedCollector collector = new AdvancedStatsScopedCollector(source, store);

        assertThrows(IllegalStateException.class,
                () -> collector.collect(request(AdvancedStatsCapabilityOperation.INCREMENTAL,
                        Checkpoint.initial())));
    }

    @Test
    void persistsRuntimePageProvenanceAsTheEffectiveSource() throws Exception {
        FakeSource source = new FakeSource();
        source.provenanceSourceId = "legacy-war-history";
        source.coverage = Coverage.PARTIAL;
        FakeStore store = new FakeStore();

        var result = new AdvancedStatsScopedCollector(source, store).collect(
                request(AdvancedStatsCapabilityOperation.BOOTSTRAP, Checkpoint.initial()));

        assertEquals("legacy-war-history", store.lastCapability.sourceId());
        assertEquals(AdvancedStatsCapabilityStatus.PARTIAL, store.lastCapability.status());
        assertEquals(BootstrapStatus.PARTIAL, result.status());
    }

    private static HistoryRequest request(AdvancedStatsCapabilityOperation operation, Checkpoint checkpoint) {
        return new HistoryRequest(TRACKING_ID, "#P0Y8LQ", AdvancedStatsScope.NORMAL, operation,
                checkpoint, 100, NOW);
    }

    private static final class FakeSource implements AdvancedStatsHistorySource {
        private final AdvancedStatsSourceCapabilities capabilities = new AdvancedStatsSourceCapabilities(List.of(
                new AdvancedStatsCapability(AdvancedStatsScope.NORMAL,
                        AdvancedStatsCapabilityOperation.BOOTSTRAP, AdvancedStatsCapabilityStatus.SUPPORTED, "test", ""),
                new AdvancedStatsCapability(AdvancedStatsScope.NORMAL,
                        AdvancedStatsCapabilityOperation.INCREMENTAL, AdvancedStatsCapabilityStatus.SUPPORTED, "test", "")));
        private final List<Checkpoint> requests = new java.util.ArrayList<>();
        private String provenanceSourceId = "test";
        private Coverage coverage = Coverage.COMPLETE;

        @Override
        public String sourceId() {
            return "test";
        }

        @Override
        public AdvancedStatsSourceCapabilities capabilities() {
            return capabilities;
        }

        @Override
        public HistoryPage fetch(HistoryRequest request) {
            requests.add(request.checkpoint());
            String cursor = request.operation() == AdvancedStatsCapabilityOperation.BOOTSTRAP
                    ? "bootstrap-cursor" : "incremental-cursor";
            AttackObservation observation = new AttackObservation("event-" + requests.size(), request.scope(), NOW,
                    true, "normal", "#9GCUV", 16, 16, 3, 100d, List.of(), 0, 0, 0);
            return new HistoryPage(List.of(observation), new Checkpoint(cursor, NOW), false,
                    coverage, new Provenance(provenanceSourceId, "1", NOW,
                    coverage == Coverage.PARTIAL ? "runtime source is partial" : ""));
        }
    }

    private static final class FakeStore implements AdvancedStatsCollectionStore {
        private final Map<AdvancedStatsScope, ScopeState> states = new EnumMap<>(AdvancedStatsScope.class);
        private int commits;
        private int unavailableCalls;
        private AdvancedStatsCapability lastCapability;

        private FakeStore() {
            states.put(AdvancedStatsScope.NORMAL, new ScopeState(TRACKING_ID, "#P0Y8LQ", AdvancedStatsScope.NORMAL,
                    BootstrapStatus.PENDING, Checkpoint.initial(), AdvancedStatsCapabilityStatus.SUPPORTED,
                    "test", 0, null, null, ""));
        }

        @Override
        public ScopeState load(UUID trackingId, AdvancedStatsScope scope) {
            return states.getOrDefault(scope, new ScopeState(trackingId, "#P0Y8LQ", scope,
                    BootstrapStatus.PENDING, Checkpoint.initial(), AdvancedStatsCapabilityStatus.UNSUPPORTED,
                    "test", 0, null, null, ""));
        }

        @Override
        public void markBootstrapStarted(UUID trackingId, AdvancedStatsScope scope, Instant startedAt) {
            ScopeState state = states.get(scope);
            if (state != null) states.put(scope, withStatus(state, BootstrapStatus.RUNNING));
        }

        @Override
        public AdvancedStatsCollectionModels.PageApplyResult applyPageAndAdvance(PageCommit commit) {
            lastCapability = commit.capability();
            ScopeState state = states.get(commit.scope());
            long processed = state.observationsProcessed() + commit.page().observations().size();
            BootstrapStatus status = commit.operation() == AdvancedStatsCapabilityOperation.BOOTSTRAP
                    ? (commit.page().coverage() == Coverage.PARTIAL ? BootstrapStatus.PARTIAL : BootstrapStatus.COMPLETE)
                    : state.bootstrapStatus();
            ScopeState updated = new ScopeState(state.trackingId(), state.playerTag(), state.scope(), status,
                    commit.page().nextCheckpoint(), commit.capability().status(), commit.capability().sourceId(),
                    processed, commit.committedAt(), commit.committedAt(), "");
            states.put(commit.scope(), updated);
            commits++;
            return new AdvancedStatsCollectionModels.PageApplyResult(updated,
                    commit.page().observations().size(), 0, 0);
        }

        @Override
        public void markCapabilityUnavailable(UUID trackingId, AdvancedStatsScope scope,
                                               AdvancedStatsCapability capability, Instant observedAt) {
            unavailableCalls++;
        }

        @Override
        public void markFailure(UUID trackingId, AdvancedStatsScope scope, String message, Instant failedAt) {}

        private static ScopeState withStatus(ScopeState state, BootstrapStatus status) {
            return new ScopeState(state.trackingId(), state.playerTag(), state.scope(), status,
                    state.checkpoint(), state.capabilityStatus(), state.sourceId(), state.observationsProcessed(),
                    state.lastAttemptAt(), state.lastSuccessAt(), state.lastError());
        }
    }
}

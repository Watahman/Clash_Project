package Java.advancedstats;

import Java.advancedstats.AdvancedStatsHistoryModels.AttackObservation;
import Java.advancedstats.AdvancedStatsHistoryModels.Checkpoint;
import Java.advancedstats.AdvancedStatsHistoryModels.Coverage;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryPage;
import Java.advancedstats.AdvancedStatsHistoryModels.Provenance;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AdvancedStatsCapabilitySourceTest {
    private static final Instant NOW = Instant.parse("2026-08-14T20:00:00Z");

    @Test
    void selectsDeclaredLegacyFallbackWithoutKnowingProviderRoutes() throws Exception {
        FakeSource v2 = new FakeSource("v2", List.of(
                capability(AdvancedStatsScope.NORMAL, AdvancedStatsCapabilityOperation.BOOTSTRAP,
                        AdvancedStatsCapabilityStatus.SUPPORTED, ""),
                capability(AdvancedStatsScope.NORMAL, AdvancedStatsCapabilityOperation.INCREMENTAL,
                        AdvancedStatsCapabilityStatus.PARTIAL, "limited coverage")));
        FakeSource legacy = new FakeSource("legacy", List.of(
                capability(AdvancedStatsScope.WAR, AdvancedStatsCapabilityOperation.BOOTSTRAP,
                        AdvancedStatsCapabilityStatus.SUPPORTED, ""),
                capability(AdvancedStatsScope.WAR, AdvancedStatsCapabilityOperation.INCREMENTAL,
                        AdvancedStatsCapabilityStatus.SUPPORTED, "")));

        AdvancedStatsCapabilityBasedSource source = new AdvancedStatsCapabilityBasedSource(List.of(v2, legacy));
        source.fetch(request(AdvancedStatsScope.NORMAL, AdvancedStatsCapabilityOperation.BOOTSTRAP));
        source.fetch(request(AdvancedStatsScope.WAR, AdvancedStatsCapabilityOperation.BOOTSTRAP));

        assertEquals(1, v2.fetches);
        assertEquals(1, legacy.fetches);
        assertEquals(AdvancedStatsCapabilityStatus.PARTIAL,
                source.capabilities().forOperation(AdvancedStatsScope.NORMAL,
                        AdvancedStatsCapabilityOperation.INCREMENTAL).status());
        assertEquals(AdvancedStatsCapabilityStatus.UNSUPPORTED,
                source.capabilities().forOperation(AdvancedStatsScope.RANKED_LEGEND,
                        AdvancedStatsCapabilityOperation.BOOTSTRAP).status());
    }

    @Test
    void rejectsUnknownScopeAndKeepsUnsupportedExplicit() {
        assertThrows(IllegalArgumentException.class, () -> AdvancedStatsScope.parse("seasonal"));
        AdvancedStatsSourceCapabilities capabilities = new AdvancedStatsSourceCapabilities(List.of());
        assertEquals(AdvancedStatsCapabilityStatus.UNSUPPORTED,
                capabilities.forOperation(AdvancedStatsScope.WAR,
                        AdvancedStatsCapabilityOperation.BOOTSTRAP).status());
    }

    @Test
    void fallsBackPerScopeWhenPrimaryFailsAtRuntime() throws Exception {
        FakeSource primary = new FakeSource("v2", List.of(
                capability(AdvancedStatsScope.WAR, AdvancedStatsCapabilityOperation.BOOTSTRAP,
                        AdvancedStatsCapabilityStatus.SUPPORTED, "")));
        primary.fail = true;
        FakeSource legacy = new FakeSource("legacy", List.of(
                capability(AdvancedStatsScope.WAR, AdvancedStatsCapabilityOperation.BOOTSTRAP,
                        AdvancedStatsCapabilityStatus.SUPPORTED, "")));

        AdvancedStatsCapabilityBasedSource source = new AdvancedStatsCapabilityBasedSource(List.of(primary, legacy));
        source.fetch(request(AdvancedStatsScope.WAR, AdvancedStatsCapabilityOperation.BOOTSTRAP));

        assertEquals(1, primary.fetches);
        assertEquals(1, legacy.fetches);
    }

    private static AdvancedStatsCapability capability(AdvancedStatsScope scope,
                                                       AdvancedStatsCapabilityOperation operation,
                                                       AdvancedStatsCapabilityStatus status,
                                                       String reason) {
        return new AdvancedStatsCapability(scope, operation, status, "declared", reason);
    }

    private static AdvancedStatsHistoryModels.HistoryRequest request(
            AdvancedStatsScope scope, AdvancedStatsCapabilityOperation operation) {
        return new AdvancedStatsHistoryModels.HistoryRequest(
                java.util.UUID.randomUUID(), "#P0Y8LQ", scope, operation,
                Checkpoint.initial(), 50, NOW);
    }

    private static final class FakeSource implements AdvancedStatsHistorySource {
        private final String id;
        private final AdvancedStatsSourceCapabilities capabilities;
        private int fetches;
        private boolean fail;

        private FakeSource(String id, List<AdvancedStatsCapability> declarations) {
            this.id = id;
            this.capabilities = new AdvancedStatsSourceCapabilities(declarations.stream()
                    .map(declaration -> new AdvancedStatsCapability(declaration.scope(), declaration.operation(),
                            declaration.status(), id, declaration.reason())).toList());
        }

        @Override
        public String sourceId() {
            return id;
        }

        @Override
        public AdvancedStatsSourceCapabilities capabilities() {
            return capabilities;
        }

        @Override
        public HistoryPage fetch(AdvancedStatsHistoryModels.HistoryRequest request) {
            fetches++;
            if (fail) throw new IllegalStateException("primary unavailable");
            return new HistoryPage(List.of(new AttackObservation("event-" + fetches, request.scope(), NOW,
                    true, "war", "#9GCUV", 16, 16, 3, 100d, List.of(), 1, 2, 3)),
                    new Checkpoint("cursor-" + fetches, NOW), false, Coverage.COMPLETE,
                    new Provenance(id, "test", NOW, ""));
        }
    }
}

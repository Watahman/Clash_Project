package Java.advancedstats;

import Java.advancedstats.AdvancedStatsHistoryModels.Checkpoint;
import Java.advancedstats.AdvancedStatsHistoryModels.Coverage;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryPage;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryRequest;
import Java.advancedstats.AdvancedStatsHistoryModels.Provenance;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;

class AdvancedStatsCapabilityBasedSourceFallbackTest {
    private static final Instant NOW = Instant.parse("2026-08-29T19:00:00Z");

    @Test
    void emptyPartialPrimaryFallsBackToRollingNormalSource() throws Exception {
        AdvancedStatsHistorySource primary = source("clashking-v2", List.of());
        var rollingObservation = new AdvancedStatsHistoryModels.AttackObservation(
                "official-stable-id", AdvancedStatsScope.NORMAL, NOW, true, "multiplayer", "#9GCUV",
                17, 17, 3, 100d, List.of(), 1, 2, 3);
        AdvancedStatsHistorySource fallback = source("coc-battlelog", List.of(rollingObservation));
        AdvancedStatsCapabilityBasedSource chain = new AdvancedStatsCapabilityBasedSource(List.of(primary, fallback));

        HistoryPage page = chain.fetch(request());

        assertEquals(1, page.observations().size());
        assertEquals("coc-battlelog", page.provenance().sourceId());
    }

    @Test
    void nonEmptyPrimaryDoesNotCallFallback() throws Exception {
        var historical = new AdvancedStatsHistoryModels.AttackObservation(
                "clashking-id", AdvancedStatsScope.NORMAL, NOW.minusSeconds(60), true, "normal", "#9GCUV",
                17, 17, 2, 90d, List.of(), 1, 2, 3);
        AdvancedStatsHistorySource primary = source("clashking-v2", List.of(historical));
        AdvancedStatsHistorySource fallback = new StubSource("coc-battlelog", true, List.of());
        AdvancedStatsCapabilityBasedSource chain = new AdvancedStatsCapabilityBasedSource(List.of(primary, fallback));

        HistoryPage page = chain.fetch(request());

        assertEquals(1, page.observations().size());
        assertEquals("clashking-v2", page.provenance().sourceId());
    }

    @Test
    void validEmptyPrimarySurvivesFallbackOutage() throws Exception {
        AdvancedStatsHistorySource primary = source("clashking-v2", List.of());
        AdvancedStatsHistorySource fallback = new StubSource("coc-battlelog", false, List.of());
        AdvancedStatsCapabilityBasedSource chain = new AdvancedStatsCapabilityBasedSource(List.of(primary, fallback));

        HistoryPage page = chain.fetch(request());

        assertEquals(0, page.observations().size());
        assertEquals("clashking-v2", page.provenance().sourceId());
    }

    private static HistoryRequest request() {
        return new HistoryRequest(UUID.randomUUID(), "#P0Y8LQ", AdvancedStatsScope.NORMAL,
                AdvancedStatsCapabilityOperation.INCREMENTAL, Checkpoint.initial(), 100, NOW);
    }

    private static AdvancedStatsHistorySource source(
            String id, List<AdvancedStatsHistoryModels.AttackObservation> observations) {
        return new StubSource(id, true, observations);
    }

    private static final class StubSource implements AdvancedStatsHistorySource {
        private final String id;
        private final boolean succeeds;
        private final List<AdvancedStatsHistoryModels.AttackObservation> observations;
        private int calls;

        private StubSource(String id, boolean succeeds,
                           List<AdvancedStatsHistoryModels.AttackObservation> observations) {
            this.id = id;
            this.succeeds = succeeds;
            this.observations = observations;
        }

        @Override
        public String sourceId() {
            return id;
        }

        @Override
        public AdvancedStatsSourceCapabilities capabilities() {
            return new AdvancedStatsSourceCapabilities(List.of(
                    new AdvancedStatsCapability(AdvancedStatsScope.NORMAL,
                            AdvancedStatsCapabilityOperation.BOOTSTRAP,
                            AdvancedStatsCapabilityStatus.PARTIAL, id, "partial"),
                    new AdvancedStatsCapability(AdvancedStatsScope.NORMAL,
                            AdvancedStatsCapabilityOperation.INCREMENTAL,
                            AdvancedStatsCapabilityStatus.PARTIAL, id, "partial")
            ));
        }

        @Override
        public HistoryPage fetch(HistoryRequest request) throws Exception {
            calls++;
            if (!succeeds) throw new AdvancedStatsSourceUnavailableException("temporary outage");
            if (calls > 1 && "coc-battlelog".equals(id)) {
                throw new AssertionError("fallback should not have been called");
            }
            Checkpoint next = observations.isEmpty()
                    ? request.checkpoint()
                    : new Checkpoint("", observations.getLast().occurredAt(), observations.getLast().eventKey());
            return new HistoryPage(observations, next, false, Coverage.PARTIAL,
                    new Provenance(id, "test", request.requestedAt(), "partial"));
        }
    }
}

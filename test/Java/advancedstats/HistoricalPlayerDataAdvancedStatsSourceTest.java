package Java.advancedstats;

import Java.advancedstats.AdvancedStatsHistoryModels.Checkpoint;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryRequest;
import Java.performance.HistoricalAttack;
import Java.performance.HistoricalPlayerData;
import Java.performance.HistoricalPlayerDataProvider;
import Java.performance.HistoricalWarType;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class HistoricalPlayerDataAdvancedStatsSourceTest {
    private static final Instant FIRST = Instant.parse("2026-08-10T20:00:00Z");
    private static final Instant SECOND = Instant.parse("2026-08-11T20:00:00Z");

    @Test
    void mapsWarHistoryAndUsesLocalWatermarkForOverlapFiltering() throws Exception {
        HistoricalPlayerDataAdvancedStatsSource source = new HistoricalPlayerDataAdvancedStatsSource(
                new FakeProvider());
        HistoryRequest bootstrap = request(AdvancedStatsCapabilityOperation.BOOTSTRAP, Checkpoint.initial());

        var first = source.fetch(bootstrap);
        var next = source.fetch(request(AdvancedStatsCapabilityOperation.INCREMENTAL, first.nextCheckpoint()));

        assertEquals(AdvancedStatsCapabilityStatus.PARTIAL,
                source.capabilities().forOperation(AdvancedStatsScope.WAR,
                        AdvancedStatsCapabilityOperation.BOOTSTRAP).status());
        assertEquals(2, first.observations().size());
        assertEquals(0, next.observations().size());
        assertEquals(SECOND, first.nextCheckpoint().watermark());
        assertEquals("war:war-2:attack:00000002", first.nextCheckpoint().watermarkKey());
    }

    @Test
    void declaresUnsupportedScopesInsteadOfConvertingSnapshotsToAttacks() {
        HistoricalPlayerDataAdvancedStatsSource source = new HistoricalPlayerDataAdvancedStatsSource(new FakeProvider());

        assertEquals(AdvancedStatsCapabilityStatus.UNSUPPORTED,
                source.capabilities().forOperation(AdvancedStatsScope.NORMAL,
                        AdvancedStatsCapabilityOperation.BOOTSTRAP).status());
        assertThrows(UnsupportedOperationException.class,
                () -> source.fetch(request(AdvancedStatsScope.RANKED,
                        AdvancedStatsCapabilityOperation.BOOTSTRAP, Checkpoint.initial())));
    }

    private HistoryRequest request(AdvancedStatsCapabilityOperation operation, Checkpoint checkpoint) {
        return request(AdvancedStatsScope.WAR, operation, checkpoint);
    }

    private HistoryRequest request(AdvancedStatsScope scope, AdvancedStatsCapabilityOperation operation,
                                   Checkpoint checkpoint) {
        return new HistoryRequest(UUID.randomUUID(), "#P0Y8LQ", scope, operation, checkpoint, 100, SECOND);
    }

    private static final class FakeProvider implements HistoricalPlayerDataProvider {
        @Override
        public Map<String, HistoricalPlayerData> getPlayerWarHistory(List<String> playerTags) {
            HistoricalPlayerData data = new HistoricalPlayerData("#P0Y8LQ", List.of(
                    new HistoricalAttack("#P0Y8LQ", HistoricalWarType.REGULAR, FIRST, 16, 16, 3, 100, 1, "war-1"),
                    new HistoricalAttack("#P0Y8LQ", HistoricalWarType.REGULAR, SECOND, 16, 15, 2, 80, 2, "war-2")
            ), List.of(), "fake", true);
            return Map.of("#P0Y8LQ", data);
        }

        @Override
        public String providerName() {
            return "fake";
        }
    }
}

package Java.advancedstats;

import Java.advancedstats.AdvancedStatsHistoryModels.Checkpoint;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryRequest;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AdvancedStatsBattleLogHistorySourceTest {
    private static final Instant NOW = Instant.parse("2026-08-14T20:00:00Z");

    @Test
    void reportsRollingNormalCoverageAndFiltersByWatermark() throws Exception {
        String log = "[{\"attack\":true,\"battleTime\":\"20260810T200000.000Z\","
                + "\"battleType\":\"multiplayer\",\"opponentPlayerTag\":\"#9GCUV\","
                + "\"opponentTownHall\":16,\"stars\":3,\"destructionPercentage\":100}]";
        AdvancedStatsBattleLogHistorySource source = new AdvancedStatsBattleLogHistorySource(tag -> log);
        HistoryRequest bootstrap = request(AdvancedStatsCapabilityOperation.BOOTSTRAP, Checkpoint.initial());

        var first = source.fetch(bootstrap);
        var next = source.fetch(request(AdvancedStatsCapabilityOperation.INCREMENTAL, first.nextCheckpoint()));

        assertEquals(AdvancedStatsCapabilityStatus.PARTIAL,
                source.capabilities().forOperation(AdvancedStatsScope.NORMAL,
                        AdvancedStatsCapabilityOperation.BOOTSTRAP).status());
        assertEquals(1, first.observations().size());
        assertEquals(0, next.observations().size());
        assertEquals("coc-battlelog", first.provenance().sourceId());
    }

    @Test
    void doesNotPresentRankedAsNormalBattlelog() {
        AdvancedStatsBattleLogHistorySource source = new AdvancedStatsBattleLogHistorySource(tag -> "[]");
        assertThrows(UnsupportedOperationException.class,
                () -> source.fetch(new HistoryRequest(UUID.randomUUID(), "#P0Y8LQ", AdvancedStatsScope.RANKED,
                        AdvancedStatsCapabilityOperation.BOOTSTRAP, Checkpoint.initial(), 50, NOW)));
    }

    private HistoryRequest request(AdvancedStatsCapabilityOperation operation, Checkpoint checkpoint) {
        return new HistoryRequest(UUID.randomUUID(), "#P0Y8LQ", AdvancedStatsScope.NORMAL, operation,
                checkpoint, 50, NOW);
    }
}

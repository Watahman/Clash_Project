package Java.advancedstats;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AdvancedStatsAchievementRetryTest {
    private static final Instant NOW = Instant.parse("2026-08-07T13:00:00Z");

    @Test
    void duplicateOnlyPollRetriesReconciliationAfterDurableBattleSave() throws Exception {
        InMemoryStore store = new InMemoryStore();
        AdvancedStatsBattleProcessor processor = new AdvancedStatsBattleProcessor(store, new ArmyShareCodeParser());
        AtomicInteger reconciliationCalls = new AtomicInteger();
        AdvancedStatsBattleIngestionService service = new AdvancedStatsBattleIngestionService(
                new AdvancedStatsBattleLogParser(),
                processor,
                Clock.fixed(NOW, ZoneOffset.UTC),
                tracking -> {
                    if (reconciliationCalls.incrementAndGet() == 1) {
                        throw new IllegalStateException("temporary achievement failure");
                    }
                }
        );

        String log = """
                [{
                  "attack": true,
                  "battleType": "multiplayer",
                  "armyShareCode": "u8x110s2x2",
                  "opponentPlayerTag": "#9GCUV",
                  "opponentName": "One",
                  "stars": 3,
                  "destructionPercentage": 100
                }]
                """;

        assertThrows(IllegalStateException.class, () -> service.ingest(tracking(), log, false));
        assertEquals(1, store.fingerprints.size(), "battle must already be durable before reconcile failure");

        var retry = service.ingest(tracking(), log, false);
        assertEquals(0, retry.inserted());
        assertEquals(1, retry.duplicates());
        assertEquals(2, reconciliationCalls.get(), "duplicate-only retry must reconcile again");
        assertEquals(1, store.aggregateWrites, "duplicate retry must not mutate battle aggregates twice");
    }

    private AdvancedStatsModels.TrackingState tracking() {
        return new AdvancedStatsModels.TrackingState(
                UUID.fromString("11111111-1111-1111-1111-111111111111"),
                UUID.fromString("22222222-2222-2222-2222-222222222222"),
                "#2PYLQ",
                "Player",
                18,
                AdvancedStatsTrackingStatus.ACTIVE,
                NOW.minusSeconds(3600),
                NOW.minusSeconds(3500),
                NOW.minusSeconds(600),
                NOW.minusSeconds(600),
                NOW.plusSeconds(600),
                0,
                null,
                NOW.minusSeconds(3600),
                1
        );
    }

    private static final class InMemoryStore implements AdvancedStatsBattleProcessor.Store {
        private final Set<String> fingerprints = new HashSet<>();
        private int aggregateWrites;

        @Override
        public AdvancedStatsModels.SaveBattleResult saveProcessedBattle(
                UUID trackingId,
                AdvancedStatsModels.BattleCandidate battle,
                String fingerprint,
                AdvancedStatsModels.ParsedArmy army,
                boolean bootstrapImport,
                int parserVersion
        ) {
            if (!fingerprints.add(fingerprint)) return AdvancedStatsModels.SaveBattleResult.duplicate();
            aggregateWrites++;
            return new AdvancedStatsModels.SaveBattleResult(
                    true,
                    UUID.nameUUIDFromBytes(fingerprint.getBytes(java.nio.charset.StandardCharsets.UTF_8))
            );
        }

        @Override
        public boolean recordParserError(
                UUID trackingId,
                AdvancedStatsModels.BattleCandidate battle,
                String fingerprint,
                boolean bootstrapImport,
                int parserVersion
        ) {
            return fingerprints.add(fingerprint);
        }
    }
}
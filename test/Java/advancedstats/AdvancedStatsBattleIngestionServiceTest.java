package Java.advancedstats;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;

class AdvancedStatsBattleIngestionServiceTest {
    private static final UUID TRACKING_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID USER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final Instant NOW = Instant.parse("2026-08-07T13:00:00Z");

    @Test
    void sameBattleLogTwiceInsertsOnceThenDeduplicates() throws Exception {
        InMemoryStore store = new InMemoryStore();
        AdvancedStatsBattleProcessor processor = new AdvancedStatsBattleProcessor(
                store,
                new ArmyShareCodeParser()
        );
        AdvancedStatsBattleIngestionService service = new AdvancedStatsBattleIngestionService(
                new AdvancedStatsBattleLogParser(),
                processor,
                Clock.fixed(NOW, ZoneOffset.UTC)
        );

        String log = """
                [
                  {
                    "attack": true,
                    "battleType": "multiplayer",
                    "armyShareCode": "u8x110s2x2",
                    "opponentPlayerTag": "#9GCUV",
                    "opponentName": "One",
                    "stars": 3,
                    "destructionPercentage": 100,
                    "lootedResources": [{"name":"Gold","amount":500000}],
                    "availableLoot": [{"name":"Gold","amount":900000}]
                  },
                  {
                    "attack": true,
                    "battleType": "multiplayer",
                    "armyShareCode": "u5x26-6x27s2x5",
                    "opponentPlayerTag": "#8GCUV",
                    "opponentName": "Two",
                    "stars": 2,
                    "destructionPercentage": 83.5,
                    "lootedResources": [{"name":"Elixir","amount":450000}],
                    "availableLoot": [{"name":"Elixir","amount":700000}]
                  },
                  {
                    "attack": false,
                    "battleType": "multiplayer",
                    "opponentPlayerTag": "#2GCUV"
                  }
                ]
                """;

        var first = service.ingest(tracking(), log, true);
        var second = service.ingest(tracking(), log, false);

        assertEquals(3, first.observed());
        assertEquals(2, first.attacks());
        assertEquals(2, first.inserted());
        assertEquals(0, first.duplicates());
        assertEquals(1, first.ignoredDefenses());

        assertEquals(3, second.observed());
        assertEquals(2, second.attacks());
        assertEquals(0, second.inserted());
        assertEquals(2, second.duplicates());
        assertEquals(1, second.ignoredDefenses());

        assertEquals(2, store.fingerprints.size());
        assertEquals(2, store.aggregateWrites);
    }

    private AdvancedStatsModels.TrackingState tracking() {
        return new AdvancedStatsModels.TrackingState(
                TRACKING_ID,
                USER_ID,
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
                0
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
            if (!fingerprints.add(fingerprint)) {
                return AdvancedStatsModels.SaveBattleResult.duplicate();
            }
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

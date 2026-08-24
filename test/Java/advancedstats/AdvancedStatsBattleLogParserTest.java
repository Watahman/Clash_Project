package Java.advancedstats;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdvancedStatsBattleLogParserTest {
    private static final Instant OBSERVED = Instant.parse("2026-08-07T13:00:00Z");
    private final AdvancedStatsBattleLogParser parser = new AdvancedStatsBattleLogParser();

    @Test
    void parsesCurrentBattleLogShapeWithoutInventingTimestamp() {
        String json = """
                [
                  {
                    "battleType": "multiplayer",
                    "attack": true,
                    "armyShareCode": "u8x110s2x2",
                    "opponentPlayerTag": "#9GCUV",
                    "opponentName": "Opponent",
                    "opponentTownHallLevel": 18,
                    "stars": 3,
                    "destructionPercentage": 100,
                    "lootedResources": [
                      {"name":"Gold","amount":500000},
                      {"name":"Elixir","amount":400000},
                      {"name":"Dark Elixir","amount":5000}
                    ],
                    "extraLootedResources": [
                      {"name":"Gold","amount":10000}
                    ],
                    "availableLoot": [
                      {"name":"Gold","amount":900000},
                      {"name":"Elixir","amount":850000},
                      {"name":"Dark Elixir","amount":12000}
                    ]
                  }
                ]
                """;

        var battles = parser.parse("#2PYLQ", json, OBSERVED, 18);

        assertEquals(1, battles.size());
        var battle = battles.getFirst();
        assertTrue(battle.attack());
        assertNull(battle.battleTimestamp());
        assertEquals(OBSERVED, battle.effectiveTimestamp());
        assertEquals(510000, battle.lootGold());
        assertEquals(400000, battle.lootElixir());
        assertEquals(5000, battle.lootDarkElixir());
        assertEquals(900000, battle.availableGold());
        assertEquals(850000, battle.availableElixir());
        assertEquals(12000, battle.availableDarkElixir());
        assertEquals(18, battle.playerTownHall());
        assertEquals(18, battle.opponentTownHall());
    }

    @Test
    void supportsWrappedItemsAndCompactClashTimestampWhenPresent() {
        String json = """
                {
                  "items": [
                    {
                      "battleTime": "20260807T123456.000Z",
                      "battleType": "legend",
                      "attack": true,
                      "opponentPlayerTag": "#9GCUV",
                      "stars": 2,
                      "destructionPercentage": 87
                    }
                  ]
                }
                """;

        var battle = parser.parse("#2PYLQ", json, OBSERVED, 17).getFirst();

        assertEquals(Instant.parse("2026-08-07T12:34:56Z"), battle.battleTimestamp());
        assertEquals("legend", battle.battleType());
    }

    @Test
    void defenseEntriesRemainMarkedForProcessorToIgnore() {
        String json = "[{\"attack\":false,\"battleType\":\"multiplayer\"}]";

        var battle = parser.parse("#2PYLQ", json, OBSERVED, null).getFirst();

        assertFalse(battle.attack());
    }

    @Test
    void rejectsUnrecognizedTopLevelPayload() {
        assertThrows(
                IllegalArgumentException.class,
                () -> parser.parse("#2PYLQ", "{\"unexpected\":true}", OBSERVED, null)
        );
    }
}

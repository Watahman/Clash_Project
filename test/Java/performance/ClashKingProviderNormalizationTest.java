package Java.performance;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class ClashKingProviderNormalizationTest {
    @Test
    void v2PlayerHistoryUsesTheDocumentedWarStatsRoute() {
        assertEquals(
                "/v2/player/%23P0L/war/stats?type=cwl"
                        + "&time%5Bafter%5D=2022-08-27T00%3A00%3A00Z&limit=500",
                ClashKingV2Provider.warStatsPath(
                        "#P0L", "cwl", Instant.parse("2022-08-27T00:00:00Z")
                )
        );
    }

    @Test
    void v2NormalizesTheDocumentedPlayerWarStatsShape() {
        JsonObject response = JsonParser.parseString("""
                {"items":[{
                  "attacksPerMember":1,
                  "endTime":"20260725T120000.000Z",
                  "clan":{"tag":"#CLAN"},
                  "opponent":{"tag":"#ENEMY"},
                  "player":{"tag":"#P0L","townhallLevel":17},
                  "attacks":[{
                    "stars":2,"destructionPercentage":99,"order":3,
                    "player":{"tag":"#P2Y","townhallLevel":18}
                  }],
                  "defenses":[]
                }]}
                """).getAsJsonObject();

        HistoricalPlayerData data = ClashKingV2Provider.normalizePlayer(
                "#P0L", HistoricalWarType.CWL, response
        );

        assertTrue(data.available());
        assertEquals("v2", data.source());
        assertEquals(1, data.attacks().size());
        assertEquals(HistoricalWarType.CWL, data.attacks().getFirst().warType());
        assertEquals(17, data.attacks().getFirst().attackerTownHall());
        assertEquals(18, data.attacks().getFirst().defenderTownHall());
        assertEquals(1, data.participation().size());
        assertEquals(1, data.participation().getFirst().availableAttacks());
        assertEquals(1, data.participation().getFirst().usedAttacks());
    }
}

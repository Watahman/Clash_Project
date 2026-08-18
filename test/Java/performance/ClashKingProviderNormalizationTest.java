package Java.performance;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ClashKingProviderNormalizationTest {
    @Test
    void v2UsesItsOwnBatchShapeAndOnlyExplicitMissedAttackCounts() {
        JsonObject response = JsonParser.parseString("""
                {"items":[{
                  "tag":"#P0L",
                  "wars":[{
                    "missedAttacks":1,
                    "war_data":{
                      "state":"warEnded","endTime":"2026-07-25T12:00:00Z","tag":"#WAR",
                      "clan":{"members":[{"tag":"#P0L","townhallLevel":17}]},
                      "opponent":{"members":[{"tag":"#P2Y","townhallLevel":18}]}
                    },
                    "members":[{
                      "tag":"#P0L","townhallLevel":17,
                      "attacks":[{"attackerTag":"#P0L","defenderTag":"#P2Y","stars":2,
                                  "destructionPercentage":99,"order":3}]
                    }]
                  }]
                }]}
                """).getAsJsonObject();

        Map<String, HistoricalPlayerData> batch =
                ClashKingV2Provider.normalizeBatch(List.of("#P0L"), response);
        HistoricalPlayerData data = batch.get("#P0L");

        assertEquals(1, data.attacks().size());
        assertEquals(18, data.attacks().getFirst().defenderTownHall());
        assertEquals(1, data.participation().size());
        assertEquals(2, data.participation().getFirst().availableAttacks());
        assertEquals(1, data.participation().getFirst().usedAttacks());
    }
}

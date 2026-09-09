package Java.advancedstats;

import Java.advancedstats.AdvancedStatsHistoryModels.AttackObservation;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryPage;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryRequest;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ClashKingV2AdvancedStatsParserContractTest {
    private static final UUID TRACKING_ID = UUID.fromString("00000000-0000-0000-0000-000000000011");
    private static final Instant NOW = Instant.parse("2026-08-14T20:00:00Z");

    @Test
    void normalItemsReadLiveBattleFieldsAndLeaveAbsentOpponentUnknown() {
        String payload = "{\"items\":[{"
                + "\"battleTime\":\"2026-08-14T19:00:00Z\","
                + "\"destructionPercentage\":82.5,\"duration\":31,"
                + "\"lootedResources\":{\"gold\":1200,\"elixir\":3400,\"darkElixir\":5},"
                + "\"shareCode\":\"u10x0-2x5\"}]}";

        HistoryPage page = ClashKingV2AdvancedStatsParser.normal(json(payload), request(AdvancedStatsScope.NORMAL));
        AttackObservation observation = page.observations().get(0);

        assertEquals(Instant.parse("2026-08-14T19:00:00Z"), observation.occurredAt());
        assertEquals(82.5, observation.destructionPercentage());
        assertEquals(1200, observation.goldLooted());
        assertEquals(3400, observation.elixirLooted());
        assertEquals(5, observation.darkElixirLooted());
        assertTrue(observation.attack());
        assertTrue(observation.units().size() >= 2);
        assertEquals("", observation.opponentTag());
        assertNull(observation.playerTownHall());
        assertNull(observation.opponentTownHall());
    }

    @Test
    void leagueMergesRankedAndLegendAttacksButExcludesDefenses() {
        String ranked = "{\"attacks\":[{"
                + "\"time\":\"2026-08-14T18:00:00Z\",\"townHallLevel\":17,"
                + "\"opponent\":{\"tag\":\"#OPP1\",\"townHallLevel\":16},"
                + "\"shareCode\":\"u1x0\",\"lootedResources\":{\"gold\":100}}],"
                + "\"defenses\":[{\"time\":\"2026-08-14T18:01:00Z\"}]}";
        String legend = "{\"attacks\":[{"
                + "\"time\":\"2026-08-14T19:00:00Z\",\"townHallLevel\":18,"
                + "\"opponent\":{\"tag\":\"#OPP2\",\"townHallLevel\":17},"
                + "\"shareCode\":\"u2x1\",\"lootedResources\":{\"elixir\":200}}],"
                + "\"defenses\":[{\"time\":\"2026-08-14T19:01:00Z\"}]}";

        HistoryRequest request = request(AdvancedStatsScope.RANKED);
        HistoryPage page = ClashKingV2AdvancedStatsParser.league(
                json(ranked), "1754000000", json(legend), "2026-08-14", request);

        assertEquals(2, page.observations().size());
        assertEquals("ranked", page.observations().get(0).battleType());
        assertEquals("legend", page.observations().get(1).battleType());
        assertEquals("#OPP1", page.observations().get(0).opponentTag());
        assertEquals(16, page.observations().get(0).opponentTownHall());
        assertEquals(17, page.observations().get(0).playerTownHall());
        assertEquals("1754000000", page.provenance().rankedSeasonKey());
        assertEquals("GET /v2/player/{tag}/ranked/{seasonId}/battlelog and "
                        + "/v2/player/{tag}/legend/{day}/battlelog; attacks only",
                page.provenance().note());
        assertTrue(page.partial());
    }

    @Test
    void nonFiniteDestructionIsUnknownAndEventKeysRepeat() {
        var row = json("{\"time\":\"2026-08-14T18:00:00Z\",\"townHallLevel\":17,"
                + "\"opponent\":{\"tag\":\"#OPP1\"},\"destructionPercentage\":\"NaN\"}");
        var root = new com.google.gson.JsonObject();
        var attacks = new com.google.gson.JsonArray();
        attacks.add(row);
        root.add("attacks", attacks);
        HistoryRequest request = request(AdvancedStatsScope.RANKED);

        String first = ClashKingV2AdvancedStatsParser.league(root, "1754000000", null, "day", request)
                .observations().get(0).eventKey();
        AttackObservation observation = ClashKingV2AdvancedStatsParser.league(
                root, "1754000000", null, "day", request).observations().get(0);

        assertNull(observation.destructionPercentage());
        assertEquals(first, observation.eventKey());
    }

    private static HistoryRequest request(AdvancedStatsScope scope) {
        return new HistoryRequest(TRACKING_ID, "#P0Y8LQ", scope,
                AdvancedStatsCapabilityOperation.BOOTSTRAP,
                AdvancedStatsHistoryModels.Checkpoint.initial(), 100, NOW);
    }

    private static com.google.gson.JsonObject json(String value) {
        return JsonParser.parseString(value).getAsJsonObject();
    }
}

package Java.advancedstats;

import Java.advancedstats.AdvancedStatsHistoryModels.AttackObservation;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryPage;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryRequest;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
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
        assertTrue(observation.lootAvailable());
    }

    @Test
    void missingLootObjectIsNotReportedAsAvailable() {
        HistoryPage page = ClashKingV2AdvancedStatsParser.normal(
                json("{\"items\":[{\"battleTime\":\"2026-08-14T19:00:00Z\",\"gold\":1200}]}"),
                request(AdvancedStatsScope.NORMAL));

        AttackObservation observation = page.observations().get(0);

        assertEquals(1200, observation.goldLooted());
        assertEquals(0, observation.elixirLooted());
        assertFalse(observation.lootAvailable());
    }

    @Test
    void explicitLootObjectMakesAvailabilityTrueEvenWhenDarkElixirIsOmitted() {
        HistoryPage page = ClashKingV2AdvancedStatsParser.normal(
                json("{\"items\":[{\"battleTime\":\"2026-08-14T19:00:00Z\","
                        + "\"lootedResources\":{\"gold\":0,\"elixir\":200}}]}"),
                request(AdvancedStatsScope.NORMAL));

        AttackObservation observation = page.observations().get(0);

        assertEquals(200, observation.elixirLooted());
        assertEquals(0, observation.darkElixirLooted());
        assertTrue(observation.lootAvailable());
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

    @Test
    void rankedEventsWithoutASeasonAreOmitted() {
        HistoryPage page = ClashKingV2AdvancedStatsParser.ranked(
                json("{\"battlelogs\":[{\"battle_id\":\"r1\"}]}"),
                request(AdvancedStatsScope.RANKED), 0);

        assertTrue(page.observations().isEmpty());
        assertTrue(page.provenance().rankedSeasonKey().isBlank());
    }

    @Test
    void warObservationUsesTheRequestedPlayersPerspective() {
        HistoryPage page = ClashKingV2AdvancedStatsParser.war(json("{\"items\":["
                + "{\"war_id\":\"war-1\",\"warEndTime\":\"2026-08-14T19:00:00Z\","
                + "\"side\":\"attack\",\"attackerTag\":\"#P0Y8LQ\",\"defenderTag\":\"#OPP\","
                + "\"attackerTownhall\":17,\"defenderTownhall\":16,\"attackOrder\":7},"
                + "{\"war_id\":\"war-1\",\"warEndTime\":\"2026-08-14T19:00:00Z\","
                + "\"side\":\"defense\",\"attackerTag\":\"#ENEMY\",\"defenderTag\":\"#P0Y8LQ\","
                + "\"attackerTownhall\":18,\"defenderTownhall\":17,\"attackOrder\":8}]}"),
                request(AdvancedStatsScope.WAR));

        AttackObservation attack = page.observations().get(0);
        AttackObservation defense = page.observations().get(1);

        assertTrue(attack.attack());
        assertEquals("#OPP", attack.opponentTag());
        assertEquals(17, attack.playerTownHall());
        assertEquals(16, attack.opponentTownHall());
        assertFalse(attack.lootAvailable());
        assertFalse(defense.attack());
        assertEquals("#ENEMY", defense.opponentTag());
        assertEquals(17, defense.playerTownHall());
        assertEquals(18, defense.opponentTownHall());
        assertFalse(defense.lootAvailable());
    }

    @Test
    void normalEventKeysDoNotDependOnJsonPropertyOrder() {
        HistoryRequest request = request(AdvancedStatsScope.NORMAL);
        String first = ClashKingV2AdvancedStatsParser.normal(json(
                "{\"items\":[{\"battleTime\":\"2026-08-14T19:00:00Z\",\"opponentTag\":\"#OPP\","
                        + "\"stars\":3,\"destructionPercentage\":82.5,\"battleType\":\"normal\"}]}"), request)
                .observations().get(0).eventKey();
        String reordered = ClashKingV2AdvancedStatsParser.normal(json(
                "{\"items\":[{\"battleType\":\"normal\",\"destructionPercentage\":82.5,"
                        + "\"stars\":3,\"opponentTag\":\"#OPP\",\"battleTime\":\"2026-08-14T19:00:00Z\"}]}"), request)
                .observations().get(0).eventKey();

        assertEquals(first, reordered);
    }

    @Test
    void normalEventKeysDoNotUsePollTimeWhenTheSourceOmitsATimestamp() {
        String payload = "{\"items\":[{\"opponentTag\":\"#OPP\",\"stars\":3,"
                + "\"destructionPercentage\":82.5,\"battleType\":\"normal\"}]}";
        String first = ClashKingV2AdvancedStatsParser.normal(json(payload), request(AdvancedStatsScope.NORMAL))
                .observations().get(0).eventKey();
        HistoryRequest laterRequest = new HistoryRequest(TRACKING_ID, "#P0Y8LQ", AdvancedStatsScope.NORMAL,
                AdvancedStatsCapabilityOperation.BOOTSTRAP, AdvancedStatsHistoryModels.Checkpoint.initial(),
                100, NOW.plusSeconds(900));
        String later = ClashKingV2AdvancedStatsParser.normal(json(payload), laterRequest)
                .observations().get(0).eventKey();

        assertEquals(first, later);
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

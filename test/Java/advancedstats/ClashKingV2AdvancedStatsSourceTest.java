package Java.advancedstats;

import Java.advancedstats.AdvancedStatsHistoryModels.Coverage;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryRequest;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ClashKingV2AdvancedStatsSourceTest {
    private static final UUID TRACKING_ID = UUID.fromString("00000000-0000-0000-0000-000000000010");
    private static final Instant NOW = Instant.parse("2026-08-14T20:00:00Z");

    @Test
    void routeBuildersMatchTheDocumentedV2Contract() {
        assertEquals(
                "/v2/player/%23P0Y8LQ/battlelog/history?limit=100&days=365",
                ClashKingV2AdvancedStatsSource.normalPath("#P0Y8LQ", 100, 365)
        );
        assertEquals(
                "/v2/player/%23P0Y8LQ/ranked/1754000000/battlelog?limit=100",
                ClashKingV2AdvancedStatsSource.rankedPath("#P0Y8LQ", 1_754_000_000L, 100)
        );
        assertEquals(
                "/v2/player/%23P0Y8LQ/war/attacks"
                        + "?time%5Bafter%5D=2026-06-01T00%3A00%3A00Z"
                        + "&time%5Bbefore%5D=2026-07-01T00%3A00%3A00Z&limit=100",
                ClashKingV2AdvancedStatsSource.warPath(
                        "#P0Y8LQ", 1_780_272_000L, 1_782_864_000L, 100
                )
        );
    }

    @Test
    void normalRouteMapsRowsAndUsesLocalWatermark() throws Exception {
        FakeTransport transport = new FakeTransport();
        transport.normal = json("{\"items\":["
                + "{\"battle_id\":\"b1\",\"timestamp\":\"2026-08-14T19:00:00Z\","
                + "\"attack\":true,\"stars\":3,\"destruction_percentage\":100,"
                + "\"gold\":1200,\"player_townhall\":17,\"opponent_townhall\":18,"
                + "\"army_items\":[\"barbarian\"],\"army_counts\":{\"barbarian\":5}},"
                + "{\"battle_id\":\"d1\",\"timestamp\":\"2026-08-14T19:30:00Z\",\"attack\":false}]}");
        ClashKingV2AdvancedStatsSource source = new ClashKingV2AdvancedStatsSource(transport, 1L);

        var page = source.fetch(request(AdvancedStatsScope.NORMAL));

        assertEquals(Coverage.PARTIAL, page.coverage());
        assertEquals(2, page.observations().size());
        assertEquals(1200, page.observations().get(0).goldLooted());
        assertEquals(17, page.observations().get(0).playerTownHall());
        assertEquals(18, page.observations().get(0).opponentTownHall());
        assertEquals(1, page.observations().get(0).units().size());
        assertTrue(page.nextCheckpoint().present());
    }

    @Test
    void rankedRouteRequiresExplicitSeasonAndFiltersDefensesClientSide() throws Exception {
        FakeTransport transport = new FakeTransport();
        transport.ranked = json("{\"battlelogs\":["
                + "{\"battle_id\":\"r1\",\"timestamp\":\"2026-08-14T19:00:00Z\",\"attack\":true},"
                + "{\"battle_id\":\"r2\",\"timestamp\":\"2026-08-14T19:30:00Z\",\"attack\":false}]}");
        ClashKingV2AdvancedStatsSource source = new ClashKingV2AdvancedStatsSource(transport, 1_754_000_000L);

        var page = source.fetch(request(AdvancedStatsScope.RANKED));

        assertEquals(1, page.observations().size());
        assertTrue(page.observations().get(0).attack());
        assertEquals("1754000000", page.provenance().rankedSeasonKey());
        assertEquals(AdvancedStatsCapabilityStatus.PARTIAL,
                source.capabilities().forOperation(AdvancedStatsScope.RANKED,
                        AdvancedStatsCapabilityOperation.BOOTSTRAP).status());

        ClashKingV2AdvancedStatsSource withoutSeason = new ClashKingV2AdvancedStatsSource(transport, null);
        assertEquals(AdvancedStatsCapabilityStatus.UNSUPPORTED,
                withoutSeason.capabilities().forOperation(AdvancedStatsScope.RANKED,
                        AdvancedStatsCapabilityOperation.BOOTSTRAP).status());
    }

    @Test
    void rankedSeasonDoesNotReuseAnotherSeasonWatermark() {
        FakeTransport transport = new FakeTransport();
        ClashKingV2AdvancedStatsSource source = new ClashKingV2AdvancedStatsSource(transport, 1_754_000_000L);
        HistoryRequest request = new HistoryRequest(TRACKING_ID, "#P0Y8LQ", AdvancedStatsScope.RANKED,
                AdvancedStatsCapabilityOperation.INCREMENTAL,
                new AdvancedStatsHistoryModels.Checkpoint("", NOW, "ranked-season:1:event"), 100, NOW);

        assertThrows(AdvancedStatsSourceUnavailableException.class, () -> source.fetch(request));
    }

    @Test
    void warRouteKeepsAttackAndDefenseForWatermarkButRepositoryCanSkipDefense() throws Exception {
        FakeTransport transport = new FakeTransport();
        transport.war = json("{\"items\":["
                + "{\"side\":\"attacks\",\"war_id\":\"w1\",\"warEndTime\":\"2026-08-14T19:00:00Z\",\"attackOrder\":1,\"stars\":2},"
                + "{\"side\":\"defenses\",\"war_id\":\"w1\",\"warEndTime\":\"2026-08-14T19:00:00Z\",\"attackOrder\":2}]}");
        ClashKingV2AdvancedStatsSource source = new ClashKingV2AdvancedStatsSource(transport, 1L);

        var page = source.fetch(request(AdvancedStatsScope.WAR));

        assertEquals(2, page.observations().size());
        assertTrue(page.observations().get(0).attack());
        assertFalse(page.observations().get(1).attack());
    }

    private static HistoryRequest request(AdvancedStatsScope scope) {
        return new HistoryRequest(TRACKING_ID, "#P0Y8LQ", scope,
                AdvancedStatsCapabilityOperation.BOOTSTRAP,
                AdvancedStatsHistoryModels.Checkpoint.initial(), 100, NOW);
    }

    private static com.google.gson.JsonObject json(String value) {
        return JsonParser.parseString(value).getAsJsonObject();
    }

    private static final class FakeTransport implements ClashKingV2AdvancedStatsSource.Transport {
        private com.google.gson.JsonObject normal = json("{\"items\":[]}");
        private com.google.gson.JsonObject ranked = json("{\"battlelogs\":[]}");
        private com.google.gson.JsonObject war = json("{\"items\":[]}");

        @Override
        public com.google.gson.JsonObject normal(String playerTag, int limit, int days) {
            return normal;
        }

        @Override
        public com.google.gson.JsonObject ranked(String playerTag, long seasonSeconds, int limit) {
            return ranked;
        }

        @Override
        public com.google.gson.JsonObject war(String playerTag, long startSeconds, long endSeconds, int limit) {
            return war;
        }
    }
}

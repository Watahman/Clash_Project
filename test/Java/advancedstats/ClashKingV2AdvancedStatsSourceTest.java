package Java.advancedstats;

import Java.HttpException;
import Java.advancedstats.AdvancedStatsHistoryModels.Coverage;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryRequest;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ClashKingV2AdvancedStatsSourceTest {
    private static final UUID TRACKING_ID = UUID.fromString("00000000-0000-0000-0000-000000000010");
    private static final Instant NOW = Instant.parse("2026-08-14T20:00:00Z");

    @Test
    void routeBuildersUseTheDocumentedTimeAndPathContracts() {
        assertEquals("/v2/player/%23P0Y8LQ/battlelog/history"
                        + "?time%5Bafter%5D=2025-08-15T20%3A00%3A00Z"
                        + "&time%5Bbefore%5D=2026-08-14T20%3A00%3A00Z",
                ClashKingV2AdvancedStatsSource.normalPath("#P0Y8LQ", NOW.minusSeconds(364 * 86400L), NOW));
        assertEquals("/v2/player/%23P0Y8LQ/league/history"
                        + "?time%5Bafter%5D=2025-08-15T20%3A00%3A00Z"
                        + "&time%5Bbefore%5D=2026-08-14T20%3A00%3A00Z",
                ClashKingV2AdvancedStatsSource.leagueHistoryPath("#P0Y8LQ", NOW.minusSeconds(364 * 86400L), NOW));
        assertEquals("/v2/player/%23P0Y8LQ/ranked/1754000000/battlelog",
                ClashKingV2AdvancedStatsSource.rankedPath("#P0Y8LQ", "1754000000"));
        assertEquals("/v2/player/%23P0Y8LQ/legend/2026-08-14/battlelog",
                ClashKingV2AdvancedStatsSource.legendPath("#P0Y8LQ", "2026-08-14"));
    }

    @Test
    void normalFetchUsesOnlyUtcTimeWindow() throws Exception {
        FakeTransport transport = new FakeTransport();
        transport.normal = json("{\"items\":[{\"battle_id\":\"b1\",\"timestamp\":\"2026-08-14T19:00:00Z\","
                + "\"attack\":true,\"stars\":3,\"destruction_percentage\":100,\"gold\":1200}]}" );
        ClashKingV2AdvancedStatsSource source = new ClashKingV2AdvancedStatsSource(transport, 1L);

        var page = source.fetch(request(AdvancedStatsScope.NORMAL));

        assertEquals(Coverage.PARTIAL, page.coverage());
        assertEquals(1, page.observations().size());
        assertEquals(NOW.minusSeconds(364 * 86400L), transport.normalAfter);
        assertEquals(NOW, transport.normalBefore);
        assertFalse(transport.legacyNormalCalled);
    }

    @Test
    void playerSeasonKeyUsesNewestPositiveNumericRankedSeason() {
        FakeTransport transport = new FakeTransport();
        transport.league = json("{\"items\":["
                + "{\"mode\":\"ranked\",\"seasonId\":\"not-numeric\"},"
                + "{\"mode\":\"legend\",\"season\":\"2026-07\"},"
                + "{\"mode\":\"ranked\",\"seasonId\":\"1754000000\"},"
                + "{\"mode\":\"ranked\",\"seasonId\":\"1755000000\"}]}" );
        ClashKingV2AdvancedStatsSource source = new ClashKingV2AdvancedStatsSource(transport, null);

        assertEquals("1755000000", source.seasonKey(AdvancedStatsScope.RANKED, "#P0Y8LQ", NOW));
        assertEquals("", source.seasonKey(AdvancedStatsScope.NORMAL, "#P0Y8LQ", NOW));
        assertEquals(NOW.minusSeconds(364 * 86400L), transport.leagueAfter);
        assertEquals(NOW, transport.leagueBefore);
    }

    @Test
    void rankedFetchCombinesRankedSeasonAndCurrentLegendDay() throws Exception {
        FakeTransport transport = new FakeTransport();
        transport.league = json("{\"items\":[{\"mode\":\"ranked\",\"seasonId\":\"1755000000\"}]}" );
        transport.current = json("{\"legend\":\"2026-08-14\"}" );
        transport.ranked = json("{\"battlelogs\":[{\"battle_id\":\"r1\",\"timestamp\":\"2026-08-14T19:00:00Z\",\"attack\":true}]}" );
        transport.legend = json("{\"day\":\"2026-08-14\",\"attacks\":["
                + "{\"time\":\"2026-08-14T18:00:00Z\",\"townHallLevel\":17,"
                + "\"opponent\":{\"tag\":\"#OPP\",\"townHallLevel\":17},\"stars\":3,"
                + "\"destructionPercentage\":100,\"duration\":60,"
                + "\"lootedResources\":{\"gold\":1,\"elixir\":2,\"darkElixir\":3},"
                + "\"shareCode\":null,\"armyHash\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\","
                + "\"trophies\":10}],\"defenses\":[]}" );
        ClashKingV2AdvancedStatsSource source = new ClashKingV2AdvancedStatsSource(transport, null);

        var page = source.fetch(request(AdvancedStatsScope.RANKED));

        assertEquals(2, page.observations().size());
        assertEquals("1755000000", page.provenance().rankedSeasonKey());
        assertEquals("1755000000", transport.rankedSeason);
        assertEquals("2026-08-14", transport.legendDay);
        assertEquals(AdvancedStatsCapabilityStatus.PARTIAL,
                source.capabilities().forOperation(AdvancedStatsScope.RANKED,
                        AdvancedStatsCapabilityOperation.BOOTSTRAP).status());
    }

    @Test
    void missingRankedSeasonRouteDoesNotBlockLegendDay() throws Exception {
        FakeTransport transport = new FakeTransport();
        transport.current = json("{\"legend\":\"2026-08-14\"}" );
        transport.rankedFailure = new HttpException(404, "{}");
        transport.legend = json("{\"day\":\"2026-08-14\",\"attacks\":[],\"defenses\":[]}" );
        ClashKingV2AdvancedStatsSource source = new ClashKingV2AdvancedStatsSource(transport, 1755000000L);

        var page = source.fetch(request(AdvancedStatsScope.RANKED));

        assertEquals(Coverage.PARTIAL, page.coverage());
        assertEquals("2026-08-14", transport.legendDay);
        assertTrue(transport.rankedCalled);
    }

    @Test
    void missingPlayerLeagueSeasonDoesNotBlockLegendDay() throws Exception {
        FakeTransport transport = new FakeTransport();
        transport.leagueFailure = new HttpException(404, "{}");
        transport.current = json("{\"legend\":\"2026-08-14\"}" );
        transport.legend = json("{\"day\":\"2026-08-14\",\"attacks\":[],\"defenses\":[]}" );
        ClashKingV2AdvancedStatsSource source = new ClashKingV2AdvancedStatsSource(transport, null);

        var page = source.fetch(request(AdvancedStatsScope.RANKED));

        assertEquals(Coverage.PARTIAL, page.coverage());
        assertEquals("2026-08-14", transport.legendDay);
        assertFalse(transport.rankedCalled);
    }

    @Test
    void explicitRankedSeasonOverrideSkipsPlayerLeagueHistory() {
        FakeTransport transport = new FakeTransport();
        ClashKingV2AdvancedStatsSource source = new ClashKingV2AdvancedStatsSource(transport, 1754000000L);

        assertEquals("1754000000", source.seasonKey(AdvancedStatsScope.RANKED));
        assertEquals("1754000000", source.seasonKey(AdvancedStatsScope.RANKED, "#P0Y8LQ", NOW));
        assertEquals(0, transport.leagueCalls);
    }

    @Test
    void temporarySeasonDiscoveryFailureIsRetriedAndOriginalHttpFailureIsPreserved() {
        FakeTransport transport = new FakeTransport();
        transport.leagueFailure = HttpException.upstream(429, "{}", "ClashKing V2");
        ClashKingV2AdvancedStatsSource source = new ClashKingV2AdvancedStatsSource(transport, null);

        assertThrows(ClashKingV2AdvancedStatsSource.SeasonDiscoveryException.class,
                () -> source.seasonKey(AdvancedStatsScope.RANKED, "#P0Y8LQ", NOW));

        transport.leagueFailure = null;
        transport.league = json("{\"items\":[{\"mode\":\"ranked\",\"seasonId\":\"1755000000\"}]}" );
        assertEquals("1755000000", source.seasonKey(AdvancedStatsScope.RANKED, "#P0Y8LQ", NOW));
        assertEquals(2, transport.leagueCalls);
    }

    @Test
    void seasonDiscoveryRefreshesAfterUtcSeasonRollover() {
        FakeTransport transport = new FakeTransport();
        transport.league = json("{\"items\":[{\"mode\":\"ranked\",\"seasonId\":\"1755000000\"}]}" );
        ClashKingV2AdvancedStatsSource source = new ClashKingV2AdvancedStatsSource(transport, null);

        assertEquals("1755000000", source.seasonKey(AdvancedStatsScope.RANKED, "#P0Y8LQ", NOW));
        transport.league = json("{\"items\":[{\"mode\":\"ranked\",\"seasonId\":\"1756000000\"}]}" );
        assertEquals("1756000000", source.seasonKey(AdvancedStatsScope.RANKED, "#P0Y8LQ",
                NOW.plusSeconds(24 * 60 * 60L)));
        assertEquals(2, transport.leagueCalls);
    }

    @Test
    void emptySeasonDiscoveryIsNotNegativeCached() {
        FakeTransport transport = new FakeTransport();
        transport.league = json("{\"items\":[]}" );
        ClashKingV2AdvancedStatsSource source = new ClashKingV2AdvancedStatsSource(transport, null);

        assertEquals("", source.seasonKey(AdvancedStatsScope.RANKED, "#P0Y8LQ", NOW));
        transport.league = json("{\"items\":[{\"mode\":\"ranked\",\"seasonId\":\"1755000000\"}]}" );
        assertEquals("1755000000", source.seasonKey(AdvancedStatsScope.RANKED, "#P0Y8LQ", NOW));
        assertEquals(2, transport.leagueCalls);
    }

    @Test
    void currentDatesAndSeasonDiscoveryAreCachedWithinUtcPollDay() throws Exception {
        FakeTransport transport = new FakeTransport();
        transport.league = json("{\"items\":[{\"mode\":\"ranked\",\"seasonId\":\"1755000000\"}]}" );
        transport.current = json("{\"legend\":\"2026-08-14\"}" );
        ClashKingV2AdvancedStatsSource source = new ClashKingV2AdvancedStatsSource(transport, null);

        source.fetch(request(AdvancedStatsScope.RANKED));
        source.fetch(request(AdvancedStatsScope.RANKED));

        assertEquals(1, transport.leagueCalls);
        assertEquals(1, transport.currentCalls);
    }

    @Test
    void rankedHttpFailureIsNotConvertedToUnsupportedRoute() {
        FakeTransport transport = new FakeTransport();
        transport.current = json("{\"legend\":\"2026-08-14\"}" );
        transport.league = json("{\"items\":[{\"mode\":\"ranked\",\"seasonId\":\"1755000000\"}]}" );
        transport.rankedFailure = HttpException.upstream(503, "{}", "ClashKing V2");
        ClashKingV2AdvancedStatsSource source = new ClashKingV2AdvancedStatsSource(transport, null);

        Exception failure = assertThrows(HttpException.class,
                () -> source.fetch(request(AdvancedStatsScope.RANKED)));
        assertEquals(503, ((HttpException) failure).getStatusCode());
    }

    private static HistoryRequest request(AdvancedStatsScope scope) {
        return new HistoryRequest(TRACKING_ID, "#P0Y8LQ", scope,
                AdvancedStatsCapabilityOperation.BOOTSTRAP,
                AdvancedStatsHistoryModels.Checkpoint.initial(), 100, NOW);
    }

    private static JsonObject json(String value) {
        return JsonParser.parseString(value).getAsJsonObject();
    }

    private static final class FakeTransport implements ClashKingV2AdvancedStatsSource.Transport {
        private JsonObject normal = json("{\"items\":[]}");
        private JsonObject ranked = json("{\"battlelogs\":[]}");
        private JsonObject legend = json("{\"attacks\":[],\"defenses\":[]}");
        private JsonObject league = json("{\"items\":[]}");
        private JsonObject current = json("{}");
        private Instant normalAfter;
        private Instant normalBefore;
        private Instant leagueAfter;
        private Instant leagueBefore;
        private String rankedSeason;
        private String legendDay;
        private int leagueCalls;
        private int currentCalls;
        private boolean legacyNormalCalled;
        private boolean rankedCalled;
        private HttpException rankedFailure;
        private HttpException leagueFailure;

        @Override
        public JsonObject normal(String playerTag, int limit, int days) {
            legacyNormalCalled = true;
            return normal;
        }

        @Override
        public JsonObject normal(String playerTag, Instant after, Instant before) {
            normalAfter = after;
            normalBefore = before;
            return normal;
        }

        @Override
        public JsonObject ranked(String playerTag, long seasonSeconds, int limit) {
            rankedCalled = true;
            rankedSeason = Long.toString(seasonSeconds);
            return ranked;
        }

        @Override
        public JsonObject ranked(String playerTag, String seasonId) throws Exception {
            rankedCalled = true;
            rankedSeason = seasonId;
            if (rankedFailure != null) throw rankedFailure;
            return ranked;
        }

        @Override
        public JsonObject war(String playerTag, long startSeconds, long endSeconds, int limit) {
            return json("{\"items\":[]}");
        }

        @Override
        public JsonObject leagueHistory(String playerTag, Instant after, Instant before) throws Exception {
            leagueCalls++;
            leagueAfter = after;
            leagueBefore = before;
            if (leagueFailure != null) throw leagueFailure;
            return league;
        }

        @Override
        public JsonObject legend(String playerTag, String day) {
            legendDay = day;
            return legend;
        }

        @Override
        public JsonObject currentDates() {
            currentCalls++;
            return current;
        }
    }
}

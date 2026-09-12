package Java.advancedstats;

import Java.HttpException;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdvancedStatsCompactReadAggregatorTest {
    private static final UUID TRACKING_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final Instant FROM = Instant.parse("2026-08-01T00:00:00Z");

    @Test
    void overviewCombinesAllScopesAndRecomputesGlobalFavorites() throws Exception {
        FakeReader reader = new FakeReader();
        AdvancedStatsCompactReadAggregator aggregator = new AdvancedStatsCompactReadAggregator(reader);

        JsonObject result = aggregator.overview(TRACKING_ID, FROM);

        assertEquals("ALL", result.get("scope").getAsString());
        JsonObject summary = result.getAsJsonObject("summary");
        assertEquals(17, summary.get("attacks").getAsInt());
        assertEquals(2.18, summary.get("averageStars").getAsDouble(), 0.001);
        assertEquals(47.06, summary.get("threeStarRate").getAsDouble(), 0.001);
        assertEquals(1_700, summary.get("goldLooted").getAsInt());
        assertEquals("barbarian", result.getAsJsonObject("favorites")
                .getAsJsonObject("troop").get("key").getAsString());
        assertEquals("army-a", result.getAsJsonObject("favorites")
                .getAsJsonObject("army").get("armyHash").getAsString());
        assertEquals(3, result.getAsJsonObject("tracking").getAsJsonArray("scopes").size());
    }

    @Test
    void competitiveOverviewMergesWarAndRankedWithWeightedMetrics() throws Exception {
        JsonObject result = new AdvancedStatsCompactReadAggregator(new FakeReader())
                .overview(TRACKING_ID, FROM, AdvancedStatsScopeSelection.parse("competitive"));

        JsonObject summary = result.getAsJsonObject("summary");
        assertEquals("competitive", result.get("scope").getAsString());
        assertEquals(7, summary.get("attacks").getAsInt());
        assertEquals(2.43, summary.get("averageStars").getAsDouble(), 0.001);
        assertEquals(700, summary.get("goldLooted").getAsInt());
        assertEquals("cannon", result.getAsJsonObject("favorites")
                .getAsJsonObject("troop").get("key").getAsString());
        assertEquals(2, result.getAsJsonObject("tracking").getAsJsonArray("scopes").size());
    }

    @Test
    void competitiveOverviewKeepsSuccessfulScopeWhenAnotherScopeFails() throws Exception {
        FakeReader reader = new FakeReader();
        reader.failRankedOverview = true;

        JsonObject result = new AdvancedStatsCompactReadAggregator(reader)
                .overview(TRACKING_ID, FROM, AdvancedStatsScopeSelection.parse("competitive"));

        assertTrue(result.get("partial").getAsBoolean());
        assertEquals(2, result.getAsJsonObject("summary").get("attacks").getAsInt());
        assertEquals("ranked", result.getAsJsonArray("failures")
                .get(0).getAsJsonObject().get("scope").getAsString());
    }

    @Test
    void unitsUseMultiplayerScopesWhileArmiesAndTrendsStillMergeAllScopes() throws Exception {
        FakeReader reader = new FakeReader();
        AdvancedStatsCompactReadAggregator aggregator = new AdvancedStatsCompactReadAggregator(reader);

        JsonArray units = aggregator.units(TRACKING_ID, FROM, null).getAsJsonArray();
        assertEquals(1, units.size());
        JsonObject barbarian = units.get(0).getAsJsonObject();
        assertEquals("barbarian", barbarian.get("key").getAsString());
        assertEquals(130, barbarian.get("totalQuantity").getAsInt());
        assertEquals(100.0, barbarian.get("usageRate").getAsDouble(), 0.001);

        JsonArray armies = aggregator.armies(TRACKING_ID, FROM, 20).getAsJsonArray();
        assertEquals("army-a", armies.get(0).getAsJsonObject().get("armyHash").getAsString());
        assertEquals(10, armies.get(0).getAsJsonObject().get("battleCount").getAsInt());
        assertEquals(2.2, armies.get(0).getAsJsonObject().get("averageStars").getAsDouble(), 0.001);

        JsonArray trends = aggregator.trends(TRACKING_ID, FROM).getAsJsonArray();
        JsonObject day = trends.get(0).getAsJsonObject();
        assertEquals("2026-08-01", day.get("date").getAsString());
        assertEquals(15, day.get("attacks").getAsInt());
        assertEquals(2.33, day.get("averageStars").getAsDouble(), 0.001);
        assertEquals(1_500, day.get("goldLooted").getAsInt());
        assertTrue(reader.calls > 0);
    }

    @Test
    void failedScopeKeepsOtherDataAndReportsFailureContext() throws Exception {
        FakeReader reader = new FakeReader();
        reader.failRankedOverview = true;

        JsonObject result = new AdvancedStatsCompactReadAggregator(reader).overview(TRACKING_ID, FROM);

        assertTrue(result.get("partial").getAsBoolean());
        assertEquals(12, result.getAsJsonObject("summary").get("attacks").getAsInt());
        assertTrue(result.getAsJsonObject("summary").get("goldLooted").isJsonNull());
        JsonObject failure = result.getAsJsonArray("failures").get(0).getAsJsonObject();
        assertEquals("ranked", failure.get("scope").getAsString());
        assertEquals("overview", failure.get("operation").getAsString());
    }

    @Test
    void lootMetricsUseOnlyReliableLootAttacksAndKeepZeroDarkElixir() {
        JsonObject overview = JsonParser.parseString(
                "{\"summary\":{\"attacks\":3,\"averageStars\":2,"
                        + "\"averageDestruction\":50,\"threeStarRate\":33.33,"
                        + "\"lootAttackCount\":2,\"goldLooted\":100,\"elixirLooted\":60,"
                        + "\"darkElixirLooted\":0,\"bestGoldLooted\":70,"
                        + "\"bestElixirLooted\":40,\"bestDarkElixirLooted\":0}}")
                .getAsJsonObject();

        JsonObject result = new AdvancedStatsCompactReadMerger().overview(List.of(
                new AdvancedStatsCompactReadAggregator.ScopeSnapshot(
                        AdvancedStatsScope.NORMAL, overview, null, null, null)));
        JsonObject summary = result.getAsJsonObject("summary");

        assertEquals(2, summary.get("lootAttackCount").getAsInt());
        assertEquals(100, summary.get("goldLooted").getAsInt());
        assertEquals(50, summary.get("averageGoldLooted").getAsInt());
        assertEquals(0, summary.get("darkElixirLooted").getAsInt());
        assertEquals(0, summary.get("bestDarkElixirLooted").getAsInt());
    }

    @Test
    void trendMergeRecomputesLootMetricsAcrossScopesAndKeepsTrueZero() {
        JsonArray normal = array("{\"date\":\"2026-08-01\",\"attacks\":2,"
                + "\"averageStars\":2,\"averageDestruction\":40,\"threeStarRate\":50,"
                + "\"lootAttackCount\":2,\"goldLooted\":100,\"elixirLooted\":0,"
                + "\"darkElixirLooted\":0,\"bestGoldLooted\":70,\"bestElixirLooted\":0,"
                + "\"bestDarkElixirLooted\":0}");
        JsonArray ranked = array("{\"date\":\"2026-08-01\",\"attacks\":1,"
                + "\"averageStars\":3,\"averageDestruction\":60,\"threeStarRate\":100,"
                + "\"lootAttackCount\":1,\"goldLooted\":50,\"elixirLooted\":20,"
                + "\"darkElixirLooted\":0,\"bestGoldLooted\":50,\"bestElixirLooted\":20,"
                + "\"bestDarkElixirLooted\":0}");

        JsonObject day = new AdvancedStatsCompactReadMerger().trends(List.of(
                trendSnapshot(AdvancedStatsScope.NORMAL, normal),
                trendSnapshot(AdvancedStatsScope.RANKED, ranked))).get(0).getAsJsonObject();

        assertEquals(3, day.get("attacks").getAsInt());
        assertEquals(3, day.get("lootAttackCount").getAsInt());
        assertEquals(150, day.get("goldLooted").getAsInt());
        assertEquals(50, day.get("averageGoldLooted").getAsInt());
        assertEquals(20, day.get("bestElixirLooted").getAsInt());
        assertEquals(20, day.get("elixirLooted").getAsInt());
        assertEquals(0, day.get("darkElixirLooted").getAsInt());
        assertEquals(0, day.get("bestDarkElixirLooted").getAsInt());
    }

    @Test
    void trendMergeDoesNotTurnUnknownScopeLootIntoZero() {
        JsonArray known = array("{\"date\":\"2026-08-01\",\"attacks\":1,"
                + "\"lootAttackCount\":1,\"goldLooted\":100,\"elixirLooted\":20,"
                + "\"darkElixirLooted\":3,\"bestGoldLooted\":100,\"bestElixirLooted\":20,"
                + "\"bestDarkElixirLooted\":3}");
        JsonArray unknown = array("{\"date\":\"2026-08-01\",\"attacks\":1,"
                + "\"lootAttackCount\":null}");

        JsonObject day = new AdvancedStatsCompactReadMerger().trends(List.of(
                trendSnapshot(AdvancedStatsScope.NORMAL, known),
                trendSnapshot(AdvancedStatsScope.RANKED, unknown))).get(0).getAsJsonObject();

        assertTrue(day.get("lootAttackCount").isJsonNull());
        assertTrue(day.get("goldLooted").isJsonNull());
        assertTrue(day.get("averageGoldLooted").isJsonNull());
        assertTrue(day.get("bestGoldLooted").isJsonNull());
    }

    @Test
    void listScopeFailuresArePropagated() {
        FakeReader unitsReader = new FakeReader();
        unitsReader.failRankedUnits = true;
        assertThrows(HttpException.class,
                () -> new AdvancedStatsCompactReadAggregator(unitsReader).units(TRACKING_ID, FROM, null));

        FakeReader armiesReader = new FakeReader();
        armiesReader.failRankedArmies = true;
        assertThrows(HttpException.class,
                () -> new AdvancedStatsCompactReadAggregator(armiesReader).armies(TRACKING_ID, FROM, 20));

        FakeReader trendsReader = new FakeReader();
        trendsReader.failRankedTrends = true;
        assertThrows(HttpException.class,
                () -> new AdvancedStatsCompactReadAggregator(trendsReader).trends(TRACKING_ID, FROM));
    }

    @Test
    void selectedTrendFailureDoesNotLookLikeACompleteArray() {
        FakeReader reader = new FakeReader();
        reader.failRankedTrends = true;

        assertThrows(HttpException.class,
                () -> new AdvancedStatsCompactReadAggregator(reader).trends(
                        TRACKING_ID, FROM, AdvancedStatsScopeSelection.parse("competitive")));
    }

    private static AdvancedStatsCompactReadAggregator.ScopeSnapshot trendSnapshot(
            AdvancedStatsScope scope, JsonArray trends) {
        return new AdvancedStatsCompactReadAggregator.ScopeSnapshot(scope, null, null, null, trends);
    }

    private static JsonArray array(String value) {
        return JsonParser.parseString("[" + value + "]").getAsJsonArray();
    }

    private static final class FakeReader implements AdvancedStatsCompactReadAggregator.ScopeReader {
        private final Map<AdvancedStatsScope, JsonObject> overviews = new EnumMap<>(AdvancedStatsScope.class);
        private final Map<AdvancedStatsScope, JsonArray> units = new EnumMap<>(AdvancedStatsScope.class);
        private final Map<AdvancedStatsScope, JsonArray> armies = new EnumMap<>(AdvancedStatsScope.class);
        private final Map<AdvancedStatsScope, JsonArray> trends = new EnumMap<>(AdvancedStatsScope.class);
        private int calls;
        private boolean failRankedOverview;
        private boolean failRankedUnits;
        private boolean failRankedArmies;
        private boolean failRankedTrends;

        private FakeReader() {
            add(AdvancedStatsScope.NORMAL, 10, 2, 40, 1_000,
                    "barbarian", 100, 10, "army-a", 8, 2, "2026-08-01", 10, 2, 1_000);
            add(AdvancedStatsScope.RANKED, 5, 3, 60, 500,
                    "barbarian", 30, 5, "army-a", 2, 3, "2026-08-01", 5, 3, 500);
            add(AdvancedStatsScope.WAR, 2, 1, 50, 200,
                    "cannon", 40, 2, "army-b", 2, 1, "2026-08-02", 2, 1, 200);
        }

        @Override
        public JsonObject overview(UUID trackingId, AdvancedStatsScope scope, Instant from) {
            calls++;
            if (failRankedOverview && scope == AdvancedStatsScope.RANKED) {
                throw new IllegalStateException("ranked read failed");
            }
            return overviews.get(scope);
        }

        @Override
        public JsonElement units(UUID trackingId, AdvancedStatsScope scope, Instant from,
                                 AdvancedStatsUnitCategory category) throws Exception {
            calls++;
            if (failRankedUnits && scope == AdvancedStatsScope.RANKED) throw new HttpException(503, "temporary");
            return units.get(scope);
        }

        @Override
        public JsonElement armies(UUID trackingId, AdvancedStatsScope scope, Instant from, int limit)
                throws Exception {
            calls++;
            if (failRankedArmies && scope == AdvancedStatsScope.RANKED) throw new HttpException(503, "temporary");
            return armies.get(scope);
        }

        @Override
        public JsonElement trends(UUID trackingId, AdvancedStatsScope scope, Instant from) throws Exception {
            calls++;
            if (failRankedTrends && scope == AdvancedStatsScope.RANKED) throw new HttpException(503, "temporary");
            return trends.get(scope);
        }

        private void add(AdvancedStatsScope scope, int attacks, int stars, int threeRate, int gold,
                         String unitKey, int quantity, int present, String armyHash, int armyCount,
                         int armyStars, String date, int trendAttacks, int trendStars, int trendGold) {
            JsonObject overview = new JsonObject();
            overview.add("tracking", JsonParser.parseString("{\"status\":\"ACTIVE\"}"));
            overview.add("summary", JsonParser.parseString("{\"attacks\":" + attacks
                    + ",\"averageStars\":" + stars + ",\"averageDestruction\":50"
                    + ",\"threeStarRate\":" + threeRate + ",\"lootAttackCount\":" + attacks
                    + ",\"goldLooted\":" + gold + ",\"elixirLooted\":10,\"darkElixirLooted\":1"
                    + ",\"averageGoldLooted\":" + ((double) gold / attacks)
                    + ",\"averageElixirLooted\":1,\"averageDarkElixirLooted\":0.1"
                    + ",\"bestGoldLooted\":" + gold + ",\"bestElixirLooted\":10"
                    + ",\"bestDarkElixirLooted\":1}"));
            overviews.put(scope, overview);
            units.put(scope, array("{\"key\":\"" + unitKey + "\",\"name\":\""
                    + unitKey + "\",\"category\":\"TROOP\",\"totalQuantity\":" + quantity
                    + ",\"battlesPresent\":" + present + ",\"usageRate\":0"
                    + ",\"firstSeenAt\":\"2026-08-01\",\"lastSeenAt\":\"2026-08-02\"}"));
            armies.put(scope, array("{\"armyHash\":\"" + armyHash + "\",\"army\":{},"
                    + "\"battleCount\":" + armyCount + ",\"averageStars\":" + armyStars
                    + ",\"averageDestruction\":50,\"firstSeenAt\":\"2026-08-01\","
                    + "\"lastSeenAt\":\"2026-08-02\"}"));
            trends.put(scope, array("{\"date\":\"" + date + "\",\"attacks\":" + trendAttacks
                    + ",\"averageStars\":" + trendStars + ",\"averageDestruction\":50"
                    + ",\"threeStarRate\":50,\"lootAttackCount\":" + trendAttacks
                    + ",\"goldLooted\":" + trendGold + ",\"elixirLooted\":10"
                    + ",\"darkElixirLooted\":1,\"bestGoldLooted\":" + trendGold
                    + ",\"bestElixirLooted\":10,\"bestDarkElixirLooted\":1}"));
        }

        private JsonArray array(String value) {
            return JsonParser.parseString("[" + value + "]").getAsJsonArray();
        }
    }
}

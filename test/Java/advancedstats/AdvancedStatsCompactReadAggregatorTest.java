package Java.advancedstats;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.EnumMap;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
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

    private static final class FakeReader implements AdvancedStatsCompactReadAggregator.ScopeReader {
        private final Map<AdvancedStatsScope, JsonObject> overviews = new EnumMap<>(AdvancedStatsScope.class);
        private final Map<AdvancedStatsScope, JsonArray> units = new EnumMap<>(AdvancedStatsScope.class);
        private final Map<AdvancedStatsScope, JsonArray> armies = new EnumMap<>(AdvancedStatsScope.class);
        private final Map<AdvancedStatsScope, JsonArray> trends = new EnumMap<>(AdvancedStatsScope.class);
        private int calls;

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
            return overviews.get(scope);
        }

        @Override
        public JsonElement units(UUID trackingId, AdvancedStatsScope scope, Instant from,
                                 AdvancedStatsUnitCategory category) {
            calls++;
            return units.get(scope);
        }

        @Override
        public JsonElement armies(UUID trackingId, AdvancedStatsScope scope, Instant from, int limit) {
            calls++;
            return armies.get(scope);
        }

        @Override
        public JsonElement trends(UUID trackingId, AdvancedStatsScope scope, Instant from) {
            calls++;
            return trends.get(scope);
        }

        private void add(AdvancedStatsScope scope, int attacks, int stars, int threeRate, int gold,
                         String unitKey, int quantity, int present, String armyHash, int armyCount,
                         int armyStars, String date, int trendAttacks, int trendStars, int trendGold) {
            JsonObject overview = new JsonObject();
            overview.add("tracking", JsonParser.parseString("{\"status\":\"ACTIVE\"}"));
            overview.add("summary", JsonParser.parseString("{\"attacks\":" + attacks
                    + ",\"averageStars\":" + stars + ",\"averageDestruction\":50"
                    + ",\"threeStarRate\":" + threeRate + ",\"goldLooted\":" + gold
                    + ",\"elixirLooted\":10,\"darkElixirLooted\":1}"));
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
                    + ",\"threeStarRate\":50,\"goldLooted\":" + trendGold
                    + ",\"elixirLooted\":10,\"darkElixirLooted\":1}"));
        }

        private JsonArray array(String value) {
            return JsonParser.parseString("[" + value + "]").getAsJsonArray();
        }
    }
}

package Java.advancedstats;

import Java.HttpException;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdvancedStatsReadRepositoryTest {
    private static final UUID TRACKING_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final Instant FROM = Instant.parse("2026-08-01T00:00:00Z");

    @Test
    void transientV2FailureIsNotSilentlyReplacedByLegacyData() {
        List<String> calls = new ArrayList<>();
        AdvancedStatsReadRepository repository = repository((function, body) -> {
            calls.add(function);
            throw new HttpException(503, "{\"error\":\"temporarily unavailable\"}");
        });

        assertThrows(HttpException.class,
                () -> repository.overview(TRACKING_ID, AdvancedStatsScope.NORMAL, FROM));
        assertEquals(List.of("read_advanced_stats_compact_overview_v2"), calls);
    }

    @Test
    void transientListV2FailureIsNotSilentlyReplacedByLegacyData() {
        List<String> calls = new ArrayList<>();
        AdvancedStatsReadRepository repository = repository((function, body) -> {
            calls.add(function);
            throw new HttpException(503, "{\"error\":\"temporarily unavailable\"}");
        });

        assertThrows(HttpException.class,
                () -> repository.trends(TRACKING_ID, AdvancedStatsScope.NORMAL, FROM));
        assertEquals(List.of("read_advanced_stats_compact_trends_v2"), calls);
    }

    @Test
    void missingV2FunctionUsesLegacyCompatibilityPath() throws Exception {
        List<String> calls = new ArrayList<>();
        AdvancedStatsReadRepository repository = repository((function, body) -> {
            calls.add(function);
            if (function.endsWith("_v2")) {
                throw new HttpException(404, "{\"code\":\"PGRST202\",\"message\":\"function does not exist\"}");
            }
            return "{\"summary\":{\"attacks\":1,\"lootKnownAttackCount\":1,\"goldLooted\":7,"
                    + "\"goldLootAverage\":7,\"goldLootBest\":7}}";
        });

        JsonObject result = repository.overview(TRACKING_ID, AdvancedStatsScope.NORMAL, FROM);

        assertEquals(List.of("read_advanced_stats_compact_overview_v2",
                "read_advanced_stats_compact_overview_v1"), calls);
        JsonObject summary = result.getAsJsonObject("summary");
        assertEquals(1, summary.get("lootAttackCount").getAsInt());
        assertEquals(7, summary.get("goldLooted").getAsInt());
        assertEquals(7, summary.get("averageGoldLooted").getAsInt());
        assertEquals(7, summary.get("bestGoldLooted").getAsInt());
    }

    @Test
    void zeroReliableLootKeepsExactCountAndMarksAmountsUnknown() throws Exception {
        AdvancedStatsReadRepository repository = repository((function, body) ->
                "{\"summary\":{\"attacks\":4,\"lootAttackCount\":0,\"goldLooted\":0,"
                        + "\"elixirLooted\":0,\"darkElixirLooted\":0}}" );

        JsonObject summary = repository.overview(TRACKING_ID, AdvancedStatsScope.NORMAL, FROM)
                .getAsJsonObject("summary");

        assertEquals(0, summary.get("lootAttackCount").getAsInt());
        assertTrue(summary.get("goldLooted").isJsonNull());
        assertTrue(summary.get("averageGoldLooted").isJsonNull());
    }

    @Test
    void lifetimeUsesTheDedicatedRpcWithoutInventingMissingFields() throws Exception {
        List<String> calls = new ArrayList<>();
        List<JsonObject> bodies = new ArrayList<>();
        AdvancedStatsReadRepository repository = repository((function, body) -> {
            calls.add(function);
            bodies.add(JsonParser.parseString(body).getAsJsonObject());
            return "{\"summary\":{\"totalStars\":7}}";
        });

        JsonObject result = repository.lifetime(TRACKING_ID);

        assertEquals(List.of("read_advanced_stats_lifetime_v1"), calls);
        assertEquals(TRACKING_ID.toString(), bodies.getFirst().get("p_tracking_id").getAsString());
        assertEquals(7, result.getAsJsonObject("summary").get("totalStars").getAsInt());
        assertTrue(!result.has("starDistribution"));
    }

    private AdvancedStatsReadRepository repository(AdvancedStatsReadRepository.RpcClient rpc) {
        return new AdvancedStatsReadRepository(new AdvancedStatsRepository(), rpc);
    }
}

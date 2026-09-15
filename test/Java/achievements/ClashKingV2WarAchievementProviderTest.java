package Java.achievements;

import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ClashKingV2WarAchievementProviderTest {
    private HttpServer server;
    private final List<String> requests = new CopyOnWriteArrayList<>();

    @AfterEach
    void stopServer() {
        if (server != null) server.stop(0);
    }

    @Test
    void validEmptyItemsEnvelopeIsAvailableWithKnownZeros() {
        start((exchange, target) -> send(exchange, 200, "{\"items\":[]}"));

        ClashKingV2AchievementMetrics.Result result = metrics().collect("p0l");

        assertTrue(result.warAvailable());
        assertTrue(result.cwlAvailable());
        assertEquals(0L, result.metrics().get("war_attacks"));
        assertEquals(0L, result.metrics().get("def_attacks"));
        assertEquals(0L, result.metrics().get("cwl_attacks"));
        assertEquals(List.of(
                "/v2/player/%23P0L/war/stats?type=random&limit=500",
                "/v2/player/%23P0L/cwl/history?limit=500"
        ), requests);
    }

    @Test
    void populatedEnvelopesReduceWarDefenseAndCwlFamilies() {
        start((exchange, target) -> send(exchange, 200, target.contains("cwl/history")
                ? cwlFixture()
                : warFixture()));

        ClashKingV2AchievementMetrics.Result result = metrics().collect("#P0L");
        Map<String, Long> values = result.metrics();

        assertEquals(1L, values.get("war_wars"));
        assertEquals(3L, values.get("war_attacks"));
        assertEquals(8L, values.get("war_stars"));
        assertEquals(2L, values.get("war_uphit_attacks"));
        assertEquals(1L, values.get("war_plus_two_attacks"));
        assertEquals(1L, values.get("war_uphit_three_stars"));
        assertEquals(0L, values.get("war_missed_attacks"));
        assertEquals(1L, values.get("def_attacks"));
        assertEquals(1L, values.get("def_one_stars"));
        assertEquals(1L, values.get("cwl_seasons_played"));
        assertEquals(2L, values.get("cwl_wars_played"));
        assertEquals(3L, values.get("cwl_attacks"));
        assertEquals(2L, values.get("cwl_uphit_attacks"));
        assertEquals(1L, values.get("cwl_plus_two_attacks"));
        assertEquals(1L, values.get("cwl_uphit_three_stars"));
        assertEquals(267L, values.get("cwl_average_stars"));
        assertEquals(9800L, values.get("cwl_average_destruction"));
        assertEquals(1L, values.get("cwl_top3_finishes"));
    }

    @Test
    void oppositeTownHallDirectionIsNotCalledAnUphit() {
        ClashKingV2WarAchievementProvider.SourceData war =
                new ClashKingV2WarAchievementProvider.SourceData(true, List.of(JsonParser.parseString(
                        "{\"player\":{\"tag\":\"#P0L\",\"townhallLevel\":17},"
                                + "\"attacks\":["
                                + "{\"stars\":3,\"destructionPercentage\":100,\"fresh\":true,"
                                + "\"player\":{\"tag\":\"#DOWN\",\"townhallLevel\":16}}],"
                                + "\"defenses\":[]}" ).getAsJsonObject()), "");

        Map<String, Long> values = ClashKingV2AchievementMetrics.reduce(
                new ClashKingV2WarAchievementProvider.Snapshot(
                        "#P0L", war,
                        new ClashKingV2WarAchievementProvider.SourceData(true, List.of(), "")
                )
        ).metrics();

        assertEquals(0L, values.get("war_uphit_attacks"));
        assertEquals(0L, values.get("war_plus_two_attacks"));
        assertEquals(1L, values.get("war_three_stars"));
    }

    @Test
    void repeatedSeasonRowsExposeMultiClanParticipation() {
        ClashKingV2WarAchievementProvider.SourceData cwl =
                new ClashKingV2WarAchievementProvider.SourceData(true, List.of(
                        JsonParser.parseString("{\"season\":\"2025-09\",\"clan\":{\"tag\":\"#A\"},\"attacks\":[]}").getAsJsonObject(),
                        JsonParser.parseString("{\"season\":\"2025-09\",\"clan\":{\"tag\":\"#B\"},\"attacks\":[]}").getAsJsonObject()
                ), "");
        ClashKingV2WarAchievementProvider.Snapshot snapshot =
                new ClashKingV2WarAchievementProvider.Snapshot(
                        "#P0L",
                        new ClashKingV2WarAchievementProvider.SourceData(true, List.of(), ""),
                        cwl
                );

        Map<String, Long> values = ClashKingV2AchievementMetrics.reduce(snapshot).metrics();

        assertEquals(1L, values.get("cwl_seasons_played"));
        assertEquals(2L, values.get("cwl_clans"));
        assertEquals(1L, values.get("cwl_multi_clan_seasons"));
    }

    @Test
    void cwlComebackUsesChronologicalAttackOrder() {
        ClashKingV2WarAchievementProvider.SourceData cwl =
                new ClashKingV2WarAchievementProvider.SourceData(true, List.of(
                        JsonParser.parseString("""
                                {"season":"2025-09","townHallLevel":17,
                                 "clan":{"tag":"#A","wars":{"won":1,"lost":0,"tied":0}},
                                 "attacks":[
                                   {"order":2,"stars":3,"destructionPercentage":100,
                                    "defender":{"townHallLevel":17}},
                                   {"order":1,"stars":1,"destructionPercentage":50,
                                    "defender":{"townHallLevel":17}}]}
                                """).getAsJsonObject()
                ), "");

        Map<String, Long> values = ClashKingV2AchievementMetrics.reduce(
                new ClashKingV2WarAchievementProvider.Snapshot(
                        "#P0L",
                        new ClashKingV2WarAchievementProvider.SourceData(true, List.of(), ""),
                        cwl
                )
        ).metrics();

        assertEquals(1L, values.get("cwl_comeback"));
    }

    private ClashKingV2AchievementMetrics metrics() {
        return new ClashKingV2AchievementMetrics(baseUrl());
    }

    private String baseUrl() {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    private void start(Handler handler) {
        try {
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        } catch (IOException error) {
            throw new IllegalStateException(error);
        }
        server.createContext("/", exchange -> {
            String target = exchange.getRequestURI().getRawPath()
                    + (exchange.getRequestURI().getRawQuery() == null
                    ? "" : "?" + exchange.getRequestURI().getRawQuery());
            requests.add(target);
            handler.handle(exchange, target);
        });
        server.start();
    }

    private static void send(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        try (var output = exchange.getResponseBody()) {
            output.write(bytes);
        }
    }

    private static String warFixture() {
        return """
                {"items":[{"teamSize":5,"attacksPerMember":1,"endTime":"2026-08-01T00:00:00Z",
                "player":{"tag":"#P0L","townhallLevel":17},
                "clan":{"stars":8,"destructionPercentage":92},
                "opponent":{"stars":7,"destructionPercentage":91},
                "attacks":[
                  {"stars":3,"destructionPercentage":100,"fresh":true,"player":{"tag":"#A","townhallLevel":17}},
                  {"stars":2,"destructionPercentage":95,"fresh":false,"player":{"tag":"#B","townhallLevel":18}},
                  {"stars":3,"destructionPercentage":99,"fresh":true,"player":{"tag":"#C","townhallLevel":19}}],
                "defenses":[{"stars":1,"destructionPercentage":50,"fresh":true,"player":{"tag":"#D","townhallLevel":17}}]}]}
                """;
    }

    private static String cwlFixture() {
        return """
                {"items":[{"season":"2025-09","townHallLevel":17,"teamSize":15,"missedAttacks":0,
                "clan":{"tag":"#CLAN","wars":{"won":3,"lost":2,"tied":0}},
                "placement":{"global":2,"group":1},"attacks":[
                  {"warTag":"#W1","round":1,"opponent":{"tag":"#O","name":"O"},
                   "defender":{"tag":"#D1","name":"D1","townHallLevel":18,"mapPosition":1},
                   "stars":3,"destructionPercentage":100,"order":1,"duration":180},
                  {"warTag":"#W1","round":2,"opponent":{"tag":"#O","name":"O"},
                   "defender":{"tag":"#D2","name":"D2","townHallLevel":19,"mapPosition":2},
                   "stars":2,"destructionPercentage":99,"order":2,"duration":180},
                  {"warTag":"#W2","round":3,"opponent":{"tag":"#O","name":"O"},
                   "defender":{"tag":"#D3","name":"D3","townHallLevel":17,"mapPosition":3},
                   "stars":3,"destructionPercentage":95,"order":3,"duration":180}]}]}
                """;
    }

    @FunctionalInterface
    private interface Handler {
        void handle(HttpExchange exchange, String target) throws IOException;
    }
}

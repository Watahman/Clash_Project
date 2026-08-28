package Java.performance;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

class ClashKingProviderNormalizationTest {
    private HttpServer server;

    @AfterEach
    void stopServer() {
        if (server != null) server.stop(0);
    }

    @Test
    void usesSharedHistoryWindowForCwlAndRandom() {
        Instant now = Instant.parse("2026-08-27T12:00:00Z");

        assertEquals(
                now.minus(180, ChronoUnit.DAYS),
                ClashKingV2Provider.historyStart("cwl", now)
        );
        assertEquals(
                now.minus(180, ChronoUnit.DAYS),
                ClashKingV2Provider.historyStart("random", now)
        );
        assertEquals(180, ClashKingV2Provider.HISTORY_DAYS);
    }

    @Test
    void keepsRegularHistoryWhenCwlHistoryFails() throws Exception {
        AtomicInteger requests = new AtomicInteger();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            requests.incrementAndGet();
            String query = exchange.getRequestURI().getRawQuery();
            if (query != null && query.contains("type=cwl")) {
                send(exchange, 503, "{\"error\":\"cwl unavailable\"}");
                return;
            }
            send(exchange, 200, """
                    {"items":[{
                      "attacksPerMember":1,
                      "endTime":"20260725T120000.000Z",
                      "player":{"tag":"#P0L","townhallLevel":17},
                      "attacks":[{
                        "stars":3,"destructionPercentage":100,"order":1,
                        "player":{"tag":"#P2Y","townhallLevel":17}
                      }]
                    }]}
                    """);
        });
        server.start();

        ClashKingV2Provider provider = new ClashKingV2Provider(
                "http://127.0.0.1:" + server.getAddress().getPort()
        );
        Map<String, HistoricalPlayerData> history = provider.getPlayerWarHistory(List.of("#P0L"));

        assertEquals(2, requests.get());
        assertTrue(history.get("#P0L").available());
        assertEquals(1, history.get("#P0L").attacks().size());
        assertEquals(HistoricalWarType.REGULAR, history.get("#P0L").attacks().getFirst().warType());
    }

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
                  "type":"",
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

    private static void send(
            com.sun.net.httpserver.HttpExchange exchange,
            int status,
            String body
    ) throws IOException {
        byte[] bytes = body.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(status, bytes.length);
        try (var output = exchange.getResponseBody()) {
            output.write(bytes);
        }
    }
}

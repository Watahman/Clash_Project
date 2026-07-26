package Java;

import Java.performance.HistoricalPlayerData;
import Java.performance.HistoricalPlayerDataProvider;
import Java.performance.PlayerPerformanceService;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class API_PlayerPerformanceTest {
    private HttpServer server;

    @AfterEach
    void stopServer() {
        if (server != null) server.stop(0);
    }

    @Test
    void acceptsOneBatchAndReturnsNeutralPerTagResults() throws Exception {
        Config config = new Config();
        HistoricalPlayerDataProvider provider = new HistoricalPlayerDataProvider() {
            @Override
            public Map<String, HistoricalPlayerData> getPlayerWarHistory(List<String> tags) {
                Map<String, HistoricalPlayerData> result = new LinkedHashMap<>();
                tags.forEach(tag -> result.put(
                        tag, new HistoricalPlayerData(tag, List.of(), List.of(), "test", true)
                ));
                return result;
            }

            @Override
            public String providerName() {
                return "test";
            }
        };

        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        new API_PlayerPerformance(
                server, config, new PlayerPerformanceService(provider)
        ).postPlayerPerformance();
        server.start();

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(
                        "http://127.0.0.1:" + server.getAddress().getPort()
                                + config._EXT_PLAYER_PERFORMANCE
                ))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(
                        "{\"playerTags\":[\"#P0L\",\"#P2Y\"]}"
                ))
                .build();
        HttpResponse<String> response = HttpClient.newHttpClient()
                .send(request, HttpResponse.BodyHandlers.ofString());

        assertEquals(200, response.statusCode());
        assertTrue(response.body().contains("\"#P0L\""));
        assertTrue(response.body().contains("\"status\":\"not_enough_data\""));
        assertTrue(response.body().contains("\"reliabilityMessage\""));
    }
}

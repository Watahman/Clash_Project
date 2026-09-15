package Java.achievements;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ClashKingV2AchievementProviderTest {
    private HttpServer server;
    private List<String> requests;
    private String baseUrl;

    @BeforeEach
    void startServer() throws IOException {
        requests = new ArrayList<>();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", this::handle);
        server.start();
        baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @Test
    void fetchesEveryPublicSourceAndReducesTheirMetrics() {
        var result = new ClashKingV2AchievementProvider(baseUrl).collect("p123");

        assertTrue(result.available());
        assertEquals(250L, result.metrics().get("sea_donations"));
        assertEquals(2L, result.metrics().get("social_clans_visited"));
        assertEquals(100L, result.metrics().get("ranking_best_global_rank"));
        assertEquals(1L, result.metrics().get("ranking_double_rank"));
        assertEquals(1L, result.metrics().get("legend_ranked_seasons"));
        assertEquals(8, requests.size());
        assertTrue(requests.stream().anyMatch(path -> path.contains("/history/stats?type=donated")));
        assertTrue(requests.stream().anyMatch(path -> path.endsWith("/history/changes")));
        assertTrue(requests.stream().anyMatch(path -> path.endsWith("/join-leave/totals")));
        assertTrue(requests.stream().anyMatch(path -> path.endsWith("/rankings")));
    }

    @Test
    void validEmptyResponsesKeepEachCapabilityAvailableWithZeroMetrics() {
        var result = new ClashKingV2AchievementProvider(baseUrl).collect("empty");

        assertTrue(result.available());
        assertEquals(0L, result.metrics().get("sea_donations"));
        assertEquals(0L, result.metrics().get("sea_active_days"));
        assertEquals(0L, result.metrics().get("social_clans_visited"));
        assertEquals(0L, result.metrics().get("ranking_best_global_rank"));
        assertEquals(0L, result.metrics().get("legend_ranked_seasons"));
        assertTrue(result.coverage().getAsJsonObject("historyStats").get("available").getAsBoolean());
        assertTrue(result.coverage().getAsJsonObject("historyChanges").get("available").getAsBoolean());
    }

    @Test
    void malformedOneSourceIsUnavailableWithoutDiscardingOtherSources() {
        var result = new ClashKingV2AchievementProvider(baseUrl).collect("badchanges");
        JsonObject changes = result.coverage().getAsJsonObject("historyChanges");

        assertTrue(result.available());
        assertFalse(changes.get("available").getAsBoolean());
        assertTrue(result.coverage().getAsJsonObject("rankings").get("available").getAsBoolean());
        assertEquals(5000L, result.metrics().get("ranking_home_trophies"));
    }

    private void handle(HttpExchange exchange) throws IOException {
        String target = exchange.getRequestURI().getRawPath();
        String query = exchange.getRequestURI().getRawQuery();
        requests.add(target + (query == null ? "" : "?" + query));
        String body = fixture(target, query);
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(200, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }

    private String fixture(String path, String query) {
        String normalizedPath = path.toLowerCase();
        if (path.endsWith("/history/changes")) {
            if (normalizedPath.contains("empty")) return "{\"items\":[]}";
            return normalizedPath.contains("badchanges") ? "{\"items\":{}}" : changes();
        }
        if (path.endsWith("/join-leave/totals")) return normalizedPath.contains("empty") ? "{\"items\":[]}" : joins();
        if (path.endsWith("/rankings")) {
            return normalizedPath.contains("empty") ? "{\"tag\":\"#EMPTY\"}"
                    : rankings(normalizedPath.contains("badchanges") ? "#BADCHANGES" : "#P123");
        }
        if (path.endsWith("/legend-history")) return normalizedPath.contains("empty") ? "{\"items\":[]}" : legend();
        if (path.endsWith("/history/stats")) return normalizedPath.contains("empty") ? "{\"items\":[]}" : stats(query);
        return "{}";
    }

    private String stats(String query) {
        String type = query == null ? "" : query.replace("type=", "");
        long current = switch (type) {
            case "donated" -> 250L;
            case "received" -> 100L;
            case "clan_games" -> 500L;
            default -> 700L;
        };
        return "{\"items\":[{\"eventTime\":\"2026-09-01T00:00:00Z\",\"clanTag\":null,\"statType\":\""
                + type + "\",\"previousValue\":0,\"currentValue\":" + current
                + ",\"delta\":" + current + "}]}";
    }

    private String changes() {
        return "{\"items\":[{\"time\":\"2026-09-01T00:00:00Z\",\"townhall_level\":16,\"type\":\"hero_upgrade\",\"previous\":{\"level\":70},\"current\":{\"level\":72}}]}";
    }

    private String joins() {
        return "{\"items\":[{\"clan\":{\"name\":\"A\",\"tag\":\"#A\"},\"visits\":2,\"minutes\":50},"
                + "{\"clan\":{\"name\":\"B\",\"tag\":\"#B\"},\"visits\":1,\"minutes\":25}]}";
    }

    private String rankings(String tag) {
        return "{\"tag\":\"" + tag + "\",\"homeVillage\":{\"trophies\":5000,\"globalRank\":100,\"localRank\":20},"
                + "\"builderBase\":{\"trophies\":3000,\"globalRank\":200,\"localRank\":40}}";
    }

    private String legend() {
        return "{\"items\":[{\"tag\":\"#P123\",\"name\":\"Player\",\"season\":\"2025-09\",\"trophies\":5100,\"rank\":12345}]}";
    }
}

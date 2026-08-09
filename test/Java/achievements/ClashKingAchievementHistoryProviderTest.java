package Java.achievements;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ClashKingAchievementHistoryProviderTest {
    private HttpServer server;
    private List<String> requests;
    private String baseUrl;

    @BeforeEach
    void startServer() throws IOException {
        requests = new CopyOnWriteArrayList<>();
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
    void providersUseEncodedLegacyRoutesAndTemporaryCaches() throws Exception {
        ClashKingRaidHistoryProvider raids = new ClashKingRaidHistoryProvider(baseUrl);
        ClashKingLegendHistoryProvider legends = new ClashKingLegendHistoryProvider(baseUrl);

        assertEquals(1, raids.getHistory("#pql").records().size());
        assertEquals(1, raids.getHistory("pql").records().size());
        assertEquals(1, legends.getHistory("#pql").records().size());
        assertEquals(1, legends.getHistory("PQL").records().size());

        assertEquals(List.of(
                "/player/%23PQL/raids?limit=100",
                "/player/%23PQL/legend_rankings"
        ), requests);
    }

    @Test
    void legendProviderAlsoAcceptsLegacyTopLevelArray() throws Exception {
        ClashKingLegendHistoryProvider legends = new ClashKingLegendHistoryProvider(baseUrl);

        assertEquals(1, legends.getHistory("#ARRAY").records().size());
        assertEquals(List.of("/player/%23ARRAY/legend_rankings"), requests);
    }

    @Test
    void legendProviderRejectsAnUnrelatedObjectShape() {
        ClashKingLegendHistoryProvider legends = new ClashKingLegendHistoryProvider(baseUrl);

        Java.HttpException error = assertThrows(
                Java.HttpException.class,
                () -> legends.getHistory("#BAD")
        );

        assertEquals(502, error.getStatusCode());
    }

    private void handle(HttpExchange exchange) throws IOException {
        String query = exchange.getRequestURI().getRawQuery();
        String target = exchange.getRequestURI().getRawPath()
                + (query == null ? "" : "?" + query);
        requests.add(target);
        String body = target.contains("%23BAD")
                ? "{\"Count\":0}"
                : target.contains("%23ARRAY")
                ? "[{\"tag\":\"#ARRAY\",\"name\":\"Player\",\"trophies\":5100,"
                    + "\"rank\":12345,\"season\":\"2025-09\"}]"
                : target.endsWith("/legend_rankings")
                ? "{\"value\":[{\"tag\":\"#PQL\",\"name\":\"Player\",\"trophies\":5100,"
                    + "\"rank\":12345,\"season\":\"2025-09\"}],\"Count\":1}"
                : "{\"items\":[{\"state\":\"ended\",\"startTime\":\"20250926T070000.000Z\","
                    + "\"endTime\":\"20250929T070000.000Z\",\"members\":[{\"tag\":\"#PQL\","
                    + "\"name\":\"Player\",\"attacks\":6,\"attackLimit\":5,\"bonusAttackLimit\":1,"
                    + "\"capitalResourcesLooted\":24000}]}]}";
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(200, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }
}

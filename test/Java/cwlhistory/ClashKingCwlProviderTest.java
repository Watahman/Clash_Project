package Java.cwlhistory;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ClashKingCwlProviderTest {
    private HttpServer server;
    private AtomicReference<String> lastRawPath;
    private AtomicReference<Response> response;
    private ClashKingLegacyCwlProvider provider;

    @BeforeEach
    void startServer() throws IOException {
        lastRawPath = new AtomicReference<>();
        response = new AtomicReference<>(new Response(200, "{}"));
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", this::handle);
        server.start();
        provider = new ClashKingLegacyCwlProvider(
                "http://127.0.0.1:" + server.getAddress().getPort()
        );
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @Test
    void usesTheCurrentBasicEndpointForTheSeasonIndex() throws Exception {
        response.set(new Response(
                200,
                """
                {
                  "changes": {
                    "clanWarLeague": {
                      "2026-06": "Master League II"
                    }
                  }
                }
                """
        ));

        List<HistoricalCwlSeasonSummary> seasons =
                provider.getAvailableSeasons("#PQL", 8);

        assertEquals("/clan/%23PQL/basic", lastRawPath.get());
        assertEquals(1, seasons.size());
        assertEquals("2026-06", seasons.getFirst().season());
    }

    @Test
    void usesTheDocumentedCwlSeasonEndpointAndEncoding() throws Exception {
        response.set(new Response(
                200,
                """
                {
                  "season": "2026-06",
                  "state": "ended",
                  "clans": [{"tag": "#PQL", "name": "ClashPanel"}],
                  "rounds": []
                }
                """
        ));

        provider.getSeason("#PQL", "2026-06");

        assertEquals("/cwl/%23PQL/2026-06", lastRawPath.get());
    }

    @Test
    void returnsAnEmptyIndexWhenClashKingHasNoClanHistory()
            throws Exception {
        response.set(new Response(404, "{\"detail\":\"Not Found\"}"));

        List<HistoricalCwlSeasonSummary> seasons =
                provider.getAvailableSeasons("#PQL", 8);

        assertEquals(List.of(), seasons);
        assertEquals("/clan/%23PQL/basic", lastRawPath.get());
    }

    private void handle(HttpExchange exchange) throws IOException {
        lastRawPath.set(exchange.getRequestURI().getRawPath());
        Response current = response.get();
        byte[] body = current.body().getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(current.status(), body.length);
        exchange.getResponseBody().write(body);
        exchange.close();
    }

    private record Response(int status, String body) {}
}

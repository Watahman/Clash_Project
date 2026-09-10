package Java.performance;

import Java.HttpException;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ClashKingHttpClientTest {
    private HttpServer server;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.start();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @Test
    void preservesUpstreamRateLimitStatus() throws Exception {
        server.createContext("/rate", exchange -> respond(
                exchange, 429, "{\"error\":\"slow down\"}"
        ));
        ClashKingHttpClient client = client(Duration.ofSeconds(1));

        HttpException error = assertThrows(HttpException.class, () ->
                client.get("/rate"));

        assertEquals(429, error.getStatusCode());
        assertEquals("ClashKing", error.getUpstream());
    }

    @Test
    void mapsAnUpstreamTimeoutToAnExplicitSafeStatus() throws Exception {
        server.createContext("/slow", exchange -> {
            try {
                Thread.sleep(250);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
            }
            exchange.close();
        });
        ClashKingHttpClient client = client(Duration.ofMillis(40));

        HttpException error = assertThrows(HttpException.class, () ->
                client.get("/slow"));

        assertEquals(504, error.getStatusCode());
        assertEquals("ClashKing", error.getUpstream());
    }

    private ClashKingHttpClient client(Duration timeout) {
        return new ClashKingHttpClient(
                "http://127.0.0.1:" + server.getAddress().getPort(),
                "ClashKing",
                "",
                timeout
        );
    }

    private static void respond(
            HttpExchange exchange,
            int status,
            String body
    ) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }
}

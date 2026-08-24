package Java;

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
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ClashApiClientTest {
    private HttpServer server;
    private List<String> receivedKeys;
    private AtomicInteger attempts;

    @BeforeEach
    void startServer() throws IOException {
        receivedKeys = new CopyOnWriteArrayList<>();
        attempts = new AtomicInteger();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.start();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @Test
    void rateLimitUsesAnotherKeyAndKeepsTheFirstCoolingDown() throws Exception {
        server.createContext("/players", exchange -> {
            receivedKeys.add(exchange.getRequestHeaders().getFirst("Authorization"));
            int status = attempts.getAndIncrement() == 0 ? 429 : 200;
            exchange.getResponseHeaders().set("Retry-After", "120");
            respond(exchange, status, status == 200 ? "{\"ok\":true}" : "{}");
        });
        ClashApiClient client = client("first", "second");

        assertEquals("{\"ok\":true}", client.get(url("/players")));
        assertEquals("{\"ok\":true}", client.get(url("/players")));
        assertEquals(
                List.of("Bearer first", "Bearer second", "Bearer second"),
                receivedKeys
        );
    }

    @Test
    void authenticationFailureDisablesOnlyTheRejectedKey() throws Exception {
        server.createContext("/players", exchange -> {
            String key = exchange.getRequestHeaders().getFirst("Authorization");
            receivedKeys.add(key);
            respond(exchange, key.endsWith("first") ? 401 : 200, "{}");
        });
        ClashApiClient client = client("first", "second");

        client.get(url("/players"));
        client.get(url("/players"));

        assertEquals(
                List.of("Bearer first", "Bearer second", "Bearer second"),
                receivedKeys
        );
    }

    @Test
    void oneConfiguredKeyHandlesSuccessfulRequests() throws Exception {
        server.createContext("/players", exchange -> {
            receivedKeys.add(exchange.getRequestHeaders().getFirst("Authorization"));
            respond(exchange, 200, "{\"ok\":true}");
        });
        ClashApiClient client = client("only");

        assertEquals("{\"ok\":true}", client.get(url("/players")));
        assertEquals(List.of("Bearer only"), receivedKeys);
    }

    @Test
    void retriesAreBoundedToOneAttemptPerConfiguredKey() throws Exception {
        server.createContext("/players", exchange -> {
            attempts.incrementAndGet();
            exchange.getResponseHeaders().set("Retry-After", "60");
            respond(exchange, 429, "{}");
        });
        ClashApiClient client = client("first", "second", "third");

        HttpException first = assertThrows(
                HttpException.class,
                () -> client.get(url("/players"))
        );
        HttpException second = assertThrows(
                HttpException.class,
                () -> client.get(url("/players"))
        );

        assertEquals(429, first.getStatusCode());
        assertEquals(503, second.getStatusCode());
        assertEquals(3, attempts.get());
    }

    @Test
    void noConfiguredKeysFailsWithoutOpeningAConnection() {
        ClashApiClient client = client();

        HttpException error = assertThrows(
                HttpException.class,
                () -> client.get(url("/players"))
        );

        assertEquals(503, error.getStatusCode());
        assertEquals(0, attempts.get());
    }

    @Test
    void serverErrorsAreNotRetriedAndSecretsStayOutOfPublicErrors() throws Exception {
        server.createContext("/players", exchange -> {
            attempts.incrementAndGet();
            String key = exchange.getRequestHeaders().getFirst("Authorization");
            respond(exchange, 500, "{\"debug\":\"" + key + "\"}");
        });
        ClashApiClient client = client("dummy-secret-value", "second");

        HttpException error = assertThrows(
                HttpException.class,
                () -> client.get(url("/players"))
        );

        assertEquals(1, attempts.get());
        assertFalse(error.getMessage().contains("dummy-secret-value"));
        assertFalse(API_Utils.publicErrorBody(error).contains("dummy-secret-value"));
    }

    @Test
    void parsesServerRetryAfterFormats() {
        assertEquals(5_000L, ClashApiClient.parseRetryAfter("5", 1_000L));
        assertEquals(
                4_000L,
                ClashApiClient.parseRetryAfter(
                        "Thu, 01 Jan 1970 00:00:05 GMT",
                        1_000L
                )
        );
        assertEquals(0L, ClashApiClient.parseRetryAfter("invalid", 1_000L));
    }

    private ClashApiClient client(String... keys) {
        return new ClashApiClient(
                new ClashApiKeyPool(List.of(keys), System::currentTimeMillis),
                60_000L,
                300_000L
        );
    }

    private String url(String path) {
        return "http://127.0.0.1:" + server.getAddress().getPort() + path;
    }

    private void respond(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }
}

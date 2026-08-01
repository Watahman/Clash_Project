package Java;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ClashApiKeyPoolTest {
    @Test
    void rotatesConfiguredKeysAndNormalizesBearerPrefix() {
        Config config = configWithKeys("first", "bearer second", "Bearer third");

        assertEquals(List.of("Bearer first", "Bearer second", "Bearer third"), config.getClashApiKeysForRequest());
        assertEquals(List.of("Bearer second", "Bearer third", "Bearer first"), config.getClashApiKeysForRequest());
        assertEquals(List.of("Bearer third", "Bearer first", "Bearer second"), config.getClashApiKeysForRequest());
    }

    @Test
    void removesDuplicateAndBlankKeys() {
        Config config = configWithKeys("same", "Bearer same", " ");

        assertEquals(List.of("Bearer same"), config.getClashApiKeysForRequest());
    }

    @Test
    void retriesAnotherKeyAfterRateLimit() throws Exception {
        List<String> receivedKeys = new ArrayList<>();
        AtomicInteger attempts = new AtomicInteger();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/players", exchange -> {
            receivedKeys.add(exchange.getRequestHeaders().getFirst("Authorization"));
            int status = attempts.getAndIncrement() == 0 ? 429 : 200;
            byte[] body = (status == 200 ? "{\"ok\":true}" : "{\"reason\":\"rateLimit\"}")
                    .getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();

        try {
            API_Utils utils = new API_Utils(configWithKeys("first", "second", "third"));
            String response = utils.getClashApiResponse(
                    "http://127.0.0.1:" + server.getAddress().getPort() + "/players"
            );

            assertEquals("{\"ok\":true}", response);
            assertEquals(List.of("Bearer first", "Bearer second"), receivedKeys);
        } finally {
            server.stop(0);
        }
    }

    @Test
    void doesNotRetryUnrelatedServerErrors() throws Exception {
        AtomicInteger attempts = new AtomicInteger();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/players", exchange -> {
            attempts.incrementAndGet();
            byte[] body = "{\"reason\":\"maintenance\"}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(500, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();

        try {
            API_Utils utils = new API_Utils(configWithKeys("first", "second", "third"));
            assertThrows(HttpException.class, () -> utils.getClashApiResponse(
                    "http://127.0.0.1:" + server.getAddress().getPort() + "/players"
            ));
            assertEquals(1, attempts.get());
        } finally {
            server.stop(0);
        }
    }

    private Config configWithKeys(String first, String second, String third) {
        Config config = new Config();
        config._API_KEY_ALL = first;
        config._API_KEY_ALL2 = second;
        config._API_KEY_ALL3 = third;
        config._CACHE_ENABLED = "false";
        return config;
    }
}

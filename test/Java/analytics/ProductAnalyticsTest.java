package Java.analytics;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProductAnalyticsTest {
    @Test
    void payloadContainsOnlySafeIdentityAndServerProperties() {
        JsonObject payload = ProductAnalytics.buildPayload(
                "phc_test",
                AnalyticsEvent.DATA_SAVED,
                Map.of("tool", "cwl_planner", "action", "plan_created", "entity_type", "plan"),
                "profile-123",
                true,
                "production",
                "internal"
        );

        JsonObject properties = payload.getAsJsonObject("properties");
        assertEquals("profile-123", payload.get("distinct_id").getAsString());
        assertTrue(properties.get("logged_in").getAsBoolean());
        assertEquals("production", properties.get("environment").getAsString());
        assertEquals("internal", properties.get("traffic_type").getAsString());
        assertFalse(properties.has("email"));
        assertFalse(properties.has("playerTag"));
        assertFalse(payload.has("response"));
        assertFalse(properties.has("$process_person_profile"));
    }

    @Test
    void anonymousPayloadDoesNotCreateAPersonProfile() {
        JsonObject payload = ProductAnalytics.buildPayload(
                "phc_test", AnalyticsEvent.TOOL_OPENED,
                Map.of("tool", "minigames"), "anonymous-session", false,
                "development", "external"
        );

        assertEquals("anonymous-session", payload.get("distinct_id").getAsString());
        assertFalse(payload.getAsJsonObject("properties")
                .get("$process_person_profile").getAsBoolean());
    }

    @Test
    void captureCompletesBeforeReturningAndPreservesPayload() throws Exception {
        AtomicReference<JsonObject> received = new AtomicReference<>();
        AtomicBoolean responded = new AtomicBoolean();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/i/v0/e/", exchange -> {
            received.set(JsonParser.parseString(new String(
                    exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8
            )).getAsJsonObject());
            exchange.sendResponseHeaders(200, 2);
            responded.set(true);
            try (var body = exchange.getResponseBody()) {
                body.write("ok".getBytes(StandardCharsets.UTF_8));
            }
        });
        server.start();
        try {
            ProductAnalytics analytics = new ProductAnalytics(endpoint(server));
            analytics.captureAuthenticated(AnalyticsEvent.DATA_SAVED,
                    Map.of("tool", "cwl_planner", "action", "plan_created"), "profile-123");

            assertEquals("profile-123", received.get().get("distinct_id").getAsString());
            assertEquals(AnalyticsEvent.DATA_SAVED, received.get().get("event").getAsString());
            assertTrue(responded.get(), "Capture must finish before returning");
        } finally {
            server.stop(0);
        }
    }

    @Test
    void normalCrossRegionLatencyStillCompletesCapture() throws Exception {
        AtomicBoolean responded = new AtomicBoolean();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/i/v0/e/", exchange -> {
            try {
                Thread.sleep(350);
                exchange.sendResponseHeaders(200, -1);
                responded.set(true);
            } catch (Exception ignored) {
            } finally {
                exchange.close();
            }
        });
        server.start();
        try {
            new ProductAnalytics(endpoint(server)).captureAuthenticated(
                    AnalyticsEvent.DATA_SAVED, Map.of("tool", "cwl_planner"), "profile-123");
            assertTrue(responded.get(), "Capture should tolerate normal cross-region latency");
        } finally {
            server.stop(0);
        }
    }

    @Test
    void slowPosthogTimesOutWithoutFailingTheProductRequest() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/i/v0/e/", exchange -> {
            try {
                Thread.sleep(1500);
                exchange.sendResponseHeaders(200, -1);
            } catch (Exception ignored) {
                // The client has already timed out and dropped the event.
            } finally {
                exchange.close();
            }
        });
        server.start();
        try {
            long started = System.nanoTime();
            new ProductAnalytics(endpoint(server)).captureAuthenticated(
                    AnalyticsEvent.DATA_SAVED, Map.of("tool", "cwl_planner"), "profile-123");
            long elapsedMillis = (System.nanoTime() - started) / 1_000_000;
            assertTrue(elapsedMillis < 1200, "Analytics must not wait indefinitely for a slow PostHog response");
        } finally {
            server.stop(0);
        }
    }

    private static URI endpoint(HttpServer server) {
        return URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/i/v0/e/");
    }
}

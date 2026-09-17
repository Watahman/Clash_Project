package Java.analytics;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AnalyticsEventTest {
    @Test
    void acceptsTheClientEnvelopeAndKnownProperties() {
        JsonObject body = new JsonObject();
        body.addProperty("event", AnalyticsEvent.CORE_ACTION_COMPLETED);
        body.addProperty("anonymous_id", "anon_123");
        JsonObject properties = new JsonObject();
        properties.addProperty("tool", "cwl_planner");
        properties.addProperty("action", "plan_created");
        properties.addProperty("entity_type", "plan");
        properties.addProperty("mode", "manual");
        properties.addProperty("result_status", "complete");
        properties.addProperty("source", "frontend");
        body.add("properties", properties);

        assertDoesNotThrow(() -> AnalyticsEvent.validateClientEnvelope(body));
        assertDoesNotThrow(() -> AnalyticsEvent.validateServerProperties(
                java.util.Map.of("mode", "manual", "result_status", "complete", "source", "frontend")
        ));
    }

    @Test
    void acceptsSanitizedPageView() {
        JsonObject body = pageViewEnvelope("https://clashpanel.com/app/cwl-planner");
        assertDoesNotThrow(() -> AnalyticsEvent.validateClientEnvelope(body));
    }

    @Test
    void rejectsPageViewWithQueryFragmentOrExtraProperties() {
        assertThrows(IllegalArgumentException.class, () -> AnalyticsEvent.validateClientEnvelope(
                pageViewEnvelope("https://clashpanel.com/app/cwl-planner?token=secret")
        ));
        assertThrows(IllegalArgumentException.class, () -> AnalyticsEvent.validateClientEnvelope(
                pageViewEnvelope("https://clashpanel.com/app/cwl-planner#private")
        ));

        JsonObject body = pageViewEnvelope("https://clashpanel.com/app/cwl-planner");
        body.getAsJsonObject("properties").addProperty("email", "not-allowed");
        assertThrows(IllegalArgumentException.class, () -> AnalyticsEvent.validateClientEnvelope(body));
    }

    @Test
    void rejectsPageViewWithoutCurrentUrl() {
        JsonObject body = new JsonObject();
        body.addProperty("event", AnalyticsEvent.PAGE_VIEW);
        body.addProperty("anonymous_id", "anon_123");
        body.add("properties", new JsonObject());

        assertThrows(IllegalArgumentException.class, () -> AnalyticsEvent.validateClientEnvelope(body));
    }

    @Test
    void rejectsUnknownPropertiesAndTopLevelFields() {
        JsonObject body = new JsonObject();
        body.addProperty("event", AnalyticsEvent.DATA_SAVED);
        body.addProperty("anonymous_id", "anon_123");
        JsonObject properties = new JsonObject();
        properties.addProperty("email", "not-allowed");
        body.add("properties", properties);

        assertThrows(IllegalArgumentException.class, () -> AnalyticsEvent.validateClientEnvelope(body));

        body.remove("properties");
        body.add("properties", new JsonObject());
        body.addProperty("response", "never-allowed");
        assertThrows(IllegalArgumentException.class, () -> AnalyticsEvent.validateClientEnvelope(body));
    }

    private static JsonObject pageViewEnvelope(String currentUrl) {
        JsonObject body = new JsonObject();
        body.addProperty("event", AnalyticsEvent.PAGE_VIEW);
        body.addProperty("anonymous_id", "anon_123");
        JsonObject properties = new JsonObject();
        properties.addProperty("$current_url", currentUrl);
        body.add("properties", properties);
        return body;
    }
}

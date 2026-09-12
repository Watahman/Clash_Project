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
}

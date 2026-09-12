package Java.analytics;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import java.util.Map;

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
}

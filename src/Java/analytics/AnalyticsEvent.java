package Java.analytics;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.Map;
import java.util.Set;

/** The deliberately small product-event contract shared by client and server capture. */
public final class AnalyticsEvent {
    public static final String TOOL_OPENED = "tool_opened";
    public static final String TAG_SUBMITTED = "tag_submitted";
    public static final String ENTITY_LOAD_SUCCEEDED = "entity_load_succeeded";
    public static final String ENTITY_LOAD_FAILED = "entity_load_failed";
    public static final String CORE_ACTION_COMPLETED = "core_action_completed";
    public static final String DATA_SAVED = "data_saved";
    public static final String ACCOUNT_CREATED = "account_created";
    public static final String TRACKING_ENABLED = "tracking_enabled";

    private static final Set<String> TOP_LEVEL_FIELDS = Set.of(
            "event", "properties", "anonymous_id", "anonymous_internal"
    );
    private static final Map<String, Set<String>> CLIENT_PROPERTIES = Map.of(
            TOOL_OPENED, clientPropertySet(),
            TAG_SUBMITTED, clientPropertySet(),
            ENTITY_LOAD_SUCCEEDED, clientPropertySet(),
            ENTITY_LOAD_FAILED, clientPropertySet(),
            CORE_ACTION_COMPLETED, clientPropertySet(),
            DATA_SAVED, clientPropertySet(),
            ACCOUNT_CREATED, clientPropertySet(),
            TRACKING_ENABLED, clientPropertySet()
    );
    private static final Set<String> SERVER_PROPERTIES = clientPropertySet();

    private AnalyticsEvent() {
    }

    private static Set<String> clientPropertySet() {
        return Set.of("tool", "action", "entity_type", "mode", "outcome", "result_status", "source");
    }

    public static boolean isKnown(String event) {
        return event != null && CLIENT_PROPERTIES.containsKey(event);
    }

    public static Set<String> clientPropertiesFor(String event) {
        return CLIENT_PROPERTIES.getOrDefault(event, Set.of());
    }

    public static Set<String> serverProperties() {
        return SERVER_PROPERTIES;
    }

    public static void validateClientEnvelope(JsonObject body) {
        for (String field : body.keySet()) {
            if (!TOP_LEVEL_FIELDS.contains(field)) {
                throw new IllegalArgumentException("Onbekend analyticsveld: " + field);
            }
        }
        requireString(body, "event", 64);
        String event = body.get("event").getAsString();
        if (!isKnown(event)) throw new IllegalArgumentException("Onbekend analytics event");
        requireString(body, "anonymous_id", 128);
        JsonElement properties = body.get("properties");
        if (properties == null || !properties.isJsonObject()) {
            throw new IllegalArgumentException("Analytics properties moeten een object zijn");
        }
        validateProperties(event, properties.getAsJsonObject(), clientPropertiesFor(event));
        JsonElement internal = body.get("anonymous_internal");
        if (internal != null && (!internal.isJsonPrimitive()
                || !internal.getAsJsonPrimitive().isBoolean())) {
            throw new IllegalArgumentException("anonymous_internal moet boolean zijn");
        }
    }

    public static void validateServerProperties(Map<String, String> properties) {
        for (Map.Entry<String, String> entry : properties.entrySet()) {
            if (!SERVER_PROPERTIES.contains(entry.getKey())) {
                throw new IllegalArgumentException("Onbekend analytics property");
            }
            validateValue(entry.getValue());
        }
    }

    private static void validateProperties(String event, JsonObject properties, Set<String> allowed) {
        for (String field : properties.keySet()) {
            if (!allowed.contains(field)) throw new IllegalArgumentException("Onbekend analytics property");
            JsonElement value = properties.get(field);
            if (value == null || !value.isJsonPrimitive()) {
                throw new IllegalArgumentException("Analytics property moet scalar zijn");
            }
            validateValue(value.getAsString());
        }
    }

    private static String requireString(JsonObject object, String field, int maxLength) {
        JsonElement value = object.get(field);
        if (value == null || !value.isJsonPrimitive() || !value.getAsJsonPrimitive().isString()) {
            throw new IllegalArgumentException("Analyticsveld moet tekst zijn: " + field);
        }
        String text = value.getAsString();
        if (text.isBlank() || text.length() > maxLength || text.indexOf('@') >= 0) {
            throw new IllegalArgumentException("Ongeldig analyticsveld: " + field);
        }
        if ("anonymous_id".equals(field) && !text.matches("[A-Za-z0-9._:-]+")) {
            throw new IllegalArgumentException("Ongeldige anonymous_id");
        }
        return text;
    }

    private static void validateValue(String value) {
        if (value == null || value.isBlank() || value.length() > 80
                || !value.matches("[A-Za-z0-9_.:-]+")) {
            throw new IllegalArgumentException("Ongeldige analytics property");
        }
    }
}

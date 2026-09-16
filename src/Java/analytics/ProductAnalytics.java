package Java.analytics;

import Java.API_Utils;
import Java.Config;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.Gson;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/** Fail-open, request-scoped server-side product analytics capture. */
public final class ProductAnalytics {
    public static final String ROUTE = "/ProductAnalytics";
    private static final Duration CAPTURE_TIMEOUT = Duration.ofMillis(200);
    private static final Gson GSON = new Gson();
    private static final ProductAnalytics NOOP = new ProductAnalytics();

    private final API_Utils utils;
    private final boolean enabled;
    private final String apiKey;
    private final URI captureUri;
    private final String environment;
    private final Set<String> internalUserIds;
    private final HttpClient client;

    public ProductAnalytics(Config config) {
        this.utils = new API_Utils(config);
        this.enabled = config.isPosthogEnabled();
        this.apiKey = config.getPosthogProjectApiKey();
        this.captureUri = captureUri(config.getPosthogHost());
        this.environment = safeEnvironment(config.getClashPanelEnvironment());
        this.internalUserIds = internalUserIds(config.getPosthogInternalUserIds());
        this.client = HttpClient.newBuilder().connectTimeout(CAPTURE_TIMEOUT).build();
    }

    ProductAnalytics(URI captureUri) {
        this.utils = null;
        this.enabled = true;
        this.apiKey = "phc_test";
        this.captureUri = captureUri;
        this.environment = "test";
        this.internalUserIds = Set.of();
        this.client = HttpClient.newBuilder().connectTimeout(CAPTURE_TIMEOUT).build();
    }

    private ProductAnalytics() {
        this.utils = null;
        this.enabled = false;
        this.apiKey = "";
        this.captureUri = null;
        this.environment = "development";
        this.internalUserIds = Set.of();
        this.client = null;
    }

    public static ProductAnalytics noop() {
        return NOOP;
    }

    public boolean isEnabled() {
        return enabled && captureUri != null;
    }

    public void registerRoute(HttpServer server) {
        server.createContext(ROUTE, exchange -> utils.handlePost(exchange, this::handleClientEvent));
    }

    public void captureAuthenticated(
            String event,
            Map<String, String> properties,
            String userId
    ) {
        capture(event, properties, userId, null, false);
    }

    public void captureAuthenticated(
            String event,
            Map<String, String> properties,
            HttpExchange exchange
    ) {
        captureAuthenticated(event, properties, optionalAuthenticatedUser(exchange));
    }

    private void handleClientEvent(HttpExchange exchange) throws Exception {
        JsonObject body = utils.parseBody(exchange);
        AnalyticsEvent.validateClientEnvelope(body);
        String event = body.get("event").getAsString();
        String anonymousId = body.get("anonymous_id").getAsString();
        boolean anonymousInternal = booleanValue(body, "anonymous_internal");
        String userId = isEnabled() ? optionalAuthenticatedUser(exchange) : "";
        capture(event, clientProperties(body), userId, anonymousId, anonymousInternal);
        utils.sendJsonResponse(exchange, "", 204);
    }

    private String optionalAuthenticatedUser(HttpExchange exchange) {
        String cookies = exchange.getRequestHeaders().getFirst("Cookie");
        if (!hasSessionCookie(cookies)) return "";
        try {
            return utils.requireAuthenticatedUser(exchange);
        } catch (Exception ignored) {
            return "";
        }
    }

    private boolean hasSessionCookie(String cookies) {
        if (cookies == null || cookies.isBlank()) return false;
        return Arrays.stream(cookies.split(";"))
                .map(String::trim)
                .anyMatch(cookie -> cookie.startsWith("ct_access=") || cookie.startsWith("ct_refresh="));
    }

    private void capture(
            String event,
            Map<String, String> properties,
            String userId,
            String anonymousId,
            boolean anonymousInternal
    ) {
        try {
            if (!isEnabled() || !AnalyticsEvent.isKnown(event)) return;
            AnalyticsEvent.validateServerProperties(properties);
            String distinctId = nonBlank(userId) ? userId.trim() : anonymousId;
            if (distinctId == null || distinctId.isBlank()) return;
            boolean loggedIn = nonBlank(userId);
            boolean internal = loggedIn
                    ? internalUserIds.contains(userId.trim())
                    : anonymousInternal;
            JsonObject payload = buildPayload(
                    apiKey, event, properties, distinctId, loggedIn,
                    environment, internal ? "internal" : "external"
            );
            send(GSON.toJson(payload));
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
        } catch (Exception ignored) {
            // Analytics must never affect the product request that triggered it.
        }
    }

    static JsonObject buildPayload(
            String apiKey,
            String event,
            Map<String, String> properties,
            String distinctId,
            boolean loggedIn,
            String environment,
            String trafficType
    ) {
        JsonObject payload = new JsonObject();
        payload.addProperty("api_key", apiKey);
        payload.addProperty("event", event);
        payload.addProperty("distinct_id", distinctId);
        JsonObject safeProperties = new JsonObject();
        properties.forEach(safeProperties::addProperty);
        safeProperties.addProperty("logged_in", loggedIn);
        safeProperties.addProperty("environment", environment);
        safeProperties.addProperty("traffic_type", trafficType);
        if (!loggedIn) safeProperties.addProperty("$process_person_profile", false);
        payload.add("properties", safeProperties);
        return payload;
    }

    private void send(String payload) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(captureUri)
                .timeout(CAPTURE_TIMEOUT)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload))
                .build();
        client.send(request, HttpResponse.BodyHandlers.discarding());
    }

    private Map<String, String> clientProperties(JsonObject body) {
        java.util.Map<String, String> properties = new java.util.LinkedHashMap<>();
        for (Map.Entry<String, JsonElement> entry : body.getAsJsonObject("properties").entrySet()) {
            properties.put(entry.getKey(), entry.getValue().getAsString());
        }
        return properties;
    }

    private boolean booleanValue(JsonObject body, String field) {
        JsonElement value = body.get(field);
        return value != null && value.isJsonPrimitive()
                && value.getAsJsonPrimitive().isBoolean() && value.getAsBoolean();
    }

    private static URI captureUri(String host) {
        try {
            URI base = URI.create(host);
            if (!"http".equalsIgnoreCase(base.getScheme())
                    && !"https".equalsIgnoreCase(base.getScheme())) return null;
            String path = base.getPath() == null ? "" : base.getPath().replaceAll("/+$", "");
            return URI.create(base.getScheme() + "://" + base.getRawAuthority() + path + "/i/v0/e/");
        } catch (Exception invalidHost) {
            return null;
        }
    }

    private static Set<String> internalUserIds(String value) {
        if (value == null || value.isBlank()) return Set.of();
        Set<String> ids = new HashSet<>();
        Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(id -> !id.isBlank())
                .forEach(ids::add);
        return Set.copyOf(ids);
    }

    private static String safeEnvironment(String value) {
        return value != null && value.matches("[A-Za-z0-9_.:-]{1,32}")
                ? value : "development";
    }

    private static boolean nonBlank(String value) {
        return value != null && !value.isBlank();
    }
}

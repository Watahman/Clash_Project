package Java;

import Java.advancedstats.AdvancedStatsLifecycleService;
import Java.advancedstats.AdvancedStatsModels;
import Java.advancedstats.AdvancedStatsReadService;
import Java.advancedstats.AdvancedStatsTrackingStatus;
import com.google.gson.JsonElement;
import com.google.gson.JsonNull;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpServer;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/** Authenticated lifecycle and read routes for opt-in Advanced Stats tracking. */
public final class SUPABASE_AdvancedStats {
    public static final String ROUTE_TRACKING_START = "/AdvancedStatsTrackingStart";
    public static final String ROUTE_TRACKING_GET = "/AdvancedStatsTrackingGet";
    public static final String ROUTE_TRACKING_PAUSE = "/AdvancedStatsTrackingPause";
    public static final String ROUTE_TRACKING_RESUME = "/AdvancedStatsTrackingResume";
    public static final String ROUTE_TRACKING_STOP = "/AdvancedStatsTrackingStop";
    public static final String ROUTE_DATA_DELETE = "/AdvancedStatsDataDelete";
    public static final String ROUTE_OVERVIEW = "/AdvancedStatsOverview";
    public static final String ROUTE_UNITS = "/AdvancedStatsUnits";
    public static final String ROUTE_ARMIES = "/AdvancedStatsArmies";
    public static final String ROUTE_BATTLES = "/AdvancedStatsBattles";
    public static final String ROUTE_TRENDS = "/AdvancedStatsTrends";

    private final HttpServer server;
    private final Config conf;
    private final API_Utils utils;
    private final AdvancedStatsLifecycleService lifecycle;
    private final AdvancedStatsReadService reads;

    public SUPABASE_AdvancedStats(HttpServer server, Config conf) {
        this(server, conf, new AdvancedStatsLifecycleService(), new AdvancedStatsReadService());
    }

    SUPABASE_AdvancedStats(HttpServer server, Config conf, AdvancedStatsLifecycleService lifecycle) {
        this(server, conf, lifecycle, new AdvancedStatsReadService());
    }

    SUPABASE_AdvancedStats(
            HttpServer server,
            Config conf,
            AdvancedStatsLifecycleService lifecycle,
            AdvancedStatsReadService reads
    ) {
        this.server = server;
        this.conf = conf;
        this.utils = new API_Utils(conf);
        this.lifecycle = lifecycle;
        this.reads = reads;
    }

    public void registerRoutes() {
        registerStart();
        registerStatus();
        registerPause();
        registerResume();
        registerStop();
        registerDelete();
        registerOverview();
        registerUnits();
        registerArmies();
        registerBattles();
        registerTrends();
    }

    private void registerStart() {
        server.createContext(conf._EXT_ADVANCED_STATS_TRACKING_START, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject body = utils.parseBody(ex);
            UUID userId = authenticatedUserId(ex);
            AdvancedStatsModels.TrackingState state = lifecycle.start(userId, requirePlayerTag(body));
            utils.sendJsonResponse(ex, trackingResponse(Optional.of(state)).toString(), 200);
        }));
    }

    private void registerStatus() {
        server.createContext(conf._EXT_ADVANCED_STATS_TRACKING_GET, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject body = utils.parseBody(ex);
            UUID userId = authenticatedUserId(ex);
            Optional<AdvancedStatsModels.TrackingState> state = lifecycle.status(userId, requirePlayerTag(body));
            utils.sendJsonResponse(ex, trackingResponse(state).toString(), 200);
        }));
    }

    private void registerPause() {
        server.createContext(conf._EXT_ADVANCED_STATS_TRACKING_PAUSE, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject body = utils.parseBody(ex);
            UUID userId = authenticatedUserId(ex);
            AdvancedStatsModels.TrackingState state = lifecycle.pause(userId, requirePlayerTag(body));
            utils.sendJsonResponse(ex, trackingResponse(Optional.of(state)).toString(), 200);
        }));
    }

    private void registerResume() {
        server.createContext(conf._EXT_ADVANCED_STATS_TRACKING_RESUME, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject body = utils.parseBody(ex);
            UUID userId = authenticatedUserId(ex);
            AdvancedStatsModels.TrackingState state = lifecycle.resume(userId, requirePlayerTag(body));
            utils.sendJsonResponse(ex, trackingResponse(Optional.of(state)).toString(), 200);
        }));
    }

    private void registerStop() {
        server.createContext(conf._EXT_ADVANCED_STATS_TRACKING_STOP, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject body = utils.parseBody(ex);
            UUID userId = authenticatedUserId(ex);
            Optional<AdvancedStatsModels.TrackingState> state = lifecycle.stop(userId, requirePlayerTag(body));
            utils.sendJsonResponse(ex, trackingResponse(state).toString(), 200);
        }));
    }

    private void registerDelete() {
        server.createContext(conf._EXT_ADVANCED_STATS_DATA_DELETE, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject body = utils.parseBody(ex);
            UUID userId = authenticatedUserId(ex);
            String playerTag = requirePlayerTag(body);
            boolean deleted = lifecycle.delete(userId, playerTag);

            JsonObject response = new JsonObject();
            response.addProperty("success", true);
            response.addProperty("deleted", deleted);
            response.addProperty("enabled", false);
            response.addProperty("status", "DISABLED");
            utils.sendJsonResponse(ex, response.toString(), 200);
        }));
    }

    private void registerOverview() {
        server.createContext(conf._EXT_ADVANCED_STATS_OVERVIEW, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject body = utils.parseBody(ex);
            JsonObject response = reads.overview(
                    authenticatedUserId(ex),
                    requirePlayerTag(body),
                    optionalString(body, "period")
            );
            utils.sendJsonResponse(ex, response.toString(), 200);
        }));
    }

    private void registerUnits() {
        server.createContext(conf._EXT_ADVANCED_STATS_UNITS, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject body = utils.parseBody(ex);
            JsonObject response = reads.units(
                    authenticatedUserId(ex),
                    requirePlayerTag(body),
                    optionalString(body, "period"),
                    optionalString(body, "category")
            );
            utils.sendJsonResponse(ex, response.toString(), 200);
        }));
    }

    private void registerArmies() {
        server.createContext(conf._EXT_ADVANCED_STATS_ARMIES, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject body = utils.parseBody(ex);
            JsonObject response = reads.armies(
                    authenticatedUserId(ex),
                    requirePlayerTag(body),
                    optionalString(body, "period"),
                    optionalInt(body, "limit", 20)
            );
            utils.sendJsonResponse(ex, response.toString(), 200);
        }));
    }

    private void registerBattles() {
        server.createContext(conf._EXT_ADVANCED_STATS_BATTLES, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject body = utils.parseBody(ex);
            JsonObject response = reads.battles(
                    authenticatedUserId(ex),
                    requirePlayerTag(body),
                    optionalString(body, "period"),
                    optionalInt(body, "limit", 25),
                    optionalString(body, "cursor")
            );
            utils.sendJsonResponse(ex, response.toString(), 200);
        }));
    }

    private void registerTrends() {
        server.createContext(conf._EXT_ADVANCED_STATS_TRENDS, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject body = utils.parseBody(ex);
            JsonObject response = reads.trends(
                    authenticatedUserId(ex),
                    requirePlayerTag(body),
                    optionalString(body, "period")
            );
            utils.sendJsonResponse(ex, response.toString(), 200);
        }));
    }

    private UUID authenticatedUserId(com.sun.net.httpserver.HttpExchange exchange) throws Exception {
        String userId = utils.requireAuthenticatedUser(exchange);
        try {
            return UUID.fromString(userId);
        } catch (IllegalArgumentException invalidProfileId) {
            throw new HttpException(
                    500,
                    "{\"error\":\"Gebruikersprofiel heeft een ongeldige id\",\"code\":\"INVALID_PROFILE_ID\"}"
            );
        }
    }

    private String requirePlayerTag(JsonObject body) {
        JsonElement playerTag = body.get("playerTag");
        if (playerTag == null || playerTag.isJsonNull()) playerTag = body.get("playerID");
        if (playerTag == null || playerTag.isJsonNull()
                || !playerTag.isJsonPrimitive() || !playerTag.getAsJsonPrimitive().isString()) {
            throw new IllegalArgumentException("Verplicht veld ontbreekt: playerTag");
        }
        return playerTag.getAsString();
    }

    private String optionalString(JsonObject body, String field) {
        JsonElement value = body.get(field);
        if (value == null || value.isJsonNull()) return null;
        if (!value.isJsonPrimitive() || !value.getAsJsonPrimitive().isString()) {
            throw new IllegalArgumentException("Veld moet tekst zijn: " + field);
        }
        return value.getAsString();
    }

    private int optionalInt(JsonObject body, String field, int fallback) {
        JsonElement value = body.get(field);
        if (value == null || value.isJsonNull()) return fallback;
        if (!value.isJsonPrimitive() || !value.getAsJsonPrimitive().isNumber()) {
            throw new IllegalArgumentException("Veld moet een getal zijn: " + field);
        }
        try {
            return value.getAsInt();
        } catch (RuntimeException invalidNumber) {
            throw new IllegalArgumentException("Ongeldig getal voor veld: " + field);
        }
    }

    static JsonObject trackingResponse(Optional<AdvancedStatsModels.TrackingState> state) {
        JsonObject response = new JsonObject();
        if (state == null || state.isEmpty()) {
            response.addProperty("trackingExists", false);
            response.addProperty("enabled", false);
            response.addProperty("status", "DISABLED");
            return response;
        }

        AdvancedStatsModels.TrackingState tracking = state.get();
        AdvancedStatsTrackingStatus status = tracking.status();
        response.addProperty("trackingExists", true);
        response.addProperty("enabled", status != AdvancedStatsTrackingStatus.STOPPED);
        response.addProperty("status", status.name());
        response.addProperty("playerTag", tracking.playerTag());
        addOptional(response, "playerName", tracking.playerName());
        if (tracking.townHallLevel() == null) response.add("townHallLevel", JsonNull.INSTANCE);
        else response.addProperty("townHallLevel", tracking.townHallLevel());
        addOptional(response, "trackingStartedAt", tracking.trackingStartedAt());
        addOptional(response, "bootstrapCompletedAt", tracking.bootstrapCompletedAt());
        addOptional(response, "lastPollAt", tracking.lastPollAt());
        addOptional(response, "lastSuccessfulPollAt", tracking.lastSuccessfulPollAt());
        addOptional(response, "nextPollAt", tracking.nextPollAt());
        addOptional(response, "gapStartedAt", tracking.gapStartedAt());
        addOptional(response, "dataCompleteSince", tracking.dataCompleteSince());
        response.addProperty("consecutiveFailures", tracking.consecutiveFailures());
        response.addProperty("battlesProcessed", tracking.battlesProcessed());
        response.addProperty("hasPotentialGap", tracking.gapStartedAt() != null);
        return response;
    }

    private static void addOptional(JsonObject target, String field, String value) {
        if (value == null || value.isBlank()) target.add(field, JsonNull.INSTANCE);
        else target.addProperty(field, value);
    }

    private static void addOptional(JsonObject target, String field, Instant value) {
        if (value == null) target.add(field, JsonNull.INSTANCE);
        else target.addProperty(field, value.toString());
    }
}

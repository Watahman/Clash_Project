package Java;

import Java.advancedstats.AdvancedStatsInsightsService;
import Java.advancedstats.AdvancedStatsLeagueReader;
import Java.advancedstats.AdvancedStatsLifecycleService;
import Java.advancedstats.AdvancedStatsProgressionService;
import Java.advancedstats.AdvancedStatsPlayerCwlHistory;
import Java.advancedstats.AdvancedStatsWarCwlService;
import Java.cwlhistory.HistoricalCwlService;
import Java.performance.HistoricalProviderFactory;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpServer;

import java.util.UUID;
import java.util.EnumMap;
import java.time.Clock;

/** Authenticated, owner-scoped lazy reads for historical Stats sections. */
final class SUPABASE_AdvancedStatsInsights {
    private final HttpServer server;
    private final Config config;
    private final API_Utils utils;
    private final AdvancedStatsInsightsService insights;

    SUPABASE_AdvancedStatsInsights(HttpServer server, Config config, AdvancedStatsInsightsService insights) {
        this.server = server;
        this.config = config;
        this.utils = new API_Utils(config);
        this.insights = insights;
    }

    static SUPABASE_AdvancedStatsInsights configured(
            HttpServer server, Config config, HistoricalCwlService cwlHistory
    ) {
        var readers = new EnumMap<AdvancedStatsInsightsService.Section,
                AdvancedStatsInsightsService.SectionReader>(AdvancedStatsInsightsService.Section.class);
        var playerCwl = new AdvancedStatsPlayerCwlHistory(config.getClashKingBaseUrl());
        var warCwl = new AdvancedStatsWarCwlService(
                HistoricalProviderFactory.create(config), cwlHistory, playerCwl);
        var progression = new AdvancedStatsProgressionService(config);
        var league = new AdvancedStatsLeagueReader(config);
        readers.put(AdvancedStatsInsightsService.Section.WAR_CWL, warCwl::read);
        readers.put(AdvancedStatsInsightsService.Section.PROGRESSION, progression::read);
        readers.put(AdvancedStatsInsightsService.Section.LEAGUE, league::read);
        var access = AdvancedStatsInsightsService.lifecycleAccess(new AdvancedStatsLifecycleService());
        var service = new AdvancedStatsInsightsService(access, readers,
                tag -> league.read(tag, "current-season", null), Clock.systemUTC());
        return new SUPABASE_AdvancedStatsInsights(server, config, service);
    }

    void registerRoute() {
        server.createContext(config._EXT_ADVANCED_STATS_INSIGHTS, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject body = utils.parseBody(ex);
            UUID userId = authenticatedUserId(ex);
            JsonObject response = insights.read(userId, requiredText(body, "playerTag"),
                    optionalText(body, "period"), requiredText(body, "section"));
            utils.sendJsonResponse(ex, response.toString(), 200);
        }));
    }

    private UUID authenticatedUserId(com.sun.net.httpserver.HttpExchange exchange) throws Exception {
        String value = utils.requireAuthenticatedUser(exchange);
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException invalid) {
            throw new HttpException(500,
                    "{\"error\":\"Invalid user profile\",\"code\":\"INVALID_PROFILE_ID\"}");
        }
    }

    private String requiredText(JsonObject body, String key) {
        String value = optionalText(body, key);
        if (value == null || value.isBlank()) throw new IllegalArgumentException("Missing field: " + key);
        return value;
    }

    private String optionalText(JsonObject body, String key) {
        JsonElement value = body.get(key);
        if (value == null || value.isJsonNull()) return null;
        if (!value.isJsonPrimitive() || !value.getAsJsonPrimitive().isString()) {
            throw new IllegalArgumentException("Field must be text: " + key);
        }
        return value.getAsString();
    }
}

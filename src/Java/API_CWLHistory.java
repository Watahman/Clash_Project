package Java;

import Java.cwlhistory.HistoricalCwlProviderFactory;
import Java.cwlhistory.HistoricalCwlSeason;
import Java.cwlhistory.HistoricalCwlSeasonSummary;
import Java.cwlhistory.HistoricalCwlService;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

public final class API_CWLHistory {
    private final HttpServer server;
    private final Config conf;
    private final API_Utils utils;
    private final HistoricalCwlService service;
    private final Gson gson = new Gson();

    public API_CWLHistory(HttpServer server, Config conf) {
        this(
                server,
                conf,
                new HistoricalCwlService(HistoricalCwlProviderFactory.create(conf))
        );
    }

    API_CWLHistory(
            HttpServer server,
            Config conf,
            HistoricalCwlService service
    ) {
        this.server = server;
        this.conf = conf;
        this.service = service;
        this.utils = new API_Utils(conf);
    }

    public void registerRoutes() {
        server.createContext(conf._EXT_CWL_HISTORY,
                exchange -> utils.handleGet(exchange, this::getSeason));
        server.createContext(conf._EXT_CWL_HISTORY_SEASONS,
                exchange -> utils.handleGet(exchange, this::getSeasons));
        server.createContext(conf._EXT_CWL_HISTORY_OVERVIEW,
                exchange -> utils.handleGet(exchange, this::getOverview));
    }

    private void getSeason(HttpExchange exchange) throws Exception {
        clearCachesIfRequested(exchange);
        String clanTag = requiredQuery(exchange, "clanTag");
        String season = requiredQuery(exchange, "season");
        HistoricalCwlSeason result = service.getSeason(clanTag, season);
        JsonObject response = new JsonObject();
        response.add("season", gson.toJsonTree(result));
        utils.sendJsonResponse(exchange, gson.toJson(response), 200);
    }

    private void getSeasons(HttpExchange exchange) throws Exception {
        clearCachesIfRequested(exchange);
        String clanTag = requiredQuery(exchange, "clanTag");
        int limit = intQuery(exchange, "limit", HistoricalCwlService.DEFAULT_SEASON_LIMIT);
        List<HistoricalCwlSeasonSummary> result =
                service.getAvailableSeasons(clanTag, limit);
        JsonObject response = new JsonObject();
        response.addProperty("clanTag", clanTag);
        response.add("seasons", gson.toJsonTree(result));
        utils.sendJsonResponse(exchange, gson.toJson(response), 200);
    }

    private void getOverview(HttpExchange exchange) throws Exception {
        clearCachesIfRequested(exchange);
        String clanTag = requiredQuery(exchange, "clanTag");
        int limit = intQuery(exchange, "limit", HistoricalCwlService.DEFAULT_SEASON_LIMIT);
        List<HistoricalCwlSeason> result = service.getOverview(clanTag, limit);
        JsonObject response = new JsonObject();
        response.addProperty("clanTag", clanTag);
        response.add("seasons", gson.toJsonTree(result));
        utils.sendJsonResponse(exchange, gson.toJson(response), 200);
    }

    private void clearCachesIfRequested(HttpExchange exchange) {
        if (API_Utils.requestsFreshData(exchange)) service.clearCaches();
    }

    private static String requiredQuery(HttpExchange exchange, String name) {
        String value = query(exchange, name);
        if (value.isBlank()) {
            throw new IllegalArgumentException("Verplichte queryparameter ontbreekt: " + name);
        }
        return value;
    }

    private static int intQuery(
            HttpExchange exchange,
            String name,
            int fallback
    ) {
        String value = query(exchange, name);
        if (value.isBlank()) return fallback;
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException invalid) {
            throw new IllegalArgumentException(name + " moet een geheel getal zijn");
        }
    }

    private static String query(HttpExchange exchange, String name) {
        String raw = exchange.getRequestURI().getRawQuery();
        if (raw == null || raw.isBlank()) return "";
        for (String pair : raw.split("&")) {
            String[] parts = pair.split("=", 2);
            String key = URLDecoder.decode(parts[0], StandardCharsets.UTF_8);
            if (!name.equals(key)) continue;
            return parts.length < 2
                    ? ""
                    : URLDecoder.decode(parts[1], StandardCharsets.UTF_8);
        }
        return "";
    }
}

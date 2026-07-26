package Java;

import Java.performance.HistoricalProviderFactory;
import Java.performance.PlayerPerformanceResult;
import Java.performance.PlayerPerformanceService;
import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpServer;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public final class API_PlayerPerformance {
    private final HttpServer server;
    private final Config conf;
    private final API_Utils utils;
    private final PlayerPerformanceService service;
    private final Gson gson = new Gson();

    public API_PlayerPerformance(HttpServer server, Config conf) {
        this(
                server,
                conf,
                new PlayerPerformanceService(HistoricalProviderFactory.create(conf))
        );
    }

    API_PlayerPerformance(HttpServer server, Config conf, PlayerPerformanceService service) {
        this.server = server;
        this.conf = conf;
        this.service = service;
        this.utils = new API_Utils(conf);
    }

    public void postPlayerPerformance() {
        server.createContext(conf._EXT_PLAYER_PERFORMANCE, exchange -> utils.handlePost(exchange, ex -> {
            JsonArray values = utils.requireArray(utils.parseBody(ex), "playerTags");
            if (values.size() > PlayerPerformanceService.MAX_BATCH_SIZE) {
                throw new IllegalArgumentException(
                        "Maximaal " + PlayerPerformanceService.MAX_BATCH_SIZE + " spelerstags per request"
                );
            }
            List<String> tags = new ArrayList<>();
            for (JsonElement value : values) {
                if (!value.isJsonPrimitive() || !value.getAsJsonPrimitive().isString()) {
                    throw new IllegalArgumentException("playerTags moet alleen tekstwaarden bevatten");
                }
                tags.add(value.getAsString());
            }

            Map<String, PlayerPerformanceResult> performance = service.getPerformance(tags);
            JsonObject response = new JsonObject();
            response.add("results", gson.toJsonTree(performance));
            utils.sendJsonResponse(ex, gson.toJson(response), 200);
        }));
    }
}

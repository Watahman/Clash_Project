package Java;

import Java.advancedstats.AdvancedStatsBattleIngestionService;
import Java.advancedstats.AdvancedStatsCollectorRepository;
import Java.advancedstats.AdvancedStatsScheduledCollector;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.time.Clock;

/** Protected Cloud Scheduler trigger for one bounded Advanced Stats collection pass. */
public final class AdvancedStatsInternalPoll {
    static final String PATH = "/InternalAdvancedStatsPoll";

    private final HttpServer server;
    private final API_Utils utils;
    private final AdvancedStatsCollectorConfig collectorConfig;
    private final AdvancedStatsScheduledCollector collector;

    public AdvancedStatsInternalPoll(HttpServer server, Config config) {
        if (server == null) throw new IllegalArgumentException("server is required");
        if (config == null) throw new IllegalArgumentException("config is required");

        this.server = server;
        this.utils = new API_Utils(config);
        this.collectorConfig = new AdvancedStatsCollectorConfig();

        AdvancedStatsBattleLogSource source = new AdvancedStatsBattleLogSource(config);
        AdvancedStatsBattleIngestionService ingestion = new AdvancedStatsBattleIngestionService();
        this.collector = new AdvancedStatsScheduledCollector(
                new AdvancedStatsCollectorRepository(),
                source::fetchFresh,
                ingestion::ingest,
                Clock.systemUTC(),
                collectorConfig.settings()
        );
    }

    AdvancedStatsInternalPoll(
            HttpServer server,
            API_Utils utils,
            AdvancedStatsCollectorConfig collectorConfig,
            AdvancedStatsScheduledCollector collector
    ) {
        this.server = server;
        this.utils = utils;
        this.collectorConfig = collectorConfig;
        this.collector = collector;
    }

    public void registerRoute() {
        server.createContext(PATH, this::handle);
    }

    private void handle(HttpExchange exchange) {
        try {
            if (!collectorConfig.isEnabled()) {
                utils.sendJsonResponse(
                        exchange,
                        "{\"error\":\"Not found\",\"code\":\"NOT_FOUND\"}",
                        404
                );
                return;
            }

            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.getResponseHeaders().set("Allow", "POST");
                utils.sendJsonResponse(
                        exchange,
                        "{\"error\":\"Method not allowed\",\"code\":\"METHOD_NOT_ALLOWED\"}",
                        405
                );
                return;
            }

            if (!collectorConfig.hasSchedulerSecret()) {
                utils.sendJsonResponse(
                        exchange,
                        "{\"error\":\"Collector is not configured\",\"code\":\"COLLECTOR_NOT_CONFIGURED\"}",
                        503
                );
                return;
            }

            String provided = exchange.getRequestHeaders().getFirst(AdvancedStatsCollectorConfig.SECRET_HEADER);
            if (!collectorConfig.isAuthorized(provided)) {
                utils.sendJsonResponse(
                        exchange,
                        "{\"error\":\"Unauthorized\",\"code\":\"SCHEDULER_AUTH_REQUIRED\"}",
                        401
                );
                return;
            }

            AdvancedStatsScheduledCollector.BatchSummary summary = collector.runOnce();
            JsonObject body = new JsonObject();
            body.addProperty("claimed", summary.claimed());
            body.addProperty("succeeded", summary.succeeded());
            body.addProperty("failed", summary.failed());
            body.addProperty("insertedBattles", summary.insertedBattles());
            body.addProperty("duplicateBattles", summary.duplicateBattles());
            body.addProperty("parserErrors", summary.parserErrors());
            body.addProperty("rateLimited", summary.rateLimited());
            body.addProperty("finalizeFailures", summary.finalizeFailures());
            body.addProperty("healthy", summary.finalizeFailures() == 0);

            System.out.printf(
                    "advanced_stats_poll_batch claimed=%d succeeded=%d failed=%d inserted=%d duplicates=%d parserErrors=%d rateLimited=%d finalizeFailures=%d%n",
                    summary.claimed(),
                    summary.succeeded(),
                    summary.failed(),
                    summary.insertedBattles(),
                    summary.duplicateBattles(),
                    summary.parserErrors(),
                    summary.rateLimited(),
                    summary.finalizeFailures()
            );

            utils.sendJsonResponse(exchange, body.toString(), 200);
        } catch (Exception failure) {
            System.err.printf(
                    "advanced_stats_poll_batch_failed error=%s%n",
                    failure.getClass().getSimpleName()
            );
            try {
                utils.sendJsonResponse(
                        exchange,
                        "{\"error\":\"Collector failed\",\"code\":\"COLLECTOR_FAILED\"}",
                        500
                );
            } catch (Exception responseFailure) {
                responseFailure.printStackTrace();
            }
        }
    }
}

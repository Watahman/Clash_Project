package Java.advancedstats;

import Java.Config;
import Java.performance.ClashKingHttpClient;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;

/** Upstream boundary for the separate Ranked and Legend datasets. */
public final class AdvancedStatsLeagueSource {
    private AdvancedStatsLeagueSource() {}

    public interface Fetcher {
        JsonObject leagueHistory(String playerTag, Instant after, Instant before) throws Exception;

        JsonObject ranked(String playerTag, String seasonId) throws Exception;

        JsonObject currentDates() throws Exception;

        JsonObject legend(String playerTag, String day) throws Exception;

        JsonElement legendHistory(String playerTag) throws Exception;
    }

    /** Production ClashKing V2 implementation. Each read uses a bounded set of calls. */
    public static final class HttpFetcher implements Fetcher {
        private final ClashKingHttpClient client;

        public HttpFetcher(Config config) {
            this(config == null ? null : config.getClashKingBaseUrl());
        }

        public HttpFetcher(String baseUrl) {
            if (baseUrl == null || baseUrl.isBlank()) {
                throw new IllegalArgumentException("ClashKing V2 base URL is required");
            }
            client = new ClashKingHttpClient(baseUrl, "ClashKing V2 Advanced Stats league");
        }

        @Override
        public JsonObject leagueHistory(String playerTag, Instant after, Instant before) throws Exception {
            return client.get("/v2/player/" + encoded(playerTag) + "/league/history"
                    + "?time%5Bafter%5D=" + encoded(after.toString())
                    + "&time%5Bbefore%5D=" + encoded(before.toString()));
        }

        @Override
        public JsonObject ranked(String playerTag, String seasonId) throws Exception {
            return client.get("/v2/player/" + encoded(playerTag) + "/ranked/"
                    + encoded(seasonId) + "/battlelog");
        }

        @Override
        public JsonObject currentDates() throws Exception {
            return client.get("/v2/dates/current");
        }

        @Override
        public JsonObject legend(String playerTag, String day) throws Exception {
            return client.get("/v2/player/" + encoded(playerTag) + "/legend/"
                    + encoded(day) + "/battlelog");
        }

        @Override
        public JsonElement legendHistory(String playerTag) throws Exception {
            return client.getElement("/v2/player/" + encoded(playerTag) + "/legend-history");
        }

        private static String encoded(String value) {
            return URLEncoder.encode(value, StandardCharsets.UTF_8);
        }
    }
}

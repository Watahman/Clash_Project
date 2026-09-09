package Java.advancedstats;

import Java.HttpException;
import Java.performance.ClashKingHttpClient;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Locale;

/** Route and transport details kept separate from season/collection policy. */
final class ClashKingV2AdvancedStatsRoutes {
    private ClashKingV2AdvancedStatsRoutes() {}

    static String normalPath(String playerTag, Instant after, Instant before) {
        return "/v2/player/" + encoded(playerTag) + "/battlelog/history"
                + "?time%5Bafter%5D=" + encoded(after.toString())
                + "&time%5Bbefore%5D=" + encoded(before.toString());
    }

    static String leagueHistoryPath(String playerTag, Instant after, Instant before) {
        return "/v2/player/" + encoded(playerTag) + "/league/history"
                + "?time%5Bafter%5D=" + encoded(after.toString())
                + "&time%5Bbefore%5D=" + encoded(before.toString());
    }

    static String rankedPath(String playerTag, String seasonId) {
        return "/v2/player/" + encoded(playerTag) + "/ranked/" + encoded(seasonId) + "/battlelog";
    }

    static String legendPath(String playerTag, String day) {
        return "/v2/player/" + encoded(playerTag) + "/legend/" + encoded(day) + "/battlelog";
    }

    static String warPath(String playerTag, long start, long end, int limit) {
        return "/v2/player/" + encoded(playerTag) + "/war/attacks"
                + "?time%5Bafter%5D=" + encoded(Instant.ofEpochSecond(start).toString())
                + "&time%5Bbefore%5D=" + encoded(Instant.ofEpochSecond(end).toString()) + "&limit=" + limit;
    }

    static boolean isMissingRoute(HttpException failure) {
        return failure.getStatusCode() == 404 || failure.getStatusCode() == 405;
    }

    static Long parseSeason(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            long value = Long.parseLong(raw.trim());
            return value > 0 ? value : null;
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    static String latestRankedSeason(JsonObject response) {
        JsonElement values = response == null ? null : response.get("items");
        if (values == null || !values.isJsonArray()) return null;
        long latest = -1;
        for (JsonElement value : values.getAsJsonArray()) {
            if (!value.isJsonObject() || !"ranked".equalsIgnoreCase(text(value.getAsJsonObject(), "mode"))) {
                continue;
            }
            Long candidate = parseSeason(text(value.getAsJsonObject(), "seasonId"));
            if (candidate != null && candidate > latest) latest = candidate;
        }
        return latest > 0 ? Long.toString(latest) : null;
    }

    static JsonObject normalizeRanked(JsonObject response) {
        if (response == null || response.has("attacks")) return response == null ? new JsonObject() : response;
        JsonArray logs = response.getAsJsonArray("battlelogs");
        if (logs == null) return response;
        JsonObject normalized = response.deepCopy();
        JsonArray attacks = new JsonArray();
        for (JsonElement value : logs) {
            if (!value.isJsonObject()) continue;
            JsonObject row = value.getAsJsonObject();
            if (isAttack(row)) {
                attacks.add(row);
            }
        }
        normalized.add("attacks", attacks);
        return normalized;
    }

    private static boolean isAttack(JsonObject row) {
        JsonElement attack = row.get("attack");
        if (attack != null && !attack.isJsonNull()) {
            try {
                return attack.getAsBoolean();
            } catch (RuntimeException ignored) {
                // Fall through to side/type labels used by older V2 payloads.
            }
        }
        String side = text(row, "side", "battle_side", "battleType", "battle_type").toLowerCase(Locale.ROOT);
        return side.contains("attack") || side.contains("offen");
    }

    static ClashKingV2AdvancedStatsSource.Transport configured(String baseUrl) {
        return baseUrl == null || baseUrl.isBlank() ? null : new HttpTransport(baseUrl);
    }

    private static String encoded(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    static String text(JsonObject row, String... names) {
        for (String name : names) {
            JsonElement value = row.get(name);
            if (value != null && !value.isJsonNull() && value.isJsonPrimitive()) return value.getAsString();
        }
        return "";
    }

    private static final class HttpTransport implements ClashKingV2AdvancedStatsSource.Transport {
        private final ClashKingHttpClient client;

        private HttpTransport(String baseUrl) {
            this.client = new ClashKingHttpClient(baseUrl, "ClashKing V2");
        }

        @Override
        public JsonObject normal(String playerTag, int limit, int days) {
            throw new UnsupportedOperationException("normal V2 route requires a UTC time window");
        }

        @Override
        public JsonObject normal(String playerTag, Instant after, Instant before) throws Exception {
            return client.get(normalPath(playerTag, after, before));
        }

        @Override
        public JsonObject ranked(String playerTag, long seasonSeconds, int ignoredLimit) throws Exception {
            return client.get(rankedPath(playerTag, Long.toString(seasonSeconds)));
        }

        @Override
        public JsonObject ranked(String playerTag, String seasonId) throws Exception {
            return client.get(rankedPath(playerTag, seasonId));
        }

        @Override
        public JsonObject war(String playerTag, long startSeconds, long endSeconds, int limit) throws Exception {
            return client.get(warPath(playerTag, startSeconds, endSeconds, limit));
        }

        @Override
        public JsonObject leagueHistory(String playerTag, Instant after, Instant before) throws Exception {
            return client.get(leagueHistoryPath(playerTag, after, before));
        }

        @Override
        public JsonObject legend(String playerTag, String day) throws Exception {
            return client.get(legendPath(playerTag, day));
        }

        @Override
        public JsonObject currentDates() throws Exception {
            return client.get("/v2/dates/current");
        }
    }
}

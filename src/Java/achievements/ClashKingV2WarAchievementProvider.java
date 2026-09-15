package Java.achievements;

import Java.Config;
import Java.HttpException;
import Java.performance.ClashKingHttpClient;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Reads the public ClashKing V2 player war and CWL envelopes used by the
 * achievement projection.  Transport availability is kept separate from the
 * rows so a valid empty response can still produce zero-valued metrics.
 */
public final class ClashKingV2WarAchievementProvider {
    public static final int DEFAULT_LIMIT = 500;
    private final ClashKingHttpClient client;

    public ClashKingV2WarAchievementProvider(Config config) {
        this(config.getClashKingBaseUrl());
    }

    public ClashKingV2WarAchievementProvider(String baseUrl) {
        client = new ClashKingHttpClient(baseUrl, "ClashKing V2 achievement history");
    }

    public Snapshot fetch(String playerTag) {
        String tag = normalizedTag(playerTag);
        if (tag.isBlank()) throw new IllegalArgumentException("playerTag is required");
        SourceData war = load(warStatsPath(tag));
        SourceData cwl = load(cwlHistoryPath(tag));
        return new Snapshot(tag, war, cwl);
    }

    public static String warStatsPath(String playerTag) {
        return "/v2/player/" + encoded(normalizedTag(playerTag))
                + "/war/stats?type=random&limit=" + DEFAULT_LIMIT;
    }

    public static String cwlHistoryPath(String playerTag) {
        return "/v2/player/" + encoded(normalizedTag(playerTag))
                + "/cwl/history?limit=" + DEFAULT_LIMIT;
    }

    static List<JsonObject> items(JsonObject response, String sourceName) throws HttpException {
        JsonElement value = response == null ? null : response.get("items");
        if (value != null && value.isJsonArray()) return objectRows(value.getAsJsonArray());
        throw HttpException.upstream(
                502,
                "{\"error\":\"Invalid ClashKing " + sourceName + " response\"}",
                "ClashKing V2 achievement history"
        );
    }

    private SourceData load(String path) {
        try {
            JsonObject response = client.get(path);
            String sourceName = path.contains("cwl/history") ? "cwl-history" : "war-stats";
            return new SourceData(true, items(response, sourceName), "");
        } catch (Exception error) {
            return new SourceData(false, List.of(), failureCode(error));
        }
    }

    private static List<JsonObject> objectRows(JsonArray values) {
        List<JsonObject> rows = new ArrayList<>();
        for (JsonElement value : values) {
            if (value != null && value.isJsonObject()) rows.add(value.getAsJsonObject());
        }
        return List.copyOf(rows);
    }

    private static String failureCode(Exception error) {
        if (error instanceof HttpException http) return "HTTP_" + http.getStatusCode();
        return error.getClass().getSimpleName().toUpperCase(Locale.ROOT);
    }

    static String normalizedTag(String value) {
        if (value == null) return "";
        String result = value.trim().toUpperCase(Locale.ROOT);
        if (result.isBlank()) return "";
        return result.startsWith("#") ? result : "#" + result;
    }

    private static String encoded(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    public record Snapshot(String playerTag, SourceData war, SourceData cwl) {
        public Snapshot {
            playerTag = normalizedTag(playerTag);
            war = war == null ? SourceData.unavailable("NOT_REQUESTED") : war;
            cwl = cwl == null ? SourceData.unavailable("NOT_REQUESTED") : cwl;
        }
    }

    public record SourceData(boolean available, List<JsonObject> items, String error) {
        public SourceData {
            items = items == null ? List.of() : List.copyOf(items);
            error = error == null ? "" : error;
        }

        static SourceData unavailable(String error) {
            return new SourceData(false, List.of(), error);
        }
    }
}

package Java.achievements;

import Java.Config;
import Java.HttpException;
import Java.performance.ClashKingHttpClient;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;

/** Fetches legend rankings from ClashKing without persisting the raw upstream payload. */
public final class ClashKingV2LegendHistoryProvider {
    private final ClashKingHttpClient client;
    private final Cache<String, LegendHistoryNormalizer.History> cache;

    public ClashKingV2LegendHistoryProvider(Config config) {
        this(config.getClashKingBaseUrl());
    }

    public ClashKingV2LegendHistoryProvider(String baseUrl) {
        client = new ClashKingHttpClient(baseUrl, "ClashKing V2 legend history");
        cache = Caffeine.newBuilder()
                .maximumSize(500)
                .expireAfterWrite(Duration.ofMinutes(10))
                .build();
    }

    public LegendHistoryNormalizer.History getHistory(String playerTag) throws Exception {
        String key = normalizedTag(playerTag);
        if (key.isBlank()) throw new IllegalArgumentException("playerTag is required");
        LegendHistoryNormalizer.History cached = cache.getIfPresent(key);
        if (cached != null) return cached;
        JsonElement response = client.getElement(
                "/v2/player/" + URLEncoder.encode(key, StandardCharsets.UTF_8)
                        + "/legend-history"
        );
        JsonArray rows = rankingRows(response);
        LegendHistoryNormalizer.History history = LegendHistoryNormalizer.normalize(
                rows, key, Instant.now()
        );
        cache.put(key, history);
        return history;
    }

    private static JsonArray rankingRows(JsonElement response) throws HttpException {
        if (response != null && response.isJsonArray()) return response.getAsJsonArray();
        JsonElement rows = response != null && response.isJsonObject()
                ? response.getAsJsonObject().get("value")
                : null;
        if (rows == null && response != null && response.isJsonObject()) {
            rows = response.getAsJsonObject().get("items");
        }
        if (rows != null && rows.isJsonArray()) return rows.getAsJsonArray();
        throw HttpException.upstream(
                502,
                "{\"error\":\"Invalid ClashKing legend-history response\"}",
                "ClashKing legend history"
        );
    }

    private static String normalizedTag(String value) {
        if (value == null) return "";
        String result = value.trim().toUpperCase(Locale.ROOT);
        if (result.isBlank()) return "";
        return result.startsWith("#") ? result : "#" + result;
    }
}

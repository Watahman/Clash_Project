package Java.achievements;

import Java.Config;
import Java.performance.ClashKingHttpClient;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.google.gson.JsonObject;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;

/** Fetches raid weekends from ClashKing without persisting the raw upstream payload. */
public final class ClashKingRaidHistoryProvider {
    private static final int LIMIT = 100;
    private final ClashKingHttpClient client;
    private final Cache<String, RaidHistoryNormalizer.History> cache;

    public ClashKingRaidHistoryProvider(Config config) {
        this(config.getClashKingLegacyBaseUrl());
    }

    public ClashKingRaidHistoryProvider(String baseUrl) {
        client = new ClashKingHttpClient(baseUrl, "ClashKing raid history");
        cache = Caffeine.newBuilder()
                .maximumSize(500)
                .expireAfterWrite(Duration.ofMinutes(10))
                .build();
    }

    public RaidHistoryNormalizer.History getHistory(String playerTag) throws Exception {
        String key = normalizedTag(playerTag);
        if (key.isBlank()) throw new IllegalArgumentException("playerTag is required");
        RaidHistoryNormalizer.History cached = cache.getIfPresent(key);
        if (cached != null) return cached;
        JsonObject response = client.get(
                "/player/" + URLEncoder.encode(key, StandardCharsets.UTF_8)
                        + "/raids?limit=" + LIMIT
        );
        RaidHistoryNormalizer.History history = RaidHistoryNormalizer.normalize(
                response, key, Instant.now()
        );
        cache.put(key, history);
        return history;
    }

    private static String normalizedTag(String value) {
        if (value == null) return "";
        String result = value.trim().toUpperCase(Locale.ROOT);
        if (result.isBlank()) return "";
        return result.startsWith("#") ? result : "#" + result;
    }
}

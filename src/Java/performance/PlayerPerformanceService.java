package Java.performance;

import Java.cache.CacheKeys;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class PlayerPerformanceService {
    public static final int MAX_BATCH_SIZE = 100;
    static final int PROVIDER_BATCH_SIZE = 20;

    private final HistoricalPlayerDataProvider provider;
    private final PlayerPerformanceCalculator calculator;
    private final Cache<String, PlayerPerformanceResult> cache;

    public PlayerPerformanceService(HistoricalPlayerDataProvider provider) {
        this(provider, new PlayerPerformanceCalculator());
    }

    PlayerPerformanceService(
            HistoricalPlayerDataProvider provider,
            PlayerPerformanceCalculator calculator
    ) {
        this.provider = provider;
        this.calculator = calculator;
        cache = Caffeine.newBuilder()
                .maximumSize(5_000)
                .expireAfterWrite(Duration.ofMinutes(10))
                .build();
    }

    public Map<String, PlayerPerformanceResult> getPerformance(List<String> requestedTags)
            throws Exception {
        Set<String> unique = new LinkedHashSet<>();
        for (String requestedTag : requestedTags) {
            unique.add(CacheKeys.requireValidTag(requestedTag));
        }
        if (unique.isEmpty()) throw new IllegalArgumentException("playerTags mag niet leeg zijn");
        if (unique.size() > MAX_BATCH_SIZE) {
            throw new IllegalArgumentException("Maximaal " + MAX_BATCH_SIZE + " spelerstags per request");
        }

        Map<String, PlayerPerformanceResult> result = new LinkedHashMap<>();
        List<String> missing = new ArrayList<>();
        for (String tag : unique) {
            PlayerPerformanceResult cached = cache.getIfPresent(tag);
            if (cached == null) missing.add(tag);
            else result.put(tag, cached);
        }

        loadMissing(missing, result);

        Map<String, PlayerPerformanceResult> ordered = new LinkedHashMap<>();
        unique.forEach(tag -> ordered.put(tag, result.get(tag)));
        return ordered;
    }

    private void loadMissing(
            List<String> missing,
            Map<String, PlayerPerformanceResult> result
    ) {
        for (int start = 0; start < missing.size(); start += PROVIDER_BATCH_SIZE) {
            int end = Math.min(start + PROVIDER_BATCH_SIZE, missing.size());
            loadProviderBatch(missing.subList(start, end), result);
        }
    }

    private void loadProviderBatch(
            List<String> tags,
            Map<String, PlayerPerformanceResult> result
    ) {
        Map<String, HistoricalPlayerData> historical;
        try {
            historical = provider.getPlayerWarHistory(tags);
        } catch (Exception ignored) {
            historical = Map.of();
        }
        for (String tag : tags) {
            HistoricalPlayerData data = historical.getOrDefault(
                    tag, HistoricalPlayerData.unavailable(tag, provider.providerName())
            );
            PlayerPerformanceResult calculated = calculator.calculate(data);
            cache.put(tag, calculated);
            result.put(tag, calculated);
        }
    }
}

package Java.cache;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.Expiry;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Fast in-process cache backed by Caffeine.
 *
 * Entries expire at their individual staleUntil timestamp. CacheEntry still
 * decides whether a value is fresh or stale-while-revalidate usable.
 */
public class InMemoryCacheStore implements CacheStore {
    private static final int DEFAULT_MAX_ENTRIES = 5_000;

    private final Cache<String, CacheEntry> entries;

    public InMemoryCacheStore() {
        this(DEFAULT_MAX_ENTRIES);
    }

    public InMemoryCacheStore(int maxEntries) {
        entries = Caffeine.<String, CacheEntry>newBuilder()
                .maximumSize(Math.max(100, maxEntries))
                .expireAfter(new Expiry<String, CacheEntry>() {
                    @Override
                    public long expireAfterCreate(String key, CacheEntry value, long currentTime) {
                        return remainingNanos(value);
                    }

                    @Override
                    public long expireAfterUpdate(
                            String key,
                            CacheEntry value,
                            long currentTime,
                            long currentDuration
                    ) {
                        return remainingNanos(value);
                    }

                    @Override
                    public long expireAfterRead(
                            String key,
                            CacheEntry value,
                            long currentTime,
                            long currentDuration
                    ) {
                        return Math.min(currentDuration, remainingNanos(value));
                    }
                })
                .build();
    }

    @Override
    public CacheEntry get(String key) {
        if (key == null || key.isBlank()) return null;

        CacheEntry entry = entries.getIfPresent(key);
        if (entry == null) return null;
        if (!entry.isUsable()) {
            entries.invalidate(key);
            return null;
        }
        return entry;
    }

    @Override
    public void put(String key, CacheEntry entry) {
        if (key == null || key.isBlank() || entry == null || entry.value() == null) return;
        if (!entry.isUsable()) {
            entries.invalidate(key);
            return;
        }
        entries.put(key, entry);
    }

    @Override
    public void invalidate(String key) {
        if (key != null) entries.invalidate(key);
    }

    @Override
    public void invalidatePrefix(String prefix) {
        if (prefix == null || prefix.isEmpty()) return;

        List<String> matches = new ArrayList<>();
        for (String key : entries.asMap().keySet()) {
            if (key.startsWith(prefix)) matches.add(key);
        }
        entries.invalidateAll(matches);
    }

    private static long remainingNanos(CacheEntry entry) {
        long remainingMs = entry.staleUntil() - System.currentTimeMillis();
        if (remainingMs <= 0) return 0;
        return TimeUnit.MILLISECONDS.toNanos(remainingMs);
    }
}

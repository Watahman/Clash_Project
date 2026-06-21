package Java.cache;

import java.util.Comparator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class InMemoryCacheStore implements CacheStore {
    private static final int MAX_ENTRIES = 1000;
    private final ConcurrentHashMap<String, CacheEntry> entries = new ConcurrentHashMap<>();

    @Override
    public String get(String key) {
        CacheEntry entry = entries.get(key);
        if (entry == null) return null;
        if (!entry.isFresh()) {
            entries.remove(key);
            return null;
        }
        return entry.value();
    }

    @Override
    public void put(String key, String value, long ttlMs) {
        if (key == null || key.isBlank() || value == null || ttlMs <= 0) return;
        entries.put(key, new CacheEntry(value, ttlMs));
        cleanup();
    }

    @Override
    public void invalidate(String key) {
        if (key != null) entries.remove(key);
    }

    @Override
    public void invalidatePrefix(String prefix) {
        if (prefix == null) return;
        entries.keySet().removeIf(key -> key.startsWith(prefix));
    }

    @Override
    public boolean isFresh(String key) {
        CacheEntry entry = entries.get(key);
        return entry != null && entry.isFresh();
    }

    private void cleanup() {
        entries.entrySet().removeIf(entry -> !entry.getValue().isFresh());
        if (entries.size() <= MAX_ENTRIES) return;

        entries.entrySet().stream()
                .sorted(Comparator.comparingLong(entry -> entry.getValue().createdAt()))
                .limit(entries.size() - MAX_ENTRIES)
                .map(Map.Entry::getKey)
                .forEach(entries::remove);
    }
}

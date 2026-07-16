package Java.cache;

import java.util.Comparator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class InMemoryCacheStore implements CacheStore {
    private static final int MAX_ENTRIES = 1000;
    private final ConcurrentHashMap<String, CacheEntry> entries = new ConcurrentHashMap<>();

    @Override
    public CacheEntry get(String key) {
        CacheEntry entry = entries.get(key);
        if (entry == null) return null;
        if (!entry.isUsable()) {
            entries.remove(key);
            return null;
        }
        return entry;
    }

    @Override
    public void put(String key, CacheEntry entry) {
        if (key == null || key.isBlank() || entry == null || entry.value() == null) return;
        entries.put(key, entry);
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

    private void cleanup() {
        entries.entrySet().removeIf(entry -> !entry.getValue().isUsable());
        if (entries.size() <= MAX_ENTRIES) return;

        entries.entrySet().stream()
                .sorted(Comparator.comparingLong(entry -> entry.getValue().fetchedAt()))
                .limit(entries.size() - MAX_ENTRIES)
                .map(Map.Entry::getKey)
                .forEach(entries::remove);
    }
}

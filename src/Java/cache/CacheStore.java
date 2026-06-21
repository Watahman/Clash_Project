package Java.cache;

public interface CacheStore {
    String get(String key);
    void put(String key, String value, long ttlMs);
    void invalidate(String key);
    void invalidatePrefix(String prefix);
    boolean isFresh(String key);
}

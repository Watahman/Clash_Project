package Java.cache;

public interface CacheStore {
    CacheEntry get(String key);
    void put(String key, CacheEntry entry);
    void invalidate(String key);
    void invalidatePrefix(String prefix);
}

package Java.cache;

public class CacheEntry {
    private final String value;
    private final long createdAt;
    private final long expiresAt;

    public CacheEntry(String value, long ttlMs) {
        this.value = value;
        this.createdAt = System.currentTimeMillis();
        this.expiresAt = this.createdAt + ttlMs;
    }

    public String value() {
        return value;
    }

    public long createdAt() {
        return createdAt;
    }

    public boolean isFresh() {
        return System.currentTimeMillis() < expiresAt;
    }
}

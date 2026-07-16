package Java.cache;

public final class CacheEntry {
    private final String value;
    private final long fetchedAt;
    private final long freshUntil;
    private final long staleUntil;
    private final int sourceStatus;

    public CacheEntry(
            String value,
            long fetchedAt,
            long freshUntil,
            long staleUntil,
            int sourceStatus
    ) {
        this.value = value;
        this.fetchedAt = fetchedAt;
        this.freshUntil = freshUntil;
        this.staleUntil = staleUntil;
        this.sourceStatus = sourceStatus;
    }

    public static CacheEntry create(String value, long freshTtlMs, long retentionMs, int sourceStatus) {
        long fetchedAt = System.currentTimeMillis();
        return new CacheEntry(
                value,
                fetchedAt,
                fetchedAt + Math.max(1, freshTtlMs),
                fetchedAt + Math.max(freshTtlMs, retentionMs),
                sourceStatus
        );
    }

    public String value() {
        return value;
    }

    public long fetchedAt() {
        return fetchedAt;
    }

    public long freshUntil() {
        return freshUntil;
    }

    public long staleUntil() {
        return staleUntil;
    }

    public int sourceStatus() {
        return sourceStatus;
    }

    public boolean isFresh() {
        return System.currentTimeMillis() < freshUntil;
    }

    public boolean isUsable() {
        return System.currentTimeMillis() < staleUntil;
    }

    public long ageMs() {
        return Math.max(0, System.currentTimeMillis() - fetchedAt);
    }
}

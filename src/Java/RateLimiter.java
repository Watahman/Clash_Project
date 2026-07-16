package Java;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

final class RateLimiter {
    private static final long WINDOW_MS = 60_000L;
    private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();
    private final AtomicLong requests = new AtomicLong();

    Result check(String key, int limit, long currentTimeMs) {
        MutableResult result = new MutableResult();
        buckets.compute(key, (ignored, existing) -> {
            Bucket bucket = existing;
            if (bucket == null || currentTimeMs - bucket.startedAtMs >= WINDOW_MS) {
                bucket = new Bucket(currentTimeMs, 0);
            }
            int count = bucket.count + 1;
            result.allowed = count <= limit;
            result.remaining = Math.max(0, limit - count);
            result.retryAfterSeconds = Math.max(
                    1,
                    (int) Math.ceil((bucket.startedAtMs + WINDOW_MS - currentTimeMs) / 1000.0)
            );
            return new Bucket(bucket.startedAtMs, count);
        });
        if ((requests.incrementAndGet() & 1023) == 0) {
            long oldest = currentTimeMs - (WINDOW_MS * 2);
            buckets.entrySet().removeIf(entry -> entry.getValue().startedAtMs < oldest);
        }
        return new Result(result.allowed, result.remaining, result.retryAfterSeconds);
    }

    record Result(boolean allowed, int remaining, int retryAfterSeconds) {}

    private record Bucket(long startedAtMs, int count) {}

    private static final class MutableResult {
        private boolean allowed;
        private int remaining;
        private int retryAfterSeconds;
    }
}

package Java.cwlhistory;

import com.github.benmanes.caffeine.cache.Expiry;

import java.time.Duration;
import java.util.Locale;

final class HistoricalCwlDetailCachePolicy
        implements Expiry<String, HistoricalCwlSeason> {
    @Override
    public long expireAfterCreate(
            String key,
            HistoricalCwlSeason value,
            long currentTime
    ) {
        return ttlNanos(value);
    }

    @Override
    public long expireAfterUpdate(
            String key,
            HistoricalCwlSeason value,
            long currentTime,
            long currentDuration
    ) {
        return ttlNanos(value);
    }

    @Override
    public long expireAfterRead(
            String key,
            HistoricalCwlSeason value,
            long currentTime,
            long currentDuration
    ) {
        return Math.min(currentDuration, ttlNanos(value));
    }

    private static long ttlNanos(HistoricalCwlSeason value) {
        Duration ttl = isCompleted(value)
                ? HistoricalCwlService.DETAIL_CACHE_TTL
                : HistoricalCwlService.LIVE_DETAIL_CACHE_TTL;
        return Math.max(1, ttl.toNanos());
    }

    private static boolean isCompleted(HistoricalCwlSeason value) {
        String state = value == null || value.state() == null
                ? "" : value.state().trim().toLowerCase(Locale.ROOT);
        return state.equals("ended") || state.equals("completed")
                || state.equals("complete") || state.equals("finished");
    }
}

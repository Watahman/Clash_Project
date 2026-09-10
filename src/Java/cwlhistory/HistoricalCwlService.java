package Java.cwlhistory;

import Java.HttpException;
import Java.cache.CacheKeys;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;

import java.time.Duration;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicLong;

public final class HistoricalCwlService {
    public static final int DEFAULT_SEASON_LIMIT = 12;
    public static final int MAX_SEASON_LIMIT = 24;
    static final Duration OVERVIEW_TIMEOUT = Duration.ofSeconds(8);
    static final Duration DETAIL_CACHE_TTL = Duration.ofDays(30);
    static final Duration LIVE_DETAIL_CACHE_TTL = Duration.ofMinutes(10);

    private static final Duration INDEX_CACHE_TTL = Duration.ofMinutes(15);
    private static final Duration OVERVIEW_CACHE_TTL = Duration.ofMinutes(5);
    private static final int INDEX_CONCURRENCY = 2;

    private final HistoricalCwlDataProvider provider;
    private final Cache<String, List<HistoricalCwlSeasonSummary>> seasonCache;
    private final Cache<String, HistoricalCwlSeason> detailCache;
    private final Cache<String, List<HistoricalCwlSeason>> overviewCache;
    private final Map<String, CompletableFuture<List<HistoricalCwlSeasonSummary>>>
            seasonInFlight = new ConcurrentHashMap<>();
    private final Map<String, CompletableFuture<HistoricalCwlSeason>> detailInFlight =
            new ConcurrentHashMap<>();
    private final AtomicLong cacheGeneration = new AtomicLong();
    private final ExecutorService indexPool;
    private final Duration overviewTimeout;

    public HistoricalCwlService(HistoricalCwlDataProvider provider) {
        this(provider, OVERVIEW_TIMEOUT);
    }

    HistoricalCwlService(
            HistoricalCwlDataProvider provider,
            Duration overviewTimeout
    ) {
        this.provider = provider;
        this.overviewTimeout = validTimeout(overviewTimeout);
        seasonCache = Caffeine.newBuilder()
                .maximumSize(500)
                .expireAfterWrite(INDEX_CACHE_TTL)
                .build();
        detailCache = Caffeine.newBuilder()
                .maximumSize(2_000)
                .expireAfter(new HistoricalCwlDetailCachePolicy())
                .build();
        overviewCache = Caffeine.newBuilder()
                .maximumSize(500)
                .expireAfterWrite(OVERVIEW_CACHE_TTL)
                .build();
        indexPool = Executors.newFixedThreadPool(INDEX_CONCURRENCY, runnable -> {
            Thread thread = new Thread(runnable, "cwl-history-index");
            thread.setDaemon(true);
            return thread;
        });
    }

    public List<HistoricalCwlSeasonSummary> getAvailableSeasons(
            String requestedClanTag,
            int requestedLimit
    ) throws Exception {
        String clanTag = CacheKeys.requireValidTag(requestedClanTag);
        int limit = validatedLimit(requestedLimit);
        String key = cacheKey(clanTag, MAX_SEASON_LIMIT);
        List<HistoricalCwlSeasonSummary> cached = seasonCache.getIfPresent(key);
        List<HistoricalCwlSeasonSummary> summaries = cached == null
                ? await(indexFuture(clanTag, MAX_SEASON_LIMIT, key))
                : cached;
        return limitedSummaries(summaries, limit);
    }

    public HistoricalCwlSeason getSeason(
            String requestedClanTag,
            String requestedSeason
    ) throws Exception {
        String clanTag = CacheKeys.requireValidTag(requestedClanTag);
        String season = validatedSeason(requestedSeason);
        String key = cacheKey(clanTag, season);
        HistoricalCwlSeason cached = detailCache.getIfPresent(key);
        return cached == null ? await(detailFuture(clanTag, season, key)) : cached;
    }

    public List<HistoricalCwlSeason> getOverview(
            String requestedClanTag,
            int requestedLimit
    ) throws Exception {
        String clanTag = CacheKeys.requireValidTag(requestedClanTag);
        int limit = validatedLimit(requestedLimit);
        String key = cacheKey(clanTag, limit);
        List<HistoricalCwlSeason> cached = overviewCache.getIfPresent(key);
        if (cached != null) return cached;

        long deadline = System.nanoTime() + overviewTimeout.toNanos();
        List<HistoricalCwlSeasonSummary> summaries = loadIndexForOverview(
                clanTag, deadline
        );
        List<HistoricalCwlSeason> result = HistoricalCwlOverviewMapper.fromSummaries(
                clanTag, limit, summaries
        );
        List<HistoricalCwlSeason> immutable = List.copyOf(result);
        if (!immutable.isEmpty()) overviewCache.put(key, immutable);
        return immutable;
    }

    public void clearCaches() {
        cacheGeneration.incrementAndGet();
        seasonCache.invalidateAll();
        detailCache.invalidateAll();
        overviewCache.invalidateAll();
        seasonInFlight.clear();
        detailInFlight.clear();
        provider.clearCaches();
    }

    private List<HistoricalCwlSeasonSummary> loadIndexForOverview(
            String clanTag,
            long deadline
    ) throws Exception {
        String key = cacheKey(clanTag, MAX_SEASON_LIMIT);
        CompletableFuture<List<HistoricalCwlSeasonSummary>> future = indexFuture(
                clanTag, MAX_SEASON_LIMIT, key
        );
        long remaining = deadline - System.nanoTime();
        if (remaining <= 0) {
            logIndexFailure(new TimeoutException("overall overview timeout"));
            return List.of();
        }
        try {
            return future.get(remaining, TimeUnit.NANOSECONDS);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            logIndexFailure(interrupted);
        } catch (TimeoutException timeout) {
            logIndexFailure(timeout);
        } catch (ExecutionException failure) {
            Throwable cause = unwrap(failure);
            if (cause instanceof HttpException httpFailure) throw httpFailure;
            logIndexFailure(cause);
        }
        return List.of();
    }

    private CompletableFuture<List<HistoricalCwlSeasonSummary>> indexFuture(
            String clanTag,
            int limit,
            String key
    ) {
        long generation = cacheGeneration.get();
        CompletableFuture<List<HistoricalCwlSeasonSummary>> candidate =
                new CompletableFuture<>();
        CompletableFuture<List<HistoricalCwlSeasonSummary>> existing =
                seasonInFlight.putIfAbsent(key, candidate);
        if (existing != null) return existing;
        try {
            indexPool.execute(() -> completeIndex(
                    candidate, clanTag, limit, key, generation
            ));
        } catch (RuntimeException rejected) {
            seasonInFlight.remove(key, candidate);
            candidate.completeExceptionally(rejected);
        }
        return candidate;
    }

    private void completeIndex(
            CompletableFuture<List<HistoricalCwlSeasonSummary>> future,
            String clanTag,
            int limit,
            String key,
            long generation
    ) {
        try {
            List<HistoricalCwlSeasonSummary> loaded = provider.getAvailableSeasons(
                    clanTag, limit
            );
            List<HistoricalCwlSeasonSummary> result = List.copyOf(
                    loaded == null ? List.of() : loaded
            );
            if (cacheGeneration.get() == generation) seasonCache.put(key, result);
            future.complete(result);
        } catch (Exception failure) {
            future.completeExceptionally(failure);
        } finally {
            seasonInFlight.remove(key, future);
        }
    }

    private CompletableFuture<HistoricalCwlSeason> detailFuture(
            String clanTag,
            String season,
            String key
    ) {
        long generation = cacheGeneration.get();
        CompletableFuture<HistoricalCwlSeason> candidate = new CompletableFuture<>();
        CompletableFuture<HistoricalCwlSeason> existing = detailInFlight.putIfAbsent(
                key, candidate
        );
        if (existing != null) return existing;
        try {
            HistoricalCwlSeason result = provider.getSeason(clanTag, season);
            if (result == null) throw new IllegalStateException(
                    "CWL season detail was empty"
            );
            if (cacheGeneration.get() == generation) detailCache.put(key, result);
            candidate.complete(result);
        } catch (Exception failure) {
            candidate.completeExceptionally(failure);
        } finally {
            detailInFlight.remove(key, candidate);
        }
        return candidate;
    }

    private static <T> T await(CompletableFuture<T> future) throws Exception {
        try {
            return future.join();
        } catch (CompletionException wrapped) {
            Throwable cause = unwrap(wrapped);
            if (cause instanceof Exception exception) throw exception;
            throw wrapped;
        }
    }

    private static Throwable unwrap(Throwable failure) {
        Throwable cause = failure;
        while ((cause instanceof CompletionException
                || cause instanceof ExecutionException)
                && cause.getCause() != null) {
            cause = cause.getCause();
        }
        return cause;
    }

    private static List<HistoricalCwlSeasonSummary> limitedSummaries(
            List<HistoricalCwlSeasonSummary> summaries,
            int limit
    ) {
        return summaries.stream().limit(limit).toList();
    }

    private static String cacheKey(String clanTag, int limit) {
        return clanTag + ":" + limit;
    }

    private static String cacheKey(String clanTag, String season) {
        return clanTag + ":" + season;
    }

    private static int validatedLimit(int requested) {
        int limit = requested <= 0 ? DEFAULT_SEASON_LIMIT : requested;
        return Math.min(MAX_SEASON_LIMIT, limit);
    }

    private static String validatedSeason(String value) {
        try {
            return YearMonth.parse(String.valueOf(value).trim()).toString();
        } catch (RuntimeException invalid) {
            throw new IllegalArgumentException("season moet het formaat YYYY-MM gebruiken");
        }
    }

    private static Duration validTimeout(Duration requested) {
        if (requested == null || requested.isZero() || requested.isNegative()) {
            return OVERVIEW_TIMEOUT;
        }
        return requested.compareTo(Duration.ofSeconds(30)) > 0
                ? Duration.ofSeconds(30) : requested;
    }

    private static void logIndexFailure(Throwable failure) {
        System.err.printf("[CWL history] season index unavailable: %s%n", failure);
    }
}

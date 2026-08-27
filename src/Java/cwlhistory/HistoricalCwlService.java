package Java.cwlhistory;

import Java.cache.CacheKeys;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;

import java.time.Duration;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class HistoricalCwlService {
    public static final int DEFAULT_SEASON_LIMIT = 12;
    public static final int MAX_SEASON_LIMIT = 24;

    private final HistoricalCwlDataProvider provider;
    private final Cache<String, List<HistoricalCwlSeasonSummary>> seasonCache;
    private final Cache<String, HistoricalCwlSeason> detailCache;
    private final Cache<String, List<HistoricalCwlSeason>> overviewCache;
    private final ExecutorService overviewPool;

    public HistoricalCwlService(HistoricalCwlDataProvider provider) {
        this.provider = provider;
        seasonCache = Caffeine.newBuilder()
                .maximumSize(500)
                .expireAfterWrite(Duration.ofMinutes(15))
                .build();
        detailCache = Caffeine.newBuilder()
                .maximumSize(2_000)
                .expireAfterWrite(Duration.ofMinutes(30))
                .build();
        overviewCache = Caffeine.newBuilder()
                .maximumSize(500)
                .expireAfterWrite(Duration.ofMinutes(15))
                .build();
        overviewPool = Executors.newFixedThreadPool(3, runnable -> {
            Thread thread = new Thread(runnable, "cwl-history-overview");
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
        String key = clanTag + ":" + limit;
        List<HistoricalCwlSeasonSummary> cached = seasonCache.getIfPresent(key);
        if (cached != null) return cached;
        List<HistoricalCwlSeasonSummary> result = List.copyOf(
                provider.getAvailableSeasons(clanTag, limit)
        );
        seasonCache.put(key, result);
        return result;
    }

    public HistoricalCwlSeason getSeason(
            String requestedClanTag,
            String requestedSeason
    ) throws Exception {
        String clanTag = CacheKeys.requireValidTag(requestedClanTag);
        String season = validatedSeason(requestedSeason);
        String key = clanTag + ":" + season;
        HistoricalCwlSeason cached = detailCache.getIfPresent(key);
        if (cached != null) return cached;
        HistoricalCwlSeason result = provider.getSeason(clanTag, season);
        detailCache.put(key, result);
        return result;
    }

    public List<HistoricalCwlSeason> getOverview(
            String requestedClanTag,
            int requestedLimit
    ) throws Exception {
        String clanTag = CacheKeys.requireValidTag(requestedClanTag);
        int limit = validatedLimit(requestedLimit);
        String key = clanTag + ":" + limit;
        List<HistoricalCwlSeason> cached = overviewCache.getIfPresent(key);
        if (cached != null) return cached;
        BatchAttempt attempt = loadOverviewBatch(clanTag, limit);
        List<HistoricalCwlSeason> result = attempt.seasons();
        result.forEach(season -> detailCache.put(
                clanTag + ":" + season.season(),
                season
        ));
        List<HistoricalCwlSeason> immutable = List.copyOf(result);
        overviewCache.put(key, immutable);
        return immutable;
    }

    private BatchAttempt loadOverviewBatch(String clanTag, int limit)
            throws Exception {
        return loadBatch(provider, clanTag, limit);
    }

    private BatchAttempt loadBatch(
            HistoricalCwlDataProvider source,
            String clanTag,
            int limit
    ) throws Exception {
        List<HistoricalCwlSeasonSummary> summaries =
                source.getAvailableSeasons(clanTag, MAX_SEASON_LIMIT);
        List<HistoricalCwlSeason> seasons = new ArrayList<>();
        int failures = 0;
        final int batchSize = 3;

        for (int start = 0; start < summaries.size() && seasons.size() < limit;
             start += batchSize) {
            int end = Math.min(start + batchSize, summaries.size());
            List<CompletableFuture<SeasonAttempt>> pending = summaries
                    .subList(start, end)
                    .stream()
                    .map(summary -> CompletableFuture.supplyAsync(
                            () -> loadSeason(source, clanTag, summary),
                            overviewPool
                    ))
                    .toList();
            for (CompletableFuture<SeasonAttempt> future : pending) {
                SeasonAttempt attempt = future.join();
                if (attempt.season() == null) {
                    failures += 1;
                    continue;
                }
                if (seasons.size() < limit) seasons.add(attempt.season());
            }
        }
        List<HistoricalCwlSeason> enriched = source.enrichOverview(
                clanTag,
                List.copyOf(seasons)
        );
        return new BatchAttempt(
                List.copyOf(enriched),
                enriched.size() >= limit || failures == 0
        );
    }

    private static SeasonAttempt loadSeason(
            HistoricalCwlDataProvider source,
            String clanTag,
            HistoricalCwlSeasonSummary summary
    ) {
        try {
            HistoricalCwlSeason season = source.getSeason(
                    clanTag,
                    summary.season()
            );
            return new SeasonAttempt(withIndexMetadata(season, summary));
        } catch (Exception ignored) {
            return new SeasonAttempt(null);
        }
    }

    private static HistoricalCwlSeason withIndexMetadata(
            HistoricalCwlSeason season,
            HistoricalCwlSeasonSummary summary
    ) {
        HistoricalCwlSeason.League league = season.league();
        if ((league == null || league.name() == null || league.name().isBlank())
                && summary.league() != null) {
            league = summary.league();
        }
        Integer position = season.position() == null
                ? summary.position()
                : season.position();
        return new HistoricalCwlSeason(
                season.season(),
                season.clan(),
                league,
                position,
                season.record(),
                season.standings(),
                season.wars(),
                season.roster(),
                season.state(),
                season.source(),
                season.dataQuality(),
                season.warDetailsComplete()
        );
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

    private record BatchAttempt(
            List<HistoricalCwlSeason> seasons,
            boolean complete
    ) {}

    private record SeasonAttempt(HistoricalCwlSeason season) {}
}

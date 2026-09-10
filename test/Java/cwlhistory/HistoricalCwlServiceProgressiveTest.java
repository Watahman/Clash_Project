package Java.cwlhistory;

import Java.HttpException;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;

class HistoricalCwlServiceProgressiveTest {
    @Test
    void overviewUsesCompactIndexRowsWithoutDetailFanOut() throws Exception {
        AtomicInteger detailCalls = new AtomicInteger();
        List<HistoricalCwlSeasonSummary> index = summaries(4);
        HistoricalCwlDataProvider provider = provider(index, (tag, season) -> {
            detailCalls.incrementAndGet();
            throw new AssertionError("overview must not load season details");
        });

        List<HistoricalCwlSeason> result = new HistoricalCwlService(provider)
                .getOverview("#PQL", 3);

        assertEquals(3, result.size());
        assertEquals("2026-12", result.getFirst().season());
        assertEquals("Master League II", result.getFirst().league().name());
        assertEquals(4, result.getFirst().record().wins());
        assertTrue(result.getFirst().wars().isEmpty());
        assertEquals(0, detailCalls.get());
    }

    @Test
    void overviewAndIndexReuseTheirCaches() throws Exception {
        AtomicInteger indexCalls = new AtomicInteger();
        HistoricalCwlDataProvider provider = new HistoricalCwlDataProvider() {
            @Override
            public List<HistoricalCwlSeasonSummary> getAvailableSeasons(
                    String tag,
                    int limit
            ) {
                indexCalls.incrementAndGet();
                return summaries(4);
            }

            @Override
            public HistoricalCwlSeason getSeason(String tag, String season) {
                throw new AssertionError("overview must not load season details");
            }

            @Override
            public String providerName() {
                return "test";
            }
        };
        HistoricalCwlService service = new HistoricalCwlService(provider);

        service.getOverview("#PQL", 3);
        service.getAvailableSeasons("#PQL", 4);
        service.getOverview("#PQL", 3);

        assertEquals(1, indexCalls.get());
    }

    @Test
    void overviewNeverSerializesCachedDetailPayloads() throws Exception {
        AtomicInteger detailCalls = new AtomicInteger();
        HistoricalCwlDataProvider provider = provider(summaries(2), (tag, season) -> {
            detailCalls.incrementAndGet();
            return season(tag, season);
        });
        HistoricalCwlService service = new HistoricalCwlService(provider);
        service.getSeason("#PQL", "2026-12");

        List<HistoricalCwlSeason> result = service.getOverview("#PQL", 2);

        assertEquals(1, detailCalls.get());
        assertEquals("Partial history", result.getFirst().dataQuality());
        assertTrue(result.getFirst().wars().isEmpty());
        assertFalse(result.getFirst().warDetailsComplete());
    }

    @Test
    void overviewPreservesUpstreamRateLimitStatus() {
        HistoricalCwlDataProvider provider = new HistoricalCwlDataProvider() {
            @Override
            public List<HistoricalCwlSeasonSummary> getAvailableSeasons(
                    String tag,
                    int limit
            ) throws Exception {
                throw HttpException.upstream(429, "{}", "ClashKing");
            }

            @Override
            public HistoricalCwlSeason getSeason(String tag, String season) {
                return season(tag, season);
            }

            @Override
            public String providerName() {
                return "test";
            }
        };

        HttpException error = assertThrows(HttpException.class, () ->
                new HistoricalCwlService(provider).getOverview("#PQL", 3));

        assertEquals(429, error.getStatusCode());
    }

    @Test
    void overviewReturnsEmptySafelyWhenIndexExceedsDeadline() throws Exception {
        AtomicInteger indexCalls = new AtomicInteger();
        CountDownLatch started = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        HistoricalCwlDataProvider provider = new HistoricalCwlDataProvider() {
            @Override
            public List<HistoricalCwlSeasonSummary> getAvailableSeasons(
                    String tag,
                    int limit
            ) throws Exception {
                indexCalls.incrementAndGet();
                started.countDown();
                release.await(1, TimeUnit.SECONDS);
                return summaries(2);
            }

            @Override
            public HistoricalCwlSeason getSeason(String tag, String season) {
                throw new AssertionError("detail must not start after index timeout");
            }

            @Override
            public String providerName() {
                return "test";
            }
        };
        HistoricalCwlService service = new HistoricalCwlService(
                provider, Duration.ofMillis(40)
        );

        long startedAt = System.nanoTime();
        List<HistoricalCwlSeason> result = service.getOverview("#PQL", 2);
        long elapsed = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAt);

        assertTrue(started.await(1, TimeUnit.SECONDS));
        assertTrue(result.isEmpty());
        assertTrue(elapsed < 200, "overview exceeded deadline: " + elapsed + "ms");

        release.countDown();
        assertEquals(2, service.getOverview("#PQL", 2).size());
        assertEquals(1, indexCalls.get());
    }

    private static HistoricalCwlDataProvider provider(
            List<HistoricalCwlSeasonSummary> index,
            SeasonLoader loader
    ) {
        return new HistoricalCwlDataProvider() {
            @Override
            public List<HistoricalCwlSeasonSummary> getAvailableSeasons(
                    String tag,
                    int limit
            ) {
                return index;
            }

            @Override
            public HistoricalCwlSeason getSeason(String tag, String season)
                    throws Exception {
                return loader.load(tag, season);
            }

            @Override
            public String providerName() {
                return "test";
            }
        };
    }

    private static List<HistoricalCwlSeasonSummary> summaries(int count) {
        List<HistoricalCwlSeasonSummary> result = new ArrayList<>();
        for (int index = 0; index < count; index++) {
            result.add(new HistoricalCwlSeasonSummary(
                    "2026-%02d".formatted(12 - index),
                    new HistoricalCwlSeason.League(null, "Master League II"),
                    index + 1,
                    4,
                    2,
                    1,
                    40,
                    90.0,
                    "ended",
                    "test",
                    "Partial history"
            ));
        }
        return List.copyOf(result);
    }

    private static HistoricalCwlSeason season(String tag, String season) {
        return new HistoricalCwlSeason(
                season,
                new HistoricalCwlSeason.Clan(tag, "Test clan"),
                new HistoricalCwlSeason.League(null, "Master League II"),
                1,
                new HistoricalCwlSeason.Record(4, 2, 1),
                List.of(),
                List.of(),
                List.of(),
                "ended",
                "test",
                "Complete",
                true
        );
    }

    @FunctionalInterface
    private interface SeasonLoader {
        HistoricalCwlSeason load(String tag, String season) throws Exception;
    }
}

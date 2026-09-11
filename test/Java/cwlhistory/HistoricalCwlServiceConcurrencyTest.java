package Java.cwlhistory;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class HistoricalCwlServiceConcurrencyTest {
    @Test
    void simultaneousIndexMissesShareOneProviderCall() throws Exception {
        AtomicInteger indexCalls = new AtomicInteger();
        CountDownLatch started = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        HistoricalCwlDataProvider provider = provider(
                indexCalls, new AtomicInteger(), started, release
        );
        HistoricalCwlService service = new HistoricalCwlService(provider);
        ExecutorService callers = Executors.newFixedThreadPool(6);
        List<Future<List<HistoricalCwlSeasonSummary>>> pending = new ArrayList<>();
        try {
            for (int index = 0; index < 6; index++) {
                pending.add(callers.submit(() ->
                        service.getAvailableSeasons("#PQL", 2)));
            }
            assertTrue(started.await(1, TimeUnit.SECONDS));
            release.countDown();
            for (Future<List<HistoricalCwlSeasonSummary>> future : pending) {
                assertEquals(1, future.get(1, TimeUnit.SECONDS).size());
            }
        } finally {
            release.countDown();
            callers.shutdownNow();
        }
        assertEquals(1, indexCalls.get());
    }

    @Test
    void simultaneousDetailMissesShareOneProviderCall() throws Exception {
        AtomicInteger detailCalls = new AtomicInteger();
        CountDownLatch started = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        HistoricalCwlDataProvider provider = provider(
                new AtomicInteger(), detailCalls, started, release
        );
        HistoricalCwlService service = new HistoricalCwlService(provider);
        ExecutorService callers = Executors.newFixedThreadPool(6);
        List<Future<HistoricalCwlSeason>> pending = new ArrayList<>();
        try {
            for (int index = 0; index < 6; index++) {
                pending.add(callers.submit(() -> service.getSeason(
                        "#PQL", "2026-12"
                )));
            }
            assertTrue(started.await(1, TimeUnit.SECONDS));
            release.countDown();
            for (Future<HistoricalCwlSeason> future : pending) {
                assertEquals("2026-12", future.get(1, TimeUnit.SECONDS).season());
            }
        } finally {
            release.countDown();
            callers.shutdownNow();
        }
        assertEquals(1, detailCalls.get());
    }

    private static HistoricalCwlDataProvider provider(
            AtomicInteger indexCalls,
            AtomicInteger detailCalls,
            CountDownLatch started,
            CountDownLatch release
    ) {
        return new HistoricalCwlDataProvider() {
            @Override
            public List<HistoricalCwlSeasonSummary> getAvailableSeasons(
                    String tag,
                    int limit
            ) throws Exception {
                indexCalls.incrementAndGet();
                started.countDown();
                release.await(1, TimeUnit.SECONDS);
                return List.of(summary());
            }

            @Override
            public HistoricalCwlSeason getSeason(String tag, String season)
                    throws Exception {
                detailCalls.incrementAndGet();
                started.countDown();
                release.await(1, TimeUnit.SECONDS);
                return season(tag, season);
            }

            @Override
            public String providerName() {
                return "test";
            }
        };
    }

    private static HistoricalCwlSeasonSummary summary() {
        return new HistoricalCwlSeasonSummary(
                "2026-12",
                new HistoricalCwlSeason.League(null, "Master League II"),
                1, 4, 2, 1, 40, 90.0,
                "ended", "test", "Partial history"
        );
    }

    private static HistoricalCwlSeason season(String tag, String season) {
        return new HistoricalCwlSeason(
                season,
                new HistoricalCwlSeason.Clan(tag, "Test clan"),
                new HistoricalCwlSeason.League(null, "Master League II"),
                1,
                new HistoricalCwlSeason.Record(4, 2, 1),
                List.of(), List.of(), List.of(),
                "ended", "test", "Complete", true
        );
    }

}

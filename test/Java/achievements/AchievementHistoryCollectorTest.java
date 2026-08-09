package Java.achievements;

import Java.HttpException;
import Java.cwlhistory.HistoricalCwlDataProvider;
import Java.cwlhistory.HistoricalCwlSeason;
import Java.cwlhistory.HistoricalCwlSeasonSummary;
import Java.cwlhistory.HistoricalCwlService;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AchievementHistoryCollectorTest {
    @Test
    void skipsMissingCandidateMonthsUntilFourRealSeasonsAreLoaded()
            throws Exception {
        HistoricalCwlService service = serviceWithMissing("2026-08", "2026-06");

        AchievementHistoryCollector.CwlCandidateBatch batch =
                AchievementHistoryCollector.loadCwlCandidates(
                        service,
                        "#PQL",
                        summaries(8)
                );

        assertEquals(6, batch.attempted());
        assertEquals(2, batch.missing());
        assertEquals(
                List.of("2026-07", "2026-05", "2026-04", "2026-03"),
                batch.loaded().stream()
                        .map(item -> item.season().season())
                        .toList()
        );
    }

    @Test
    void stopsAfterTheBoundedCandidateAttemptBudget() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        HistoricalCwlService service = new HistoricalCwlService(provider(
                season -> {
                    calls.incrementAndGet();
                    throw HttpException.upstream(
                            404,
                            "{\"detail\":\"Not Found\"}",
                            "ClashKing API"
                    );
                }
        ));

        AchievementHistoryCollector.CwlCandidateBatch batch =
                AchievementHistoryCollector.loadCwlCandidates(
                        service,
                        "#PQL",
                        summaries(20)
                );

        assertEquals(AchievementHistoryCollector.CWL_ATTEMPT_BUDGET, calls.get());
        assertEquals(AchievementHistoryCollector.CWL_ATTEMPT_BUDGET, batch.attempted());
        assertEquals(0, batch.loaded().size());
    }

    @Test
    void doesNotHideNonUpstreamOrNon404Failures() {
        for (HttpException failure : List.of(
                new HttpException(404, "{\"error\":\"local\"}"),
                HttpException.upstream(503, "{\"error\":\"down\"}", "ClashKing API")
        )) {
            HistoricalCwlService service = new HistoricalCwlService(provider(
                    season -> { throw failure; }
            ));

            HttpException actual = assertThrows(
                    HttpException.class,
                    () -> AchievementHistoryCollector.loadCwlCandidates(
                            service,
                            "#PQL",
                            summaries(1)
                    )
            );
            assertEquals(failure, actual);
        }
    }

    private static HistoricalCwlService serviceWithMissing(String... missing) {
        Set<String> missingSeasons = new HashSet<>(List.of(missing));
        return new HistoricalCwlService(provider(season -> {
            if (missingSeasons.contains(season)) {
                throw HttpException.upstream(
                        404,
                        "{\"detail\":\"Not Found\"}",
                        "ClashKing API"
                );
            }
            return season(season);
        }));
    }

    private static HistoricalCwlDataProvider provider(SeasonLoader loader) {
        return new HistoricalCwlDataProvider() {
            @Override
            public List<HistoricalCwlSeasonSummary> getAvailableSeasons(
                    String clanTag,
                    int limit
            ) {
                return List.of();
            }

            @Override
            public HistoricalCwlSeason getSeason(String clanTag, String season)
                    throws Exception {
                return loader.load(season);
            }

            @Override
            public String providerName() {
                return "test";
            }
        };
    }

    private static List<HistoricalCwlSeasonSummary> summaries(int count) {
        List<HistoricalCwlSeasonSummary> result = new ArrayList<>();
        java.time.YearMonth newest = java.time.YearMonth.of(2026, 8);
        for (int offset = 0; offset < count; offset++) {
            String season = newest.minusMonths(offset).toString();
            result.add(new HistoricalCwlSeasonSummary(
                    season,
                    new HistoricalCwlSeason.League(null, ""),
                    null,
                    0,
                    0,
                    0,
                    0,
                    null,
                    "unknown",
                    "test",
                    "candidate"
            ));
        }
        return result;
    }

    private static HistoricalCwlSeason season(String season) {
        return new HistoricalCwlSeason(
                season,
                new HistoricalCwlSeason.Clan("#PQL", "ClashPanel"),
                new HistoricalCwlSeason.League(null, ""),
                null,
                null,
                List.of(),
                List.of(),
                List.of(),
                "ended",
                "test",
                "complete",
                true
        );
    }

    @FunctionalInterface
    private interface SeasonLoader {
        HistoricalCwlSeason load(String season) throws Exception;
    }
}

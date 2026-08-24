package Java.cwlhistory;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FallbackHistoricalCwlDataProviderTest {
    @Test
    void enrichesSeasonsLoadedFromTheFallbackSource() throws Exception {
        AtomicBoolean fallbackEnriched = new AtomicBoolean();
        HistoricalCwlDataProvider primary = provider("v2");
        HistoricalCwlDataProvider fallback = new HistoricalCwlDataProvider() {
            @Override
            public List<HistoricalCwlSeasonSummary> getAvailableSeasons(
                    String clanTag,
                    int limit
            ) {
                return List.of();
            }

            @Override
            public HistoricalCwlSeason getSeason(String clanTag, String season) {
                return season(season, "api");
            }

            @Override
            public List<HistoricalCwlSeason> enrichOverview(
                    String clanTag,
                    List<HistoricalCwlSeason> seasons
            ) {
                fallbackEnriched.set(true);
                return seasons;
            }

            @Override
            public String providerName() {
                return "api";
            }
        };
        FallbackHistoricalCwlDataProvider provider =
                new FallbackHistoricalCwlDataProvider(primary, fallback);

        List<HistoricalCwlSeason> result = provider.enrichOverview(
                "#PQL",
                List.of(season("2026-06", "api"))
        );

        assertEquals("2026-06", result.getFirst().season());
        assertTrue(fallbackEnriched.get());
    }

    private static HistoricalCwlDataProvider provider(String name) {
        return new HistoricalCwlDataProvider() {
            @Override
            public List<HistoricalCwlSeasonSummary> getAvailableSeasons(
                    String clanTag,
                    int limit
            ) {
                return List.of();
            }

            @Override
            public HistoricalCwlSeason getSeason(String clanTag, String season) {
                return season(season, name);
            }

            @Override
            public String providerName() {
                return name;
            }
        };
    }

    private static HistoricalCwlSeason season(String season, String source) {
        return new HistoricalCwlSeason(
                season,
                new HistoricalCwlSeason.Clan("#PQL", "ClashPanel"),
                new HistoricalCwlSeason.League(null, ""),
                null,
                new HistoricalCwlSeason.Record(0, 0, 0),
                List.of(),
                List.of(),
                List.of(),
                "ended",
                source,
                "unknown",
                false
        );
    }
}

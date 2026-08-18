package Java.cwlhistory;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;

class HistoricalCwlServiceTest {
    @Test
    void cachesSeasonDetailsInMemoryOnly() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        HistoricalCwlDataProvider provider = new HistoricalCwlDataProvider() {
            @Override
            public List<HistoricalCwlSeasonSummary> getAvailableSeasons(
                    String clanTag,
                    int limit
            ) {
                return List.of();
            }

            @Override
            public HistoricalCwlSeason getSeason(String clanTag, String season) {
                calls.incrementAndGet();
                return emptySeason(clanTag, season);
            }

            @Override
            public String providerName() {
                return "test";
            }
        };
        HistoricalCwlService service = new HistoricalCwlService(provider);

        service.getSeason("#PQL", "2026-06");
        service.getSeason("#PQL", "2026-06");

        assertEquals(1, calls.get());
    }

    @Test
    void decodesAnAlreadyEncodedClanTagBeforeCallingTheProvider()
            throws Exception {
        AtomicReference<String> receivedTag = new AtomicReference<>();
        HistoricalCwlDataProvider provider = new HistoricalCwlDataProvider() {
            @Override
            public List<HistoricalCwlSeasonSummary> getAvailableSeasons(
                    String clanTag,
                    int limit
            ) {
                receivedTag.set(clanTag);
                return List.of();
            }

            @Override
            public HistoricalCwlSeason getSeason(String clanTag, String season) {
                return emptySeason(clanTag, season);
            }

            @Override
            public String providerName() {
                return "test";
            }
        };

        new HistoricalCwlService(provider)
                .getAvailableSeasons("%23pql", 8);

        assertEquals("#PQL", receivedTag.get());
    }

    private static HistoricalCwlSeason emptySeason(String clanTag, String season) {
        return emptySeason(clanTag, season, "test");
    }

    private static HistoricalCwlSeason emptySeason(
            String clanTag,
            String season,
            String provider
    ) {
        return new HistoricalCwlSeason(
                season,
                new HistoricalCwlSeason.Clan(clanTag, clanTag),
                new HistoricalCwlSeason.League(null, ""),
                null,
                new HistoricalCwlSeason.Record(0, 0, 0),
                List.of(),
                List.of(),
                List.of(),
                "completed",
                provider,
                "Insufficient data",
                false
        );
    }
}

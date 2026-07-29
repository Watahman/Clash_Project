package Java.cwlhistory;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CwlLeagueHistoryReconstructorTest {
    @Test
    void countsBackFromCurrentLeagueAcrossPlayedSeasonsOnly() {
        List<HistoricalCwlSeason> reconstructed =
                CwlLeagueHistoryReconstructor.reconstruct(
                        List.of(
                                season("2026-06", 3),
                                season("2026-05", 7),
                                season("2026-03", 1)
                        ),
                        league("Champion League III"),
                        List.of()
                );

        assertEquals(
                List.of(
                        "Champion League III",
                        "Champion League II",
                        "Champion League III"
                ),
                reconstructed.stream()
                        .map(item -> item.league().name())
                        .toList()
        );
    }

    @Test
    void neverPlacesTitanOrLegendBeforeTheExpansion() {
        List<HistoricalCwlSeason> reconstructed =
                CwlLeagueHistoryReconstructor.reconstruct(
                        List.of(season("2026-03", 3)),
                        league("Titan League III"),
                        List.of()
                );

        assertEquals("", reconstructed.getFirst().league().name());
    }

    @Test
    void canCountBackThroughTheExpandedLeaguePath() {
        List<HistoricalCwlSeason> reconstructed =
                CwlLeagueHistoryReconstructor.reconstruct(
                        List.of(
                                season("2026-06", 1),
                                season("2026-05", 1),
                                season("2026-03", 1)
                        ),
                        league("Titan League II"),
                        List.of()
                );

        assertEquals(
                List.of(
                        "Titan League III",
                        "Champion League I",
                        "Champion League I"
                ),
                reconstructed.stream()
                        .map(item -> item.league().name())
                        .toList()
        );
    }

    private static HistoricalCwlSeason season(String season, int position) {
        List<HistoricalCwlSeason.Standing> standings = new ArrayList<>();
        for (int rank = 1; rank <= 8; rank++) {
            standings.add(new HistoricalCwlSeason.Standing(
                    rank,
                    rank == position ? "#PQL" : "#CLAN" + rank,
                    "Clan " + rank,
                    0,
                    0,
                    0,
                    100 - rank,
                    100 - rank
            ));
        }
        return new HistoricalCwlSeason(
                season,
                new HistoricalCwlSeason.Clan("#PQL", "ClashPanel"),
                league(""),
                position,
                new HistoricalCwlSeason.Record(0, 0, 0),
                standings,
                List.of(),
                List.of(),
                "ended",
                "api",
                "Partial history",
                false
        );
    }

    private static HistoricalCwlSeason.League league(String name) {
        return new HistoricalCwlSeason.League(null, name);
    }
}

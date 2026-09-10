package Java.cwlhistory;

import java.util.List;

/** Builds the response-safe, detail-free representation used by the overview. */
final class HistoricalCwlOverviewMapper {
    private HistoricalCwlOverviewMapper() {}

    static List<HistoricalCwlSeason> fromSummaries(
            String clanTag,
            int limit,
            List<HistoricalCwlSeasonSummary> summaries
    ) {
        if (summaries == null || summaries.isEmpty()) return List.of();
        return summaries.stream()
                .filter(HistoricalCwlOverviewMapper::hasSeason)
                .limit(limit)
                .map(summary -> compactSeason(clanTag, summary))
                .toList();
    }

    private static boolean hasSeason(HistoricalCwlSeasonSummary summary) {
        return summary != null
                && summary.season() != null
                && !summary.season().isBlank();
    }

    private static HistoricalCwlSeason compactSeason(
            String clanTag,
            HistoricalCwlSeasonSummary summary
    ) {
        return new HistoricalCwlSeason(
                summary.season(),
                new HistoricalCwlSeason.Clan(clanTag, clanTag),
                summary.league(),
                summary.position(),
                new HistoricalCwlSeason.Record(
                        summary.wins(), summary.losses(), summary.draws()
                ),
                List.of(),
                List.of(),
                List.of(),
                summary.state(),
                summary.source(),
                quality(summary),
                false,
                summary.stars(),
                summary.destruction()
        );
    }

    private static String quality(HistoricalCwlSeasonSummary summary) {
        return summary.dataQuality() == null || summary.dataQuality().isBlank()
                ? "Partial history" : summary.dataQuality();
    }
}

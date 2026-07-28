package Java.cwlhistory;

public record HistoricalCwlSeasonSummary(
        String season,
        HistoricalCwlSeason.League league,
        Integer position,
        int wins,
        int losses,
        int draws,
        int stars,
        Double destruction,
        String state,
        String source,
        String dataQuality
) {}

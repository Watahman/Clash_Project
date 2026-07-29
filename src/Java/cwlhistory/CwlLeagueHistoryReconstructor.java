package Java.cwlhistory;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class CwlLeagueHistoryReconstructor {
    private static final String EXPANSION_SEASON = "2026-05";
    private static final List<String> ORIGINAL_LEAGUES = List.of(
            "Bronze League III", "Bronze League II", "Bronze League I",
            "Silver League III", "Silver League II", "Silver League I",
            "Gold League III", "Gold League II", "Gold League I",
            "Crystal League III", "Crystal League II", "Crystal League I",
            "Master League III", "Master League II", "Master League I",
            "Champion League III", "Champion League II", "Champion League I"
    );
    private static final List<String> EXPANDED_LEAGUES = List.of(
            "Bronze League III", "Bronze League II", "Bronze League I",
            "Silver League III", "Silver League II", "Silver League I",
            "Gold League III", "Gold League II", "Gold League I",
            "Crystal League III", "Crystal League II", "Crystal League I",
            "Master League III", "Master League II", "Master League I",
            "Champion League III", "Champion League II", "Champion League I",
            "Titan League III", "Titan League II", "Titan League I",
            "Legend League"
    );

    private CwlLeagueHistoryReconstructor() {}

    static List<HistoricalCwlSeason> reconstruct(
            List<HistoricalCwlSeason> newestFirst,
            HistoricalCwlSeason.League currentLeague,
            List<HistoricalCwlSeasonSummary> recordedLeagues
    ) {
        Map<String, HistoricalCwlSeason.League> recordedBySeason =
                new LinkedHashMap<>();
        for (HistoricalCwlSeasonSummary recorded : recordedLeagues) {
            if (known(recorded.league(), recorded.season())) {
                recordedBySeason.put(recorded.season(), recorded.league());
            }
        }

        String followingLeague = leagueName(currentLeague);
        List<HistoricalCwlSeason> result = new ArrayList<>();
        for (HistoricalCwlSeason season : newestFirst) {
            HistoricalCwlSeason.League exact = known(
                    season.league(), season.season()
            ) ? season.league() : recordedBySeason.get(season.season());
            String reconstructed = exact == null
                    ? inferStartingLeague(
                            followingLeague,
                            season.season(),
                            season.position(),
                            season.standings().size()
                    )
                    : leagueName(exact);
            HistoricalCwlSeason.League league = exact != null
                    ? exact
                    : reconstructed.isBlank()
                            ? season.league()
                            : new HistoricalCwlSeason.League(null, reconstructed);
            HistoricalCwlSeason enriched = withLeague(season, league);
            result.add(enriched);
            if (known(enriched.league(), enriched.season())) {
                followingLeague = leagueName(enriched.league());
            }
        }
        return List.copyOf(result);
    }

    private static String inferStartingLeague(
            String followingLeague,
            String season,
            Integer position,
            int groupSize
    ) {
        if (followingLeague.isBlank()
                || position == null
                || position <= 0
                || groupSize <= 1) {
            return "";
        }
        List<String> matches = leaguesFor(season).stream()
                .filter(candidate -> followingLeague.equals(
                        leagueAfter(candidate, season, position, groupSize)
                ))
                .toList();
        if (matches.contains(followingLeague)) return followingLeague;
        return matches.size() == 1 ? matches.getFirst() : "";
    }

    private static String leagueAfter(
            String league,
            String season,
            int position,
            int groupSize
    ) {
        List<String> leagues = leaguesFor(season);
        int index = leagues.indexOf(league);
        if (index < 0) return "";
        int promoted = Math.min(promotionSlots(league, season), groupSize);
        if (position <= promoted && index + 1 < leagues.size()) {
            return leagues.get(index + 1);
        }
        int baseDemoted = demotionSlots(league);
        int demoted = Math.min(
                baseDemoted,
                Math.max(0, groupSize - (8 - baseDemoted))
        );
        if (demoted > 0 && position > groupSize - demoted && index > 0) {
            return leagues.get(index - 1);
        }
        return league;
    }

    private static int promotionSlots(String league, String season) {
        if (expanded(season)) {
            if (List.of(
                    "Champion League I",
                    "Titan League III",
                    "Titan League II",
                    "Titan League I"
            ).contains(league)) {
                return 4;
            }
            if (List.of(
                    "Master League I",
                    "Champion League III",
                    "Champion League II"
            ).contains(league)) {
                return 2;
            }
            if ("Legend League".equals(league)) return 0;
        }
        if (List.of(
                "Bronze League III",
                "Bronze League II",
                "Bronze League I"
        ).contains(league)) {
            return 3;
        }
        if (List.of(
                "Master League I",
                "Champion League III",
                "Champion League II"
        ).contains(league)) {
            return 1;
        }
        if ("Champion League I".equals(league)) return 0;
        return 2;
    }

    private static int demotionSlots(String league) {
        if ("Bronze League III".equals(league)) return 0;
        if (List.of(
                "Bronze League II",
                "Bronze League I",
                "Silver League III"
        ).contains(league)) {
            return 1;
        }
        return 2;
    }

    private static HistoricalCwlSeason withLeague(
            HistoricalCwlSeason season,
            HistoricalCwlSeason.League league
    ) {
        return new HistoricalCwlSeason(
                season.season(),
                season.clan(),
                league,
                season.position(),
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

    private static boolean known(
            HistoricalCwlSeason.League league,
            String season
    ) {
        return leaguesFor(season).contains(leagueName(league));
    }

    private static String leagueName(HistoricalCwlSeason.League league) {
        return league == null || league.name() == null
                ? ""
                : league.name().trim();
    }

    private static List<String> leaguesFor(String season) {
        return expanded(season) ? EXPANDED_LEAGUES : ORIGINAL_LEAGUES;
    }

    private static boolean expanded(String season) {
        return season != null && season.compareTo(EXPANSION_SEASON) >= 0;
    }
}

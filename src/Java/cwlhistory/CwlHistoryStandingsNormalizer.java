package Java.cwlhistory;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Builds CWL standings from explicit ranking rows or documented V2 war data. */
final class CwlHistoryStandingsNormalizer {
    private CwlHistoryStandingsNormalizer() {}

    static List<HistoricalCwlSeason.Standing> normalize(
            JsonObject group,
            JsonObject warSource
    ) {
        JsonArray rows = CwlHistoryJson.array(
                group, "clan_rankings", "clanRankings", "standings", "rankings"
        );
        if (rows != null) return fromRows(rows);
        JsonArray groupWars = CwlHistoryWarNormalizer.warItems(group);
        JsonObject source = groupWars != null && !groupWars.isEmpty()
                ? group : warSource;
        return fromWars(group, source);
    }

    private static List<HistoricalCwlSeason.Standing> fromRows(JsonArray rows) {
        List<StandingCandidate> candidates = new ArrayList<>();
        for (JsonElement item : rows) {
            if (item.isJsonObject()) candidates.add(candidate(item.getAsJsonObject()));
        }
        candidates.sort(Comparator
                .comparingInt(StandingCandidate::stars).reversed()
                .thenComparing(StandingCandidate::destruction, Comparator.reverseOrder()));
        return rankCandidates(candidates);
    }

    private static StandingCandidate candidate(JsonObject row) {
        JsonObject rounds = CwlHistoryJson.object(row, "rounds", "record");
        return new StandingCandidate(
                CwlHistoryJson.integer(row, 0, "rank", "groupRank", "position"),
                CwlHistoryJson.tag(CwlHistoryJson.string(row, "tag", "clanTag")),
                CwlHistoryJson.string(row, "name", "clanName"),
                value(row, rounds, "wins", "won"),
                value(row, rounds, "losses", "lost"),
                value(row, rounds, "ties", "tied", "draws"),
                CwlHistoryJson.integer(row, 0, "stars"),
                CwlHistoryJson.decimal(row, 0, "destruction", "destructionPercentage")
        );
    }

    private static int value(JsonObject row, JsonObject rounds, String... names) {
        int nested = CwlHistoryJson.integer(rounds, 0, names);
        return CwlHistoryJson.integer(row, nested, names);
    }

    private static List<HistoricalCwlSeason.Standing> rankCandidates(
            List<StandingCandidate> candidates
    ) {
        List<HistoricalCwlSeason.Standing> result = new ArrayList<>();
        for (int index = 0; index < candidates.size(); index++) {
            StandingCandidate row = candidates.get(index);
            result.add(new HistoricalCwlSeason.Standing(
                    row.rank() > 0 ? row.rank() : index + 1,
                    row.tag(), row.name(), row.wins(), row.losses(), row.draws(),
                    row.stars(), row.destruction()
            ));
        }
        result.sort(Comparator.comparingInt(HistoricalCwlSeason.Standing::rank));
        return List.copyOf(result);
    }

    private static List<HistoricalCwlSeason.Standing> fromWars(
            JsonObject group,
            JsonObject warSource
    ) {
        Map<String, StandingAccumulator> scores = clanScores(group);
        JsonArray wars = CwlHistoryWarNormalizer.warItems(warSource);
        if (wars == null) return List.of();
        Set<String> seenWars = new HashSet<>();
        for (JsonElement item : wars) {
            if (item.isJsonObject()) accumulateWar(scores, seenWars, item.getAsJsonObject());
        }
        return rankScores(scores);
    }

    private static Map<String, StandingAccumulator> clanScores(JsonObject group) {
        Map<String, StandingAccumulator> scores = new LinkedHashMap<>();
        JsonArray clans = CwlHistoryJson.array(group, "clans");
        if (clans == null) return scores;
        for (JsonElement item : clans) {
            if (!item.isJsonObject()) continue;
            JsonObject clan = item.getAsJsonObject();
            String tag = CwlHistoryJson.tag(CwlHistoryJson.string(clan, "tag", "clanTag"));
            if (!tag.isBlank()) scores.put(tag, score(tag, clan));
        }
        return scores;
    }

    private static void accumulateWar(
            Map<String, StandingAccumulator> scores,
            Set<String> seenWars,
            JsonObject war
    ) {
        if (!completed(CwlHistoryJson.string(war, "state", "status"))) return;
        String id = CwlHistoryJson.string(war, "tag", "warTag", "id", "_warTag");
        if (!id.isBlank() && !seenWars.add(id)) return;
        JsonObject first = CwlHistoryJson.object(war, "clan");
        JsonObject second = CwlHistoryJson.object(war, "opponent");
        if (first == null || second == null) return;
        StandingAccumulator firstScore = score(scores, first);
        StandingAccumulator secondScore = score(scores, second);
        if (firstScore == null || secondScore == null) return;
        applyResult(firstScore, secondScore, first, second);
    }

    private static void applyResult(
            StandingAccumulator firstScore,
            StandingAccumulator secondScore,
            JsonObject first,
            JsonObject second
    ) {
        int firstStars = CwlHistoryJson.integer(first, 0, "stars");
        int secondStars = CwlHistoryJson.integer(second, 0, "stars");
        double firstDestruction = destruction(first);
        double secondDestruction = destruction(second);
        firstScore.add(firstStars, firstDestruction);
        secondScore.add(secondStars, secondDestruction);
        int result = Integer.compare(firstStars, secondStars);
        if (result == 0) result = Double.compare(firstDestruction, secondDestruction);
        if (result > 0) firstScore.winAgainst(secondScore);
        else if (result < 0) secondScore.winAgainst(firstScore);
        else firstScore.drawWith(secondScore);
    }

    private static double destruction(JsonObject side) {
        return CwlHistoryJson.decimal(
                side, 0, "destructionPercentage", "destruction"
        );
    }

    private static StandingAccumulator score(
            Map<String, StandingAccumulator> scores,
            JsonObject side
    ) {
        String tag = CwlHistoryJson.tag(CwlHistoryJson.string(side, "tag", "clanTag"));
        if (tag.isBlank()) return null;
        return scores.computeIfAbsent(tag, ignored -> score(tag, side));
    }

    private static StandingAccumulator score(String tag, JsonObject side) {
        return new StandingAccumulator(
                tag,
                CwlHistoryJson.string(side, "name", "clanName")
        );
    }

    private static List<HistoricalCwlSeason.Standing> rankScores(
            Map<String, StandingAccumulator> scores
    ) {
        List<StandingAccumulator> ranked = scores.values().stream()
                .filter(StandingAccumulator::participated)
                .sorted(Comparator.comparingInt(StandingAccumulator::stars).reversed()
                        .thenComparing(StandingAccumulator::destruction, Comparator.reverseOrder())
                        .thenComparing(StandingAccumulator::tag))
                .toList();
        List<HistoricalCwlSeason.Standing> result = new ArrayList<>();
        for (int index = 0; index < ranked.size(); index++) {
            result.add(ranked.get(index).standing(index + 1));
        }
        return List.copyOf(result);
    }

    private static boolean completed(String state) {
        return switch (String.valueOf(state).trim().toLowerCase()) {
            case "ended", "warended", "complete", "completed" -> true;
            default -> false;
        };
    }

    private record StandingCandidate(
            int rank, String tag, String name, int wins, int losses,
            int draws, int stars, Double destruction
    ) {}

    private static final class StandingAccumulator {
        private final String tag;
        private final String name;
        private int wins;
        private int losses;
        private int draws;
        private int stars;
        private double destruction;

        private StandingAccumulator(String tag, String name) {
            this.tag = tag;
            this.name = name;
        }

        private void add(int addedStars, double addedDestruction) {
            stars += addedStars;
            destruction += addedDestruction;
        }

        private void winAgainst(StandingAccumulator opponent) {
            wins += 1;
            stars += 10;
            opponent.losses += 1;
        }

        private void drawWith(StandingAccumulator opponent) {
            draws += 1;
            opponent.draws += 1;
        }

        private boolean participated() {
            return wins + losses + draws > 0;
        }

        private HistoricalCwlSeason.Standing standing(int rank) {
            return new HistoricalCwlSeason.Standing(
                    rank, tag, name, wins, losses, draws, stars, destruction
            );
        }

        private String tag() { return tag; }
        private int stars() { return stars; }
        private Double destruction() { return destruction; }
    }
}

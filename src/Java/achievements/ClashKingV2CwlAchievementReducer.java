package Java.achievements;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Comparator;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.time.YearMonth;

import static Java.achievements.ClashKingV2AchievementJson.array;
import static Java.achievements.ClashKingV2AchievementJson.object;
import static Java.achievements.ClashKingV2AchievementJson.tag;
import static Java.achievements.ClashKingV2AchievementJson.text;
import static Java.achievements.ClashKingV2AchievementJson.whole;

/** Reduces the documented player CWL-history envelope to achievement metrics. */
final class ClashKingV2CwlAchievementReducer {
    private static final List<String> ZERO_KEYS = List.of(
            "cwl_seasons_played", "cwl_wars_played", "cwl_rounds", "cwl_attacks", "cwl_stars",
            "cwl_three_stars", "cwl_two_stars", "cwl_one_stars", "cwl_zero_stars",
            "cwl_destruction_total", "cwl_destruction_average", "cwl_average_stars",
            "cwl_average_destruction", "cwl_triple_rate", "cwl_uphit_rate", "cwl_same_th_attacks",
            "cwl_uphit_attacks", "cwl_plus_two_attacks", "cwl_uphit_three_stars", "cwl_95_attacks",
            "cwl_99_attacks", "cwl_perfect_attacks",
            "cwl_missed_attacks", "cwl_full_seasons", "cwl_no_miss_seasons", "cwl_perfect_seasons",
            "cwl_no_miss_rate", "cwl_season_wins", "cwl_season_losses", "cwl_season_ties",
            "cwl_clan_wins", "cwl_top3_finishes", "cwl_clans", "cwl_multi_clan_seasons"
    );

    private ClashKingV2CwlAchievementReducer() {}

    static Map<String, Long> reduce(
            ClashKingV2WarAchievementProvider.SourceData source,
            String requestedTag
    ) {
        if (source == null || !source.available()) return Map.of();
        if (source.items().isEmpty()) {
            Map<String, Long> result = zeroMetrics();
            result.putAll(ClashKingV2CwlAdvancedReducer.reduce(source, requestedTag));
            return Map.copyOf(result);
        }
        Accumulator totals = new Accumulator();
        for (JsonObject season : orderedSeasons(source.items())) readSeason(season, totals);
        Map<String, Long> result = new LinkedHashMap<>(totals.metrics());
        result.putAll(ClashKingV2CwlAdvancedReducer.reduce(source, requestedTag));
        return Map.copyOf(result);
    }

    private static List<JsonObject> orderedSeasons(List<JsonObject> rows) {
        return rows.stream()
                .sorted(Comparator.comparing(
                        (JsonObject season) -> seasonOrder(text(season, "season")),
                        Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(season -> text(season, "season")))
                .toList();
    }

    private static YearMonth seasonOrder(String value) {
        try {
            return YearMonth.parse(value.trim());
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private static void readSeason(JsonObject season, Accumulator totals) {
        if (season == null || text(season, "season").isBlank()) return;
        String seasonKey = text(season, "season").trim();
        if (totals.seasonsSeen.add(seasonKey)) totals.seasons++;
        JsonObject clan = object(season, "clan");
        String clanTag = tag(clan, "tag");
        if (!clanTag.isBlank()) {
            totals.clans.add(clanTag);
            totals.seasonClans.computeIfAbsent(seasonKey, ignored -> new HashSet<>()).add(clanTag);
        }

        int ownTownHall = integer(season, "townHallLevel");
        ClashKingV2CwlSeasonValues values = new ClashKingV2CwlSeasonValues();
        JsonArray attacks = array(season, "attacks");
        for (JsonObject attack : orderedAttacks(attacks)) {
            values.add(attack, ownTownHall, totals.warsSeen, seasonKey);
        }
        totals.merge(values);
        totals.addSeasonResult(season, values);
    }

    private static List<JsonObject> orderedAttacks(JsonArray rows) {
        List<JsonObject> result = new ArrayList<>();
        if (rows != null) for (JsonElement row : rows) {
            if (row != null && row.isJsonObject()) result.add(row.getAsJsonObject());
        }
        result.sort(Comparator.comparing(
                        (JsonObject attack) -> whole(attack, "order", "attackOrder", "round"),
                        Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(attack -> text(attack, "order")));
        return result;
    }

    private static int integer(JsonObject object, String field) {
        Long value = whole(object, field);
        return value == null || value < 0 || value > Integer.MAX_VALUE ? 0 : value.intValue();
    }

    private static final class Accumulator {
        long seasons;
        long wars;
        long attacks;
        long stars;
        long triples;
        long twos;
        long ones;
        long zeros;
        long destruction;
        long destructionSamples;
        long same;
        long uphit;
        long plusTwo;
        long uphitTriples;
        long over95;
        long over99;
        long perfectAttacks;
        long missed;
        long fullSeasons;
        long noMissSeasons;
        long perfectSeasons;
        long eligibleSeasons;
        long missedSamples;
        long resultSamples;
        long placementSamples;
        long clanWins;
        long seasonWins;
        long seasonLosses;
        long seasonTies;
        long top3;
        final Set<String> clans = new HashSet<>();
        final Set<String> seasonsSeen = new HashSet<>();
        final Map<String, Set<String>> seasonClans = new HashMap<>();
        final Set<String> warsSeen = new HashSet<>();

        void merge(ClashKingV2CwlSeasonValues values) {
            attacks += values.attacks;
            stars += values.stars;
            triples += values.triples;
            twos += values.twos;
            ones += values.ones;
            zeros += values.zeros;
            destruction += values.destruction;
            destructionSamples += values.destructionSamples;
            same += values.same;
            uphit += values.uphit;
            plusTwo += values.plusTwo;
            uphitTriples += values.uphitTriples;
            over95 += values.over95;
            over99 += values.over99;
            perfectAttacks += values.perfectAttacks;
        }

        void addSeasonResult(JsonObject season, ClashKingV2CwlSeasonValues values) {
            Long missedValue = whole(season, "missedAttacks");
            if (missedValue != null) {
                missedSamples++;
                missed += Math.max(0, missedValue);
            }
            JsonObject clan = object(season, "clan");
            JsonObject warsResult = object(clan, "wars");
            long expected = sumNonNegative(warsResult, "won", "lost", "tied");
            if (warsResult != null) resultSamples++;
            if (expected >= 7) {
                eligibleSeasons++;
                if (expected >= 7 && values.attacks >= expected) fullSeasons++;
                if (missedValue != null && missedValue == 0) noMissSeasons++;
                if (values.attacks == 7 && values.stars == 21 && values.allPerfect) {
                    perfectSeasons++;
                }
            }
            seasonWins += nonNegative(warsResult, "won");
            seasonLosses += nonNegative(warsResult, "lost");
            seasonTies += nonNegative(warsResult, "tied");
            clanWins += nonNegative(warsResult, "won");
            JsonObject placement = object(season, "placement");
            Long global = whole(placement, "global");
            if (global != null) placementSamples++;
            if (global != null && global > 0 && global <= 3) top3++;
        }

        Map<String, Long> metrics() {
            Map<String, Long> result = new LinkedHashMap<>();
            put(result, "cwl_seasons_played", seasons);
            long uniqueWars = warsSeen.size();
            put(result, "cwl_wars_played", uniqueWars);
            put(result, "cwl_rounds", uniqueWars);
            put(result, "cwl_attacks", attacks);
            put(result, "cwl_stars", stars);
            put(result, "cwl_three_stars", triples);
            put(result, "cwl_two_stars", twos);
            put(result, "cwl_one_stars", ones);
            put(result, "cwl_zero_stars", zeros);
            put(result, "cwl_destruction_total", destruction, destructionSamples > 0);
            put(result, "cwl_destruction_average", average(destruction, destructionSamples), destructionSamples > 0);
            put(result, "cwl_average_stars", average(stars * 100, attacks), attacks > 0);
            put(result, "cwl_average_destruction", average(destruction, destructionSamples), destructionSamples > 0);
            put(result, "cwl_triple_rate", rate(triples, attacks), attacks > 0);
            put(result, "cwl_uphit_rate", rate(uphit, attacks), attacks > 0);
            put(result, "cwl_same_th_attacks", same);
            put(result, "cwl_uphit_attacks", uphit);
            put(result, "cwl_plus_two_attacks", plusTwo);
            put(result, "cwl_uphit_three_stars", uphitTriples);
            put(result, "cwl_95_attacks", over95);
            put(result, "cwl_99_attacks", over99);
            put(result, "cwl_perfect_attacks", perfectAttacks);
            put(result, "cwl_missed_attacks", missed, missedSamples > 0);
            put(result, "cwl_full_seasons", fullSeasons, eligibleSeasons > 0);
            put(result, "cwl_no_miss_seasons", noMissSeasons, eligibleSeasons > 0);
            put(result, "cwl_perfect_seasons", perfectSeasons, eligibleSeasons > 0);
            put(result, "cwl_no_miss_rate", rate(noMissSeasons, eligibleSeasons), eligibleSeasons > 0);
            put(result, "cwl_season_wins", seasonWins, resultSamples > 0);
            put(result, "cwl_season_losses", seasonLosses, resultSamples > 0);
            put(result, "cwl_season_ties", seasonTies, resultSamples > 0);
            put(result, "cwl_clan_wins", clanWins, resultSamples > 0);
            put(result, "cwl_top3_finishes", top3, placementSamples > 0);
            put(result, "cwl_clans", clans.size(), !clans.isEmpty());
            put(result, "cwl_multi_clan_seasons", multiClanSeasons(), !seasonClans.isEmpty());
            return Map.copyOf(result);
        }

        private long multiClanSeasons() {
            return seasonClans.values().stream().filter(tags -> tags.size() > 1).count();
        }
    }

    private static Map<String, Long> zeroMetrics() {
        Map<String, Long> result = new LinkedHashMap<>();
        for (String key : ZERO_KEYS) result.put(key, 0L);
        return result;
    }

    private static long nonNegative(JsonObject object, String field) {
        Long value = whole(object, field);
        return value == null ? 0 : Math.max(0, value);
    }

    private static long sumNonNegative(JsonObject object, String... fields) {
        long result = 0;
        for (String field : fields) result += nonNegative(object, field);
        return result;
    }

    private static void put(Map<String, Long> result, String key, long value) {
        put(result, key, value, true);
    }

    private static void put(Map<String, Long> result, String key, long value, boolean measurable) {
        if (measurable) result.put(key, Math.max(0, value));
    }

    private static long average(long total, long samples) {
        return samples <= 0 ? 0 : Math.round((double) total / samples);
    }

    private static long rate(long numerator, long denominator) {
        return denominator <= 0 ? 0 : Math.round(10000d * numerator / denominator);
    }
}

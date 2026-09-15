package Java.achievements;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.time.YearMonth;

import static Java.achievements.ClashKingV2AchievementJson.array;
import static Java.achievements.ClashKingV2AchievementJson.object;
import static Java.achievements.ClashKingV2AchievementJson.text;
import static Java.achievements.ClashKingV2AchievementJson.whole;

/** Adds family-specific CWL streak, threshold and matchup metrics. */
final class ClashKingV2CwlAdvancedReducer {
    private static final List<String> ZERO_KEYS = List.of(
            "cwl_same_th_triples", "cwl_plus_two_triples", "cwl_perfect_21", "cwl_no_miss_streak",
            "cwl_average_stars_20", "cwl_triple_rate_20", "cwl_full_seasons_7", "cwl_clean_seasons",
            "cwl_multi_clan", "cwl_no_miss_season_streak", "cwl_comeback"
    );

    private ClashKingV2CwlAdvancedReducer() {}

    static Map<String, Long> reduce(
            ClashKingV2WarAchievementProvider.SourceData source,
            String requestedTag
    ) {
        if (source == null || !source.available()) return Map.of();
        if (source.items().isEmpty()) return zeroMetrics();
        Totals totals = new Totals();
        for (JsonObject season : orderedSeasons(source.items())) readSeason(season, totals);
        return totals.metrics();
    }

    private static List<JsonObject> orderedSeasons(List<JsonObject> rows) {
        return rows.stream()
                .sorted(java.util.Comparator.comparing(
                        (JsonObject season) -> seasonOrder(text(season, "season")),
                        java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder()))
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

    private static void readSeason(JsonObject season, Totals totals) {
        String seasonKey = text(season, "season").trim();
        if (seasonKey.isBlank()) return;
        JsonArray attacks = array(season, "attacks");
        SeasonState state = new SeasonState(seasonKey, integer(season, "townHallLevel"));
        for (JsonObject attack : orderedAttacks(attacks)) state.add(attack);
        JsonObject wars = object(object(season, "clan"), "wars");
        long expected = sum(wars, "won", "lost", "tied");
        Long missed = whole(season, "missedAttacks");
        state.finish(expected, missed);
        totals.merge(state, clanTag(season));
    }

    private static List<JsonObject> orderedAttacks(JsonArray rows) {
        List<JsonObject> result = new ArrayList<>();
        if (rows != null) for (JsonElement row : rows) {
            if (row != null && row.isJsonObject()) result.add(row.getAsJsonObject());
        }
        result.sort(java.util.Comparator.comparing(
                        (JsonObject attack) -> whole(attack, "order", "attackOrder", "round"),
                        java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder()))
                .thenComparing(attack -> text(attack, "order")));
        return result;
    }

    private static String clanTag(JsonObject season) {
        return ClashKingV2AchievementJson.tag(object(season, "clan"), "tag");
    }

    private static void forEach(JsonArray rows, java.util.function.Consumer<JsonObject> consumer) {
        if (rows == null) return;
        for (JsonElement row : rows) {
            if (row != null && row.isJsonObject()) consumer.accept(row.getAsJsonObject());
        }
    }

    private static long sum(JsonObject object, String... fields) {
        long result = 0;
        for (String field : fields) {
            Long value = whole(object, field);
            if (value != null) result += Math.max(0, value);
        }
        return result;
    }

    private static final class Totals {
        long attacks;
        long stars;
        long triples;
        long sameThTriples;
        long plusTwoTriples;
        long perfect21;
        long comeback;
        long fullSeasons7;
        long cleanSeasons;
        long eligibleSeasons;
        long missedSeasons;
        final Set<String> clans = new HashSet<>();
        final List<SeasonState> seasons = new ArrayList<>();

        void merge(SeasonState state, String clanTag) {
            attacks += state.attacks;
            stars += state.stars;
            triples += state.triples;
            sameThTriples += state.sameThTriples;
            plusTwoTriples += state.plusTwoTriples;
            perfect21 += state.perfect21 ? 1 : 0;
            comeback += state.comeback;
            if (state.eligible) eligibleSeasons++;
            if (state.full7) fullSeasons7++;
            if (state.clean) cleanSeasons++;
            if (state.missed) missedSeasons++;
            if (!clanTag.isBlank()) clans.add(clanTag);
            seasons.add(state);
        }

        Map<String, Long> metrics() {
            Map<String, Long> result = new LinkedHashMap<>();
            put(result, "cwl_same_th_triples", sameThTriples);
            put(result, "cwl_plus_two_triples", plusTwoTriples);
            put(result, "cwl_perfect_21", perfect21);
            put(result, "cwl_no_miss_streak", streak(false));
            put(result, "cwl_average_stars_20", average(stars * 100, attacks), attacks >= 20);
            put(result, "cwl_triple_rate_20", rate(triples, attacks), attacks >= 20);
            put(result, "cwl_full_seasons_7", fullSeasons7);
            put(result, "cwl_clean_seasons", cleanSeasons);
            put(result, "cwl_multi_clan", clans.size());
            put(result, "cwl_no_miss_season_streak", streak(true));
            put(result, "cwl_comeback", comeback);
            return Map.copyOf(result);
        }

        private long streak(boolean ignored) {
            Map<String, Boolean> ordered = new TreeMap<>();
            for (SeasonState state : seasons) {
                boolean matches = state.eligible && state.noMiss;
                ordered.merge(state.season, matches, (first, second) -> first && second);
            }
            long current = 0;
            long best = 0;
            for (boolean matches : ordered.values()) {
                current = matches ? current + 1 : 0;
                best = Math.max(best, current);
            }
            return best;
        }
    }

    private static final class SeasonState {
        final String season;
        final int ownTownHall;
        long attacks;
        long stars;
        long triples;
        long sameThTriples;
        long plusTwoTriples;
        long comeback;
        Integer previousStars;
        long zeroStars;
        boolean allPerfect = true;
        boolean eligible;
        boolean noMiss;
        boolean missed;
        boolean full7;
        boolean clean;

        SeasonState(String season, int ownTownHall) {
            this.season = season;
            this.ownTownHall = ownTownHall;
        }

        void add(JsonObject attack) {
            attacks++;
            Long value = whole(attack, "stars");
            int star = value == null ? -1 : Math.max(0, Math.min(3, value.intValue()));
            if (star < 0) allPerfect = false;
            if (star >= 0) {
                stars += star;
                if (star == 3) triples++;
                if (star == 0) zeroStars++;
                if (previousStars != null && previousStars <= 1 && star == 3) comeback++;
                previousStars = star;
            } else {
                previousStars = null;
            }
            Double destruction = ClashKingV2AchievementJson.decimal(attack, "destructionPercentage");
            boolean perfect = star == 3 && destruction != null && destruction >= 100;
            allPerfect &= perfect;
            JsonObject defender = object(attack, "defender");
            int own = ownTownHall;
            int target = integer(defender, "townHallLevel", "townhallLevel");
            if (star == 3 && own > 0 && target == own) sameThTriples++;
            if (star == 3 && own > 0 && target >= own + 2) plusTwoTriples++;
        }

        void finish(long expected, Long missedValue) {
            eligible = expected >= 7;
            noMiss = missedValue != null && missedValue == 0;
            missed = missedValue != null && missedValue > 0;
            full7 = eligible && attacks >= expected;
            clean = eligible && noMiss && attacks >= expected && attacks >= 5
                    && zeroStars == 0 && stars * 2 >= attacks * 5;
            if (expected >= 7 && attacks == 7 && stars == 21) perfect21 = true;
        }

        boolean perfect21;

    }

    private static int integer(JsonObject object, String... fields) {
        Long value = whole(object, fields);
        return value == null || value < 0 || value > Integer.MAX_VALUE ? 0 : value.intValue();
    }

    private static void put(Map<String, Long> result, String key, long value) {
        result.put(key, Math.max(0, value));
    }

    private static void put(Map<String, Long> result, String key, long value, boolean measurable) {
        if (measurable) put(result, key, value);
    }

    private static Map<String, Long> zeroMetrics() {
        Map<String, Long> result = new LinkedHashMap<>();
        for (String key : ZERO_KEYS) result.put(key, 0L);
        return result;
    }

    private static long average(long total, long samples) {
        return samples <= 0 ? 0 : Math.round((double) total / samples);
    }

    private static long rate(long numerator, long denominator) {
        return denominator <= 0 ? 0 : Math.round(10000d * numerator / denominator);
    }
}

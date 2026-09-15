package Java.achievements;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import static Java.achievements.ClashKingV2AchievementJson.array;
import static Java.achievements.ClashKingV2AchievementJson.bool;
import static Java.achievements.ClashKingV2AchievementJson.decimal;
import static Java.achievements.ClashKingV2AchievementJson.object;
import static Java.achievements.ClashKingV2AchievementJson.tag;
import static Java.achievements.ClashKingV2AchievementJson.text;
import static Java.achievements.ClashKingV2AchievementJson.whole;

/** Reduces the documented random-war V2 envelope to achievement metrics. */
final class ClashKingV2WarAchievementReducer {
    private static final List<String> ZERO_KEYS = List.of(
            "war_wars", "war_attacks", "war_stars", "war_three_stars", "war_two_stars",
            "war_one_stars", "war_zero_stars", "war_destruction_total", "war_destruction_average",
            "war_attack_rate", "war_fresh_attacks", "war_cleanup_attacks", "war_same_th_attacks",
            "war_uphit_attacks", "war_plus_two_attacks", "war_95_attacks", "war_99_attacks",
            "war_perfect_attacks", "war_full_wars", "war_no_miss_wars", "war_missed_attacks",
            "war_wins", "war_losses", "war_ties", "war_current_win_streak", "war_best_win_streak",
            "war_uphit_three_stars", "def_attacks", "def_stars", "def_three_stars", "def_two_stars",
            "def_one_stars", "def_zero_stars", "def_destruction_total", "def_destruction_average",
            "def_fresh_attacks", "def_cleanup_attacks", "def_95_attacks", "def_99_attacks",
            "def_perfect_attacks", "war_recorded_wars", "war_recorded_attacks", "war_recorded_stars",
            "war_recorded_destruction", "war_recorded_three_stars", "war_recorded_two_stars",
            "war_recorded_uphit_three_stars"
    );

    private ClashKingV2WarAchievementReducer() {}

    static Map<String, Long> reduce(
            ClashKingV2WarAchievementProvider.SourceData source,
            String requestedTag
    ) {
        if (source == null || !source.available()) return Map.of();
        if (source.items().isEmpty()) {
            Map<String, Long> result = zeroMetrics();
            result.putAll(ClashKingV2WarAdvancedReducer.reduce(source, requestedTag));
            return Map.copyOf(result);
        }
        Accumulator totals = new Accumulator();
        String tag = ClashKingV2WarAchievementProvider.normalizedTag(requestedTag);
        for (JsonObject war : orderedWars(source.items())) readWar(war, tag, totals);
        Map<String, Long> result = new LinkedHashMap<>(totals.metrics());
        result.putAll(ClashKingV2WarAdvancedReducer.reduce(source, tag));
        return Map.copyOf(result);
    }

    private static void readWar(JsonObject war, String requestedTag, Accumulator totals) {
        if (war == null) return;
        JsonObject player = object(war, "player");
        String playerTag = tag(player, "tag");
        if (player == null || !playerTag.isBlank() && !playerTag.equals(requestedTag)) return;
        totals.wars++;
        int ownTownHall = integer(player, "townhallLevel");
        JsonArray attacks = array(war, "attacks");
        JsonArray defenses = array(war, "defenses");
        forEach(attacks, attack -> totals.addAttack(attack, ownTownHall, false));
        forEach(defenses, defense -> totals.addAttack(defense, 0, true));
        totals.addWarCapacity(war, attacks == null ? 0 : attacks.size());
        totals.addOutcome(war);
    }
    private static void forEach(JsonArray rows, java.util.function.Consumer<JsonObject> consumer) {
        if (rows == null) return;
        for (JsonElement row : rows) {
            if (row != null && row.isJsonObject()) consumer.accept(row.getAsJsonObject());
        }
    }
    private static List<JsonObject> orderedWars(List<JsonObject> rows) {
        return rows.stream()
                .sorted(Comparator.comparing(
                                (JsonObject war) -> ClashKingV2WarAchievementSupport.timestamp(text(war, "endTime")),
                                Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(war -> text(war, "endTime")))
                .toList();
    }

    private static int integer(JsonObject object, String field) {
        Long value = whole(object, field);
        return value == null || value < 0 || value > Integer.MAX_VALUE ? 0 : value.intValue();
    }

    private static final class Accumulator {
        long wars, attacks, stars, triples, twos, ones, zeros;
        long destruction;
        long destructionSamples;
        long fresh, cleanup, same, uphit, plusTwo, over95, over99, perfect;
        long expected, missed, full, noMiss;
        long defAttacks;
        long defStars;
        long defTriples;
        long defTwos;
        long defOnes;
        long defZeros;
        long defDestruction;
        long defDestructionSamples;
        long defFresh, defCleanup, defOver95, defOver99, defPerfect;
        long wins, losses, ties;
        final List<ClashKingV2WarAchievementSupport.Outcome> outcomes = new ArrayList<>();

        void addAttack(JsonObject attack, int ownTownHall, boolean defense) {
            Long starValue = whole(attack, "stars");
            Double destructionValue = decimal(attack, "destructionPercentage");
            int star = starValue == null ? -1 : Math.max(0, Math.min(3, starValue.intValue()));
            Boolean isFresh = bool(attack, "fresh");
            if (defense) {
                defAttacks++;
                addDefensive(star, destructionValue, isFresh);
                return;
            }
            attacks++;
            addOffensive(star, destructionValue, isFresh, ownTownHall, attack);
        }
        void addOffensive(
                int star, Double destructionValue, Boolean isFresh,
                int ownTownHall, JsonObject attack
        ) {
            addStars(star, false);
            if (destructionValue != null) {
                destruction += scaled(destructionValue);
                destructionSamples++;
                if (destructionValue >= 95) over95++;
                if (destructionValue >= 99) over99++;
            }
            if (star == 3 && destructionValue != null && destructionValue >= 100) perfect++;
            if (Boolean.TRUE.equals(isFresh)) fresh++;
            if (Boolean.FALSE.equals(isFresh)) cleanup++;
            addTownHallRelation(ownTownHall, object(attack, "player"), star == 3);
        }
        void addDefensive(int star, Double destructionValue, Boolean isFresh) {
            addStars(star, true);
            if (destructionValue != null) {
                defDestruction += scaled(destructionValue);
                defDestructionSamples++;
                if (destructionValue >= 95) defOver95++;
                if (destructionValue >= 99) defOver99++;
            }
            if (star == 3 && destructionValue != null && destructionValue >= 100) defPerfect++;
            if (Boolean.TRUE.equals(isFresh)) defFresh++;
            if (Boolean.FALSE.equals(isFresh)) defCleanup++;
        }
        void addStars(int star, boolean defense) {
            if (star < 0) return;
            if (defense) {
                defStars += star;
                if (star == 3) defTriples++;
                if (star == 2) defTwos++;
                if (star == 1) defOnes++;
                if (star == 0) defZeros++;
                return;
            }
            stars += star;
            if (star == 3) triples++;
            if (star == 2) twos++;
            if (star == 1) ones++;
            if (star == 0) zeros++;
        }
        void addTownHallRelation(int ownTownHall, JsonObject opponent, boolean triple) {
            int defenderTownHall = integer(opponent, "townhallLevel");
            if (ownTownHall <= 0 || defenderTownHall <= 0) return;
            if (defenderTownHall == ownTownHall) same++;
            if (defenderTownHall > ownTownHall) uphit++;
            if (defenderTownHall >= ownTownHall + 2) plusTwo++;
            if (triple && defenderTownHall > ownTownHall) uphitThree++;
        }

        long uphitThree;

        void addWarCapacity(JsonObject war, int used) {
            int attacksPerMember = integer(war, "attacksPerMember");
            if (attacksPerMember <= 0) return;
            long capacity = attacksPerMember;
            expected += capacity;
            missed += Math.max(0, capacity - used);
            if (used == capacity) full++;
            if (used == capacity) noMiss++;
        }
        void addOutcome(JsonObject war) {
            JsonObject clan = object(war, "clan");
            JsonObject opponent = object(war, "opponent");
            Double ownStars = decimal(clan, "stars");
            Double enemyStars = decimal(opponent, "stars");
            Double ownDestruction = decimal(clan, "destructionPercentage");
            Double enemyDestruction = decimal(opponent, "destructionPercentage");
            if (ownStars == null || enemyStars == null) return;
            int result = Double.compare(ownStars, enemyStars);
            if (result == 0 && ownDestruction != null && enemyDestruction != null) {
                result = Double.compare(ownDestruction, enemyDestruction);
            }
            if (result > 0) wins++;
            if (result < 0) losses++;
            if (result == 0) ties++;
            outcomes.add(new ClashKingV2WarAchievementSupport.Outcome(
                    result,
                    ClashKingV2WarAchievementSupport.timestamp(text(war, "endTime")),
                    outcomes.size()
            ));
        }
        Map<String, Long> metrics() {
            Map<String, Long> result = new LinkedHashMap<>();
            put(result, "war_wars", wars);
            put(result, "war_attacks", attacks);
            put(result, "war_stars", stars);
            put(result, "war_three_stars", triples);
            put(result, "war_two_stars", twos);
            put(result, "war_one_stars", ones);
            put(result, "war_zero_stars", zeros);
            put(result, "war_destruction_total", destruction, destructionSamples > 0);
            put(result, "war_destruction_average", average(destruction, destructionSamples), destructionSamples > 0);
            put(result, "war_attack_rate", rate(attacks, expected), expected > 0);
            put(result, "war_fresh_attacks", fresh);
            put(result, "war_cleanup_attacks", cleanup);
            put(result, "war_same_th_attacks", same);
            put(result, "war_uphit_attacks", uphit);
            put(result, "war_plus_two_attacks", plusTwo);
            put(result, "war_95_attacks", over95);
            put(result, "war_99_attacks", over99);
            put(result, "war_perfect_attacks", perfect);
            put(result, "war_full_wars", full);
            put(result, "war_no_miss_wars", noMiss);
            put(result, "war_missed_attacks", missed, expected > 0);
            if (!outcomes.isEmpty()) {
                put(result, "war_wins", wins);
                put(result, "war_losses", losses);
                put(result, "war_ties", ties);
                putStreaks(result);
            }
            put(result, "war_uphit_three_stars", uphitThree);
            putDefensive(result);
            put(result, "war_recorded_wars", wars);
            put(result, "war_recorded_attacks", attacks);
            put(result, "war_recorded_stars", stars);
            put(result, "war_recorded_destruction", destruction, destructionSamples > 0);
            put(result, "war_recorded_three_stars", triples);
            put(result, "war_recorded_two_stars", twos);
            put(result, "war_recorded_uphit_three_stars", uphitThree);
            return Map.copyOf(result);
        }
        private void putDefensive(Map<String, Long> result) {
            put(result, "def_attacks", defAttacks);
            put(result, "def_stars", defStars);
            put(result, "def_three_stars", defTriples);
            put(result, "def_two_stars", defTwos);
            put(result, "def_one_stars", defOnes);
            put(result, "def_zero_stars", defZeros);
            put(result, "def_destruction_total", defDestruction, defDestructionSamples > 0);
            put(result, "def_destruction_average", average(defDestruction, defDestructionSamples), defDestructionSamples > 0);
            put(result, "def_fresh_attacks", defFresh);
            put(result, "def_cleanup_attacks", defCleanup);
            put(result, "def_95_attacks", defOver95);
            put(result, "def_99_attacks", defOver99);
            put(result, "def_perfect_attacks", defPerfect);
        }
        private void putStreaks(Map<String, Long> result) {
            ClashKingV2WarAchievementSupport.putStreaks(result, outcomes);
        }
    }

    private static Map<String, Long> zeroMetrics() {
        Map<String, Long> result = new LinkedHashMap<>();
        for (String key : ZERO_KEYS) result.put(key, 0L);
        return result;
    }

    private static void put(Map<String, Long> result, String key, long value) {
        put(result, key, value, true);
    }

    private static void put(Map<String, Long> result, String key, long value, boolean measurable) {
        if (measurable) result.put(key, Math.max(0, value));
    }

    private static long scaled(double percentage) {
        return Math.max(0, Math.round(percentage * 100));
    }

    private static long average(long total, long samples) {
        return samples <= 0 ? 0 : Math.round((double) total / samples);
    }

    private static long rate(long numerator, long denominator) {
        return denominator <= 0 ? 0 : Math.round(10000d * numerator / denominator);
    }

}

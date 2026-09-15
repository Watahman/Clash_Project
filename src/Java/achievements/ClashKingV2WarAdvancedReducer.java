package Java.achievements;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import static Java.achievements.ClashKingV2AchievementJson.array;
import static Java.achievements.ClashKingV2AchievementJson.bool;
import static Java.achievements.ClashKingV2AchievementJson.decimal;
import static Java.achievements.ClashKingV2AchievementJson.object;
import static Java.achievements.ClashKingV2AchievementJson.whole;
/** Adds family-specific regular-war, cleanup, matchup and defense metrics. */
final class ClashKingV2WarAdvancedReducer {
    private static final List<String> ZERO_KEYS = List.of(
            "war_same_th_triples", "war_one_up_triples", "war_plus_two_triples", "war_99_fail", "war_zero_star_avoid",
            "war_two_plus_streak", "war_triple_streak", "war_average_stars", "war_triple_rate",
            "war_average_destruction", "war_fastest_triple_seconds", "war_fresh_triples",
            "war_cleanup_improve", "war_cleanup_triples", "war_first_hit", "war_last_hit",
            "war_map_up", "war_no_miss_streak", "war_perfect_wars_player", "war_all_th_matchups",
            "war_triple_all_matchups", "war_recent_form", "war_improving_form", "war_versatile",
            "def_events", "def_holds", "def_zero_star", "def_one_star", "def_uphit_hold",
            "def_multi_hold", "def_hold_streak", "def_avg_stars", "def_avg_destruction",
            "def_bounce_back"
    );

    private ClashKingV2WarAdvancedReducer() {}
    static Map<String, Long> reduce(
            ClashKingV2WarAchievementProvider.SourceData source,
            String requestedTag
    ) {
        if (source == null || !source.available()) return Map.of();
        if (source.items().isEmpty()) return zeroMetrics();
        Totals totals = new Totals();
        String tag = ClashKingV2WarAchievementProvider.normalizedTag(requestedTag);
        for (JsonObject war : ClashKingV2WarAdvancedJson.orderedWars(source.items())) {
            readWar(war, tag, totals);
        }
        return totals.metrics();
    }

    private static void readWar(JsonObject war, String requestedTag, Totals totals) {
        JsonObject player = object(war, "player");
        String playerTag = ClashKingV2WarAdvancedJson.tag(player);
        if (player == null || !playerTag.isBlank() && !playerTag.equals(requestedTag)) return;
        int ownTownHall = ClashKingV2WarAdvancedJson.integer(player, "townhallLevel");
        int ownMapPosition = ClashKingV2WarAdvancedJson.integer(player, "mapPosition");
        JsonArray attacks = array(war, "attacks");
        List<JsonObject> orderedAttacks = ClashKingV2WarAdvancedJson.orderedAttacks(attacks);
        JsonArray defenses = array(war, "defenses");
        Map<String, ClashKingV2WarAttackValue> previous = new HashMap<>();
        long capacity = ClashKingV2WarAdvancedJson.capacity(war);
        boolean personalPerfect = !orderedAttacks.isEmpty()
                && capacity > 0 && orderedAttacks.size() == capacity;
        for (int index = 0; index < orderedAttacks.size(); index++) {
            JsonObject attack = orderedAttacks.get(index);
            ClashKingV2WarAttackValue current = ClashKingV2WarAdvancedJson.attackValue(attack);
            totals.addAttack(current, attack, ownTownHall, ownMapPosition, index, orderedAttacks.size(), previous);
            personalPerfect &= current.perfect();
            previous.put(ClashKingV2WarAdvancedJson.targetKey(attack), current);
        }
        if (personalPerfect) totals.perfectWarsPlayer++;
        int defenseHolds = 0;
        for (JsonElement value : values(defenses)) {
            JsonObject defense = value.getAsJsonObject();
            int stars = ClashKingV2WarAdvancedJson.integer(defense, "stars", -1);
            Double destruction = decimal(defense, "destructionPercentage");
            int attackerTownHall = ClashKingV2WarAdvancedJson.integer(
                    object(defense, "player"), "townhallLevel"
            );
            totals.addDefense(stars, destruction, bool(defense, "fresh"), ownTownHall, attackerTownHall);
            if (stars >= 0 && stars < 3) defenseHolds++;
        }
        if (defenseHolds >= 2) totals.multiHoldWars++;
        totals.addCapacity(war, attacks == null ? 0 : attacks.size());
    }

    private static List<JsonElement> values(JsonArray values) {
        List<JsonElement> result = new ArrayList<>();
        if (values != null) for (JsonElement value : values) {
            if (value != null && value.isJsonObject()) result.add(value);
        }
        return result;
    }

    private static final class Totals {
        long attacks;
        long starSamples;
        long stars;
        long triples;
        long sameThTriples;
        long oneUpTriples;
        long plusTwoTriples;
        long over99Fail;
        long destructionSamples;
        long destruction;
        long fastestTriple = Long.MAX_VALUE;
        long freshTriples;
        long cleanupImprove;
        long cleanupTriples;
        long firstHit;
        long lastHit;
        long mapUp;
        long perfectWarsPlayer;
        long multiHoldWars;
        long defEvents;
        long defHolds;
        long defZero;
        long defOne;
        long defUphitHold;
        long defDestructionSamples;
        long defDestruction;
        long defStarTotal;
        long defStarSamples;
        final Set<Integer> defenderTownHalls = new HashSet<>();
        final Set<Integer> tripleTownHalls = new HashSet<>();
        final Set<String> tripleTargets = new HashSet<>();
        final List<Integer> attackStars = new ArrayList<>();
        final List<Integer> defenseStars = new ArrayList<>();
        final List<Boolean> noMiss = new ArrayList<>();

        void addAttack(
                ClashKingV2WarAttackValue value, JsonObject attack,
                int ownTownHall, int ownMapPosition, int index, int total,
                Map<String, ClashKingV2WarAttackValue> previous
        ) {
            attacks++;
            if (value.stars() >= 0) {
                starSamples++;
                stars += value.stars();
                attackStars.add(value.stars());
                if (value.stars() == 3) triples++;
            }
            if (value.destruction() != null) {
                destructionSamples++;
                destruction += ClashKingV2WarAdvancedSupport.scaled(value.destruction());
                if (value.destruction() == 99 && value.stars() < 3) over99Fail++;
            }
            JsonObject target = object(attack, "player");
            int defenderTownHall = ClashKingV2WarAdvancedJson.integer(target, "townhallLevel");
            if (defenderTownHall > 0) {
                defenderTownHalls.add(defenderTownHall);
                if (value.stars() == 3) tripleTownHalls.add(defenderTownHall);
                if (value.stars() == 3 && ownTownHall == defenderTownHall) sameThTriples++;
                if (value.stars() == 3 && defenderTownHall == ownTownHall + 1) oneUpTriples++;
                if (value.stars() == 3 && defenderTownHall >= ownTownHall + 2) plusTwoTriples++;
            }
            String targetKey = ClashKingV2WarAdvancedJson.targetKey(attack);
            if (value.stars() == 3 && !targetKey.isBlank()) tripleTargets.add(targetKey);
            if (Boolean.TRUE.equals(value.fresh()) && value.stars() == 3) freshTriples++;
            ClashKingV2WarAttackValue prior = previous.get(targetKey);
            if (Boolean.FALSE.equals(value.fresh()) && prior != null && improves(prior, value)) {
                cleanupImprove++;
                if (value.stars() == 3) cleanupTriples++;
            }
            Long order = whole(attack, "order", "attackOrder", "round");
            if (order != null && order == 1) firstHit++;
            if (order != null && order == total) lastHit++;
            int defenderMap = ClashKingV2WarAdvancedJson.integer(target, "mapPosition");
            if (ownMapPosition > 0 && defenderMap > 0 && defenderMap <= ownMapPosition - 3) mapUp++;
            if (value.stars() == 3 && value.duration() != null && value.duration() >= 0) {
                fastestTriple = Math.min(fastestTriple, value.duration());
            }
        }

        void addDefense(
                int stars, Double destruction, Boolean fresh, int ownTownHall,
                int attackerTownHall
        ) {
            if (stars < 0) return;
            defEvents++;
            defenseStars.add(stars);
            defStarSamples++;
            defStarTotal += stars;
            if (stars < 3) {
                defHolds++;
                if (stars == 0) defZero++;
                if (stars <= 1) defOne++;
                if (attackerTownHall > ownTownHall && ownTownHall > 0) defUphitHold++;
            }
            if (destruction != null) {
                defDestructionSamples++;
                defDestruction += ClashKingV2WarAdvancedSupport.scaled(destruction);
            }
        }

        void addCapacity(JsonObject war, int used) {
            int perMember = ClashKingV2WarAdvancedJson.integer(war, "attacksPerMember");
            if (perMember > 0) noMiss.add(used == (long) perMember);
        }

        Map<String, Long> metrics() {
            Map<String, Long> result = new LinkedHashMap<>();
            put(result, "war_same_th_triples", sameThTriples);
            put(result, "war_one_up_triples", oneUpTriples);
            put(result, "war_plus_two_triples", plusTwoTriples);
            put(result, "war_99_fail", over99Fail);
            put(result, "war_zero_star_avoid", ClashKingV2WarAdvancedSupport.maxStreak(attackStars, 1));
            put(result, "war_two_plus_streak", ClashKingV2WarAdvancedSupport.maxStreak(attackStars, 2));
            put(result, "war_triple_streak", ClashKingV2WarAdvancedSupport.maxExactStreak(attackStars, 3));
            put(result, "war_average_stars", ClashKingV2WarAdvancedSupport.average(stars * 100, starSamples), attacks >= 25);
            put(result, "war_triple_rate", ClashKingV2WarAdvancedSupport.rate(triples, attacks), attacks >= 50);
            put(result, "war_average_destruction", ClashKingV2WarAdvancedSupport.average(destruction, destructionSamples), destructionSamples >= 50);
            put(result, "war_fastest_triple_seconds", fastestTriple, fastestTriple != Long.MAX_VALUE);
            put(result, "war_fresh_triples", freshTriples);
            put(result, "war_cleanup_improve", cleanupImprove);
            put(result, "war_cleanup_triples", cleanupTriples);
            put(result, "war_first_hit", firstHit);
            put(result, "war_last_hit", lastHit);
            put(result, "war_map_up", mapUp);
            put(result, "war_no_miss_streak", ClashKingV2WarAdvancedSupport.maxBooleanStreak(noMiss), !noMiss.isEmpty());
            put(result, "war_perfect_wars_player", perfectWarsPlayer);
            put(result, "war_all_th_matchups", defenderTownHalls.size());
            put(result, "war_triple_all_matchups", tripleTownHalls.size());
            put(result, "war_recent_form", recentForm(), attackStars.size() >= 20);
            put(result, "war_improving_form", improvingForm(), attackStars.size() >= 40);
            put(result, "war_versatile", tripleTargets.size());
            put(result, "def_events", defEvents);
            put(result, "def_holds", defHolds);
            put(result, "def_zero_star", defZero);
            put(result, "def_one_star", defOne);
            put(result, "def_uphit_hold", defUphitHold);
            put(result, "def_multi_hold", multiHoldWars);
            put(result, "def_hold_streak", ClashKingV2WarAdvancedSupport.maxBelow(defenseStars, 3));
            put(result, "def_avg_stars", ClashKingV2WarAdvancedSupport.average(defStarTotal * 100, defStarSamples), defStarSamples >= 25);
            put(result, "def_avg_destruction", ClashKingV2WarAdvancedSupport.average(defDestruction, defDestructionSamples), defDestructionSamples >= 25);
            put(result, "def_bounce_back", bounceBackStreak());
            return Map.copyOf(result);
        }

        private long recentForm() {
            int from = Math.max(0, attackStars.size() - 20);
            long triples = attackStars.subList(from, attackStars.size()).stream().filter(value -> value == 3).count();
            return ClashKingV2WarAdvancedSupport.rate(triples, attackStars.size() - from);
        }

        private long improvingForm() {
            if (attackStars.size() < 40) return 0;
            int recentFrom = attackStars.size() - 20;
            int previousFrom = recentFrom - 20;
            long previous = attackStars.subList(previousFrom, recentFrom).stream()
                    .filter(value -> value == 3).count();
            long recent = attackStars.subList(recentFrom, attackStars.size()).stream()
                    .filter(value -> value == 3).count();
            return Math.max(0, ClashKingV2WarAdvancedSupport.rate(recent, 20)
                    - ClashKingV2WarAdvancedSupport.rate(previous, 20));
        }

        private long bounceBackStreak() {
            long current = 0;
            long best = 0;
            boolean afterTriple = false;
            for (int stars : defenseStars) {
                if (stars == 3) {
                    afterTriple = true;
                    current = 0;
                } else if (afterTriple) {
                    current++;
                    best = Math.max(best, current);
                }
            }
            return best;
        }
    }

    private static boolean improves(
            ClashKingV2WarAttackValue prior, ClashKingV2WarAttackValue current
    ) {
        if (current.stars() > prior.stars()) return true;
        return current.stars() == prior.stars()
                && current.destruction() != null
                && prior.destruction() != null
                && current.destruction() > prior.destruction();
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

}

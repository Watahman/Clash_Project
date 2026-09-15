package Java.achievements;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Derives progression metrics only from complete player item records. Unknown
 * item names, missing levels, and partial arrays stay unavailable.
 */
final class AchievementDirectProgressionMetrics {
    private static final Set<String> KNOWN_SIEGE_NAMES = Set.of(
            "battleblimp", "battledrill", "flameflinger", "loglauncher",
            "siegebarracks", "stoneslammer", "trooplauncher", "wallwrecker"
    );
    private static final Set<String> KNOWN_HOME_TROOP_NAMES = Set.of(
            "apprenticewarden", "archer", "babydragon", "balloon", "barbarian",
            "bowler", "dragon", "dragonrider", "druid", "electrodragon", "electrotitan",
            "furnace", "giant", "goblin", "golem", "headhunter", "healer", "hogrider",
            "icegolem", "icehound", "infernodragon", "lavahound", "meteorgolem", "miner",
            "minion", "pekka", "rocketballoon", "rootrider", "sneakygoblin", "superarcher",
            "superbarbarian", "superbowler", "superdragon", "supergiant", "superhogrider",
            "superminer", "superminion", "supervalkyrie", "superwallbreaker", "superwitch",
            "superwizard", "superyeti", "thrower", "valkyrie", "wallbreaker", "witch",
            "wizard", "yeti"
    );

    private AchievementDirectProgressionMetrics() {}

    static void mergeInto(Map<String, Long> metrics, JsonObject profile, JsonArray equipment) {
        putKnownPetLevelSum(metrics, profile.get("pets"));
        ItemSet homeHeroes = levelledItems(profile.get("heroes"), "home", ItemKind.HERO);
        ItemSet builderHeroes = levelledItems(profile.get("heroes"), "builderBase", ItemKind.HERO);
        ItemSet homeTroops = levelledItems(profile.get("troops"), "home", ItemKind.TROOP);
        ItemSet builderTroops = levelledItems(profile.get("troops"), "builderBase", ItemKind.TROOP);
        ItemSet sieges = levelledItems(profile.get("troops"), "home", ItemKind.SIEGE);
        ItemSet homeSpells = levelledItems(profile.get("spells"), "home", ItemKind.SPELL);
        ItemSet pets = levelledItems(profile.get("pets"), "home", ItemKind.PET);
        ItemSet equipmentItems = completeLevelledItems(equipment);

        putMaxMetrics(metrics, homeHeroes, "profile_home_hero_max_count", "profile_all_home_heroes_max");
        putMaxMetrics(metrics, builderHeroes, "profile_builder_hero_max_count", "profile_all_builder_heroes_max");
        putMaxMetrics(metrics, homeTroops, "profile_home_troop_max_count", "profile_all_home_troops_max");
        putMaxMetrics(metrics, builderTroops, "profile_builder_troop_max_count", "profile_all_builder_troops_max");
        putMaxMetrics(metrics, sieges, "profile_siege_max_count", "profile_all_siege_max");
        putMaxMetrics(metrics, homeSpells, "profile_home_spell_max_count", "profile_all_home_spells_max");
        putMaxMetrics(metrics, pets, "profile_pet_max_count", "profile_all_pets_max");
        putEquipmentMaxMetrics(metrics, equipmentItems);
        putCompletionMetrics(metrics, homeHeroes, builderHeroes, homeTroops, builderTroops,
                sieges, homeSpells, pets, equipmentItems);
    }

    private static void putKnownPetLevelSum(Map<String, Long> metrics, JsonElement petsElement) {
        if (petsElement == null || !petsElement.isJsonArray()) return;
        JsonArray pets = petsElement.getAsJsonArray();
        if (pets.isEmpty()) return;
        long total = 0;
        for (JsonElement element : pets) {
            if (!element.isJsonObject()) return;
            Long level = numeric(element.getAsJsonObject(), "level");
            if (level == null || level < 0) return;
            total += level;
        }
        metrics.put("profile_pet_level_sum", total);
    }

    private static void putCompletionMetrics(
            Map<String, Long> metrics, ItemSet homeHeroes, ItemSet builderHeroes,
            ItemSet homeTroops, ItemSet builderTroops, ItemSet sieges,
            ItemSet homeSpells, ItemSet pets, ItemSet equipment
    ) {
        putCompletionMetric(metrics, "profile_home_hero_completion_pct", homeHeroes);
        putCompletionMetric(metrics, "profile_builder_hero_completion_pct", builderHeroes);
        putCompletionMetric(metrics, "profile_home_troop_completion_pct", homeTroops);
        putCompletionMetric(metrics, "profile_builder_troop_completion_pct", builderTroops);
        putCompletionMetric(metrics, "profile_siege_completion_pct", sieges);
        putCompletionMetric(metrics, "profile_home_spell_completion_pct", homeSpells);
        putCompletionMetric(metrics, "profile_pet_completion_pct", pets);
        putCompletionMetric(metrics, "profile_equipment_completion_pct", equipment);
        putCombinedCompletionMetric(metrics, "profile_offense_completion_pct",
                homeHeroes, homeTroops, homeSpells, sieges, pets, equipment);
        putCombinedCompletionMetric(metrics, "profile_builder_offense_completion_pct", builderHeroes, builderTroops);
        putBalancedHeroesMetric(metrics, homeHeroes);
        putBalancedArmyMetric(metrics, homeHeroes, homeTroops, homeSpells, equipment);
    }

    private static void putCompletionMetric(Map<String, Long> metrics, String key, ItemSet items) {
        Completion completion = combinedCompletion(items);
        if (completion != null) metrics.put(key, completion.percent());
    }

    private static void putCombinedCompletionMetric(
            Map<String, Long> metrics, String key, ItemSet... groups
    ) {
        Completion completion = combinedCompletion(groups);
        if (completion != null) metrics.put(key, completion.percent());
    }

    private static void putEquipmentMaxMetrics(Map<String, Long> metrics, ItemSet equipment) {
        if (equipment == null || equipment.values().isEmpty()) return;
        long maxCount = equipment.values().stream().filter(LevelledItem::atMax).count();
        metrics.put("profile_equipment_max_count", maxCount);
        if (equipment.complete()) {
            metrics.put("profile_all_returned_equipment_max", maxCount == equipment.values().size() ? 1L : 0L);
        }
    }

    @SafeVarargs
    private static Completion combinedCompletion(ItemSet... groups) {
        if (groups == null) return null;
        long levels = 0;
        long maxLevels = 0;
        for (ItemSet group : groups) {
            if (group == null || !group.complete() || group.values().isEmpty()) return null;
            for (LevelledItem item : group.values()) {
                levels += item.level();
                maxLevels += item.maxLevel();
            }
        }
        return maxLevels > 0 ? new Completion(levels, maxLevels) : null;
    }

    private static void putBalancedHeroesMetric(Map<String, Long> metrics, ItemSet heroes) {
        if (heroes == null || !heroes.complete() || heroes.values().size() < 3) return;
        long min = heroes.values().stream().mapToLong(LevelledItem::level).min().orElse(0L);
        long max = heroes.values().stream().mapToLong(LevelledItem::level).max().orElse(0L);
        metrics.put("profile_balanced_heroes", max - min <= 5L ? 1L : 0L);
    }

    private static void putBalancedArmyMetric(
            Map<String, Long> metrics, ItemSet heroes, ItemSet troops,
            ItemSet spells, ItemSet equipment
    ) {
        Completion[] groups = {
                combinedCompletion(heroes), combinedCompletion(troops),
                combinedCompletion(spells), combinedCompletion(equipment)
        };
        for (Completion group : groups) if (group == null) return;
        double minimum = 1.0;
        double maximum = 0.0;
        for (Completion group : groups) {
            minimum = Math.min(minimum, group.ratio());
            maximum = Math.max(maximum, group.ratio());
        }
        metrics.put("profile_balanced_army", maximum - minimum <= 0.10 + 1e-12 ? 1L : 0L);
    }

    private static void putMaxMetrics(
            Map<String, Long> metrics, ItemSet items, String maxCountKey, String allMaxKey
    ) {
        if (items == null || items.values().isEmpty()) return;
        long maxCount = items.values().stream().filter(LevelledItem::atMax).count();
        metrics.put(maxCountKey, maxCount);
        if (items.complete()) {
            metrics.put(allMaxKey, maxCount == items.values().size() ? 1L : 0L);
        }
    }

    private static ItemSet levelledItems(JsonElement valuesElement, String village, ItemKind expectedKind) {
        if (valuesElement == null || !valuesElement.isJsonArray()) return ItemSet.unavailable();
        List<LevelledItem> items = new ArrayList<>();
        boolean complete = true;
        for (JsonElement element : valuesElement.getAsJsonArray()) {
            if (!element.isJsonObject()) {
                complete = false;
                continue;
            }
            JsonObject item = element.getAsJsonObject();
            ItemKind actualKind = itemKind(item, expectedKind, village);
            if (actualKind == ItemKind.UNKNOWN) {
                if (ambiguousForRequest(item, expectedKind, village)) complete = false;
                continue;
            }
            if (!compatibleKind(actualKind, expectedKind)) {
                if (matchesVillage(item, village)) complete = false;
                continue;
            }
            if (actualKind != expectedKind || !matchesVillage(item, village)) continue;
            LevelledItem levelled = levelledItem(item);
            if (levelled == null) {
                complete = false;
                continue;
            }
            items.add(levelled);
        }
        return new ItemSet(items, complete && !items.isEmpty());
    }

    private static ItemSet completeLevelledItems(JsonArray values) {
        if (values == null || values.isEmpty()) return ItemSet.unavailable();
        List<LevelledItem> items = new ArrayList<>();
        boolean complete = true;
        for (JsonElement element : values) {
            if (!element.isJsonObject()) {
                complete = false;
                continue;
            }
            LevelledItem item = levelledItem(element.getAsJsonObject());
            if (item == null) {
                complete = false;
                continue;
            }
            items.add(item);
        }
        return new ItemSet(items, complete && !items.isEmpty());
    }

    private static LevelledItem levelledItem(JsonObject item) {
        Long level = numeric(item, "level");
        Long maxLevel = numeric(item, "maxLevel");
        if (level == null || maxLevel == null || maxLevel <= 0 || level < 0 || level > maxLevel) return null;
        return new LevelledItem(level, maxLevel);
    }

    private static boolean compatibleKind(ItemKind actualKind, ItemKind expectedKind) {
        if (expectedKind == ItemKind.TROOP || expectedKind == ItemKind.SIEGE) {
            return actualKind == ItemKind.TROOP || actualKind == ItemKind.SIEGE;
        }
        return actualKind == expectedKind;
    }

    private static ItemKind itemKind(JsonObject item, ItemKind sectionKind, String requestedVillage) {
        String type = normalizeType(string(item, "type"));
        if (!type.isBlank()) {
            if (type.contains("siege")) return ItemKind.SIEGE;
            if (type.contains("troop")) return ItemKind.TROOP;
            if (type.contains("hero")) return ItemKind.HERO;
            if (type.contains("spell")) return ItemKind.SPELL;
            if (type.contains("pet")) return ItemKind.PET;
            return ItemKind.UNKNOWN;
        }
        if (sectionKind != ItemKind.TROOP && sectionKind != ItemKind.SIEGE) return sectionKind;
        String actualVillage = normalizeType(string(item, "village"));
        String village = actualVillage.isBlank() ? "home" : actualVillage;
        if ("builderbase".equals(village) || "builder".equals(village)) return ItemKind.TROOP;
        String name = normalizeType(string(item, "name"));
        if (name.isBlank()) return ItemKind.UNKNOWN;
        if (KNOWN_SIEGE_NAMES.contains(name)) return ItemKind.SIEGE;
        return KNOWN_HOME_TROOP_NAMES.contains(name) ? ItemKind.TROOP : ItemKind.UNKNOWN;
    }

    private static boolean ambiguousForRequest(JsonObject item, ItemKind expectedKind, String requestedVillage) {
        if (expectedKind != ItemKind.TROOP && expectedKind != ItemKind.SIEGE) return false;
        return matchesVillage(item, requestedVillage);
    }

    private static boolean matchesVillage(JsonObject item, String village) {
        String actual = normalizeType(string(item, "village"));
        if (actual.isBlank()) return "home".equals(normalizeType(village));
        return actual.equals(normalizeType(village));
    }

    private static String normalizeType(String value) {
        return value == null ? "" : value.replaceAll("[^a-zA-Z0-9]", "").toLowerCase(Locale.ROOT);
    }

    private static Long numeric(JsonObject object, String field) {
        JsonElement value = object.get(field);
        if (value == null || !value.isJsonPrimitive() || !value.getAsJsonPrimitive().isNumber()) return null;
        try {
            double asDouble = value.getAsDouble();
            long asLong = value.getAsLong();
            return Double.isFinite(asDouble) && asDouble == asLong ? asLong : null;
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private enum ItemKind { UNKNOWN, TROOP, SIEGE, HERO, SPELL, PET }

    private record ItemSet(List<LevelledItem> values, boolean complete) {
        private static ItemSet unavailable() { return new ItemSet(List.of(), false); }
    }

    private record LevelledItem(long level, long maxLevel) {
        private boolean atMax() { return level == maxLevel; }
    }

    private record Completion(long levelSum, long maxLevelSum) {
        private long percent() { return levelSum * 100L / maxLevelSum; }
        private double ratio() { return (double) levelSum / maxLevelSum; }
    }

    private static String string(JsonObject object, String field) {
        JsonElement value = object.get(field);
        return value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isString()
                ? value.getAsString().trim()
                : "";
    }
}

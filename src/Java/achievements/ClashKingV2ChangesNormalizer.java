package Java.achievements;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/** Converts the public player change log into conservative observed-progress metrics. */
public final class ClashKingV2ChangesNormalizer {
    private static final long RECENT_WINDOW_SECONDS = 30L * 86_400L;

    private ClashKingV2ChangesNormalizer() {}

    public record Slice(Map<String, Long> metrics, int records, int upgradeRecords)
            implements ClashKingV2AchievementSlice {
        public Slice {
            metrics = Map.copyOf(metrics == null ? Map.of() : metrics);
        }
    }

    public static Slice normalize(JsonElement response) {
        return normalize(response, Instant.now());
    }

    static Slice normalize(JsonElement response, Instant now) {
        JsonArray rows = items(response);
        Set<String> activeDays = new HashSet<>();
        Counters counters = new Counters();
        Instant cutoff = now.minusSeconds(RECENT_WINDOW_SECONDS);
        for (JsonElement element : rows) read(object(element), activeDays, counters, cutoff);
        return new Slice(metrics(rows.size(), activeDays.size(), counters), rows.size(), counters.upgradeRecords);
    }

    private static void read(
            JsonObject row, Set<String> activeDays, Counters counters, Instant cutoff
    ) {
        String time = ClashKingV2PlayerHistoryJson.requiredString(row, "time");
        Instant eventTime = instant(time);
        activeDays.add(eventTime.toString().substring(0, 10));
        String type = ClashKingV2PlayerHistoryJson.normalizedType(
                ClashKingV2PlayerHistoryJson.requiredString(row, "type")
        );
        if (!row.has("townhall_level")) throw new IllegalArgumentException("Missing change townhall_level");
        if (!row.get("townhall_level").isJsonNull()) ClashKingV2PlayerHistoryJson.optionalNumber(row, "townhall_level");
        if (row.has("item") && !row.get("item").isJsonNull()) validateItem(row.get("item"));
        if (type.contains("name")) counters.nameChanges++;
        Category category = classify(type);
        long gain = levelGain(row);
        if (category != Category.UNKNOWN && gain > 0) {
            counters.upgradeRecords++;
            if (category == Category.BUILDER) counters.builderUpgradeRecords++;
            counters.levelGains = safeAdd(counters.levelGains, gain);
            counters.add(category, gain, !eventTime.isBefore(cutoff));
            if (category == Category.TOWN_HALL) counters.townHallIncreases++;
        }
    }

    private static Map<String, Long> metrics(int records, int activeDays, Counters counters) {
        Map<String, Long> metrics = new LinkedHashMap<>();
        metrics.put("history_change_events", (long) records);
        metrics.put("sea_activity_events", (long) records);
        metrics.put("sea_active_days", (long) activeDays);
        metrics.put("observed_upgrade_events", (long) counters.upgradeRecords);
        metrics.put("observed_upgrade_level_gains", counters.levelGains);
        metrics.put("off_upgrades_30d", counters.recentOffensiveGains());
        metrics.put("off_hero_up_30d", counters.recentHeroGains);
        metrics.put("off_equip_up_30d", counters.recentEquipmentGains);
        metrics.put("base_import_completions", (long) counters.upgradeRecords);
        metrics.put("base_building_levels_gained", counters.buildingGains);
        metrics.put("base_trap_levels_gained", counters.trapGains);
        metrics.put("base_wall_levels_gained", counters.wallGains);
        metrics.put("base_bb_upgrades_completed", (long) counters.builderUpgradeRecords);
        metrics.put("player_townhall_increases", counters.townHallIncreases);
        metrics.put("player_name_changes", counters.nameChanges);
        return Map.copyOf(metrics);
    }

    private static JsonArray items(JsonElement response) {
        if (response == null || !response.isJsonObject()) throw new IllegalArgumentException("Changes response is not an object");
        JsonElement value = response.getAsJsonObject().get("items");
        if (value == null || !value.isJsonArray()) throw new IllegalArgumentException("Changes response has no items array");
        return value.getAsJsonArray();
    }

    private static JsonObject object(JsonElement value) {
        if (value == null || !value.isJsonObject()) throw new IllegalArgumentException("Change item is not an object");
        return value.getAsJsonObject();
    }

    private static void validateItem(JsonElement value) {
        JsonObject item = object(value);
        ClashKingV2PlayerHistoryJson.requiredString(item, "name");
        Long id = ClashKingV2PlayerHistoryJson.optionalNumber(item, "id");
        if (id == null) throw new IllegalArgumentException("Missing change item id");
    }

    private static long levelGain(JsonObject row) {
        if (!row.has("previous") || !row.has("current")) return 0L;
        long previous = ClashKingV2PlayerHistoryJson.nestedLevel(row.get("previous"));
        long current = ClashKingV2PlayerHistoryJson.nestedLevel(row.get("current"));
        return current > previous ? current - previous : 0L;
    }

    private static Instant instant(String value) {
        try {
            return Instant.parse(value);
        } catch (DateTimeParseException error) {
            throw new IllegalArgumentException("Invalid change time", error);
        }
    }

    private static Category classify(String type) {
        if (type.contains("townhall") || type.contains("town_hall")) return Category.TOWN_HALL;
        if (type.contains("builder") || type.contains("versus")) return Category.BUILDER;
        if (type.contains("hero")) return Category.HERO;
        if (type.contains("equipment")) return Category.EQUIPMENT;
        if (type.contains("pet")) return Category.PET;
        if (type.contains("troop")) return Category.TROOP;
        if (type.contains("spell")) return Category.SPELL;
        if (type.contains("siege")) return Category.SIEGE;
        if (type.contains("wall")) return Category.WALL;
        if (type.contains("trap")) return Category.TRAP;
        if (type.contains("building") || type.contains("structure")) return Category.BUILDING;
        return Category.UNKNOWN;
    }

    private static long safeAdd(long left, long right) {
        if (right <= 0) return left;
        if (Long.MAX_VALUE - left < right) return Long.MAX_VALUE;
        return left + right;
    }

    private enum Category { UNKNOWN, TOWN_HALL, HERO, EQUIPMENT, PET, TROOP, SPELL, SIEGE, WALL, TRAP, BUILDER, BUILDING }

    private static final class Counters {
        private long levelGains;
        private long heroGains;
        private long equipmentGains;
        private long petGains;
        private long troopGains;
        private long spellGains;
        private long siegeGains;
        private long wallGains;
        private long trapGains;
        private long builderGains;
        private long buildingGains;
        private long recentHeroGains;
        private long recentEquipmentGains;
        private long recentPetGains;
        private long recentTroopGains;
        private long recentSpellGains;
        private long recentSiegeGains;
        private long townHallIncreases;
        private long nameChanges;
        private int upgradeRecords;
        private int builderUpgradeRecords;

        private void add(Category category, long gain, boolean recent) {
            switch (category) {
                case HERO -> heroGains = safeAdd(heroGains, gain);
                case EQUIPMENT -> equipmentGains = safeAdd(equipmentGains, gain);
                case PET -> petGains = safeAdd(petGains, gain);
                case TROOP -> troopGains = safeAdd(troopGains, gain);
                case SPELL -> spellGains = safeAdd(spellGains, gain);
                case SIEGE -> siegeGains = safeAdd(siegeGains, gain);
                case WALL -> wallGains = safeAdd(wallGains, gain);
                case TRAP -> trapGains = safeAdd(trapGains, gain);
                case BUILDER -> builderGains = safeAdd(builderGains, gain);
                case BUILDING -> buildingGains = safeAdd(buildingGains, gain);
                case TOWN_HALL, UNKNOWN -> { }
            }
            if (recent) addRecent(category, gain);
        }

        private void addRecent(Category category, long gain) {
            switch (category) {
                case HERO -> recentHeroGains = safeAdd(recentHeroGains, gain);
                case EQUIPMENT -> recentEquipmentGains = safeAdd(recentEquipmentGains, gain);
                case PET -> recentPetGains = safeAdd(recentPetGains, gain);
                case TROOP -> recentTroopGains = safeAdd(recentTroopGains, gain);
                case SPELL -> recentSpellGains = safeAdd(recentSpellGains, gain);
                case SIEGE -> recentSiegeGains = safeAdd(recentSiegeGains, gain);
                default -> { }
            }
        }

        private long recentOffensiveGains() {
            long result = recentHeroGains;
            for (long value : new long[]{recentEquipmentGains, recentPetGains,
                    recentTroopGains, recentSpellGains, recentSiegeGains}) {
                result = safeAdd(result, value);
            }
            return result;
        }
    }
}

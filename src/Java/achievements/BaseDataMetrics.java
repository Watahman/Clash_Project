package Java.achievements;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

public final class BaseDataMetrics {
    public static final int HOME_WALL_DATA_ID = 1_000_010;
    public static final int BUILDER_WALL_DATA_ID = 1_000_033;

    private static final String[] SNAPSHOT_SECTIONS = {
            "helpers", "buildings", "traps", "decos", "obstacles", "units",
            "siege_machines", "heroes", "spells", "pets", "equipment",
            "house_parts", "skins", "sceneries", "buildings2", "traps2",
            "decos2", "obstacles2", "units2", "heroes2", "skins2", "sceneries2"
    };

    private BaseDataMetrics() {}

    public static Map<String, Long> extract(JsonObject root) {
        Map<String, Long> metrics = new LinkedHashMap<>();

        addCollectionMetricsExcludingData(
                metrics,
                root,
                "buildings",
                "home_building",
                HOME_WALL_DATA_ID
        );
        addCollectionMetrics(metrics, root, "traps", "home_trap");
        addCollectionMetrics(metrics, root, "units", "home_unit");
        addCollectionMetrics(metrics, root, "siege_machines", "siege");
        addCollectionMetrics(metrics, root, "heroes", "home_hero");
        addCollectionMetrics(metrics, root, "spells", "spell");
        addCollectionMetrics(metrics, root, "pets", "pet");
        addCollectionMetrics(metrics, root, "equipment", "equipment");
        addCollectionMetrics(metrics, root, "helpers", "helper");

        addCollectionMetricsExcludingData(
                metrics,
                root,
                "buildings2",
                "builder_building",
                BUILDER_WALL_DATA_ID
        );
        addCollectionMetrics(metrics, root, "traps2", "builder_trap");
        addCollectionMetrics(metrics, root, "units2", "builder_unit");
        addCollectionMetrics(metrics, root, "heroes2", "builder_hero");

        metrics.put("home_wall_count", countForData(array(root, "buildings"), HOME_WALL_DATA_ID));
        metrics.put("home_wall_level_sum", levelSumForData(array(root, "buildings"), HOME_WALL_DATA_ID));
        metrics.put("builder_wall_count", countForData(array(root, "buildings2"), BUILDER_WALL_DATA_ID));
        metrics.put("builder_wall_level_sum", levelSumForData(array(root, "buildings2"), BUILDER_WALL_DATA_ID));

        metrics.put("active_upgrade_count", timedCount(root));
        metrics.put("gear_up_count", positiveFieldCount(array(root, "buildings"), "gear_up"));
        metrics.put("townhall_weapon_level", maxField(array(root, "buildings"), "weapon"));

        ModuleTotals modules = moduleTotals(array(root, "buildings"));
        metrics.put("defense_module_count", modules.count());
        metrics.put("defense_module_level_sum", modules.levelSum());

        addObjectCollectionMetrics(metrics, root, "decos", "decoration");
        addObjectCollectionMetrics(metrics, root, "obstacles", "obstacle");
        addObjectCollectionMetrics(metrics, root, "decos2", "builder_decoration");
        addObjectCollectionMetrics(metrics, root, "obstacles2", "builder_obstacle");

        metrics.put("skin_count", primitiveArrayCount(array(root, "skins")));
        metrics.put("builder_skin_count", primitiveArrayCount(array(root, "skins2")));
        metrics.put("scenery_count", primitiveArrayCount(array(root, "sceneries")));
        metrics.put("builder_scenery_count", primitiveArrayCount(array(root, "sceneries2")));
        metrics.put("house_part_count", primitiveArrayCount(array(root, "house_parts")));
        metrics.put("snapshot_section_count", presentSectionCount(root));

        long cosmeticCount = metrics.get("decoration_count")
                + metrics.get("obstacle_count")
                + metrics.get("builder_decoration_count")
                + metrics.get("builder_obstacle_count")
                + metrics.get("skin_count")
                + metrics.get("builder_skin_count")
                + metrics.get("scenery_count")
                + metrics.get("builder_scenery_count")
                + metrics.get("house_part_count");
        metrics.put("cosmetic_collection_count", cosmeticCount);

        return Map.copyOf(metrics);
    }

    private static void addCollectionMetrics(Map<String, Long> metrics, JsonObject root, String section, String prefix) {
        JsonArray values = array(root, section);
        metrics.put(prefix + "_count", itemCount(values));
        metrics.put(prefix + "_distinct_count", distinctDataCount(values));
        metrics.put(prefix + "_level_sum", levelSum(values));
    }

    private static void addCollectionMetricsExcludingData(
            Map<String, Long> metrics,
            JsonObject root,
            String section,
            String prefix,
            int excludedDataId
    ) {
        JsonArray values = array(root, section);
        metrics.put(prefix + "_count", itemCountExcludingData(values, excludedDataId));
        metrics.put(prefix + "_distinct_count", distinctDataCountExcludingData(values, excludedDataId));
        metrics.put(prefix + "_level_sum", levelSumExcludingData(values, excludedDataId));
    }

    private static void addObjectCollectionMetrics(Map<String, Long> metrics, JsonObject root, String section, String prefix) {
        JsonArray values = array(root, section);
        metrics.put(prefix + "_count", itemCount(values));
        metrics.put(prefix + "_distinct_count", distinctDataCount(values));
    }

    private static JsonArray array(JsonObject root, String field) {
        JsonElement value = root.get(field);
        return value != null && value.isJsonArray() ? value.getAsJsonArray() : new JsonArray();
    }

    private static long itemCount(JsonArray array) {
        long total = 0;
        for (JsonElement element : array) {
            if (element.isJsonObject()) total += positiveLong(element.getAsJsonObject(), "cnt", 1);
            else total++;
        }
        return total;
    }

    private static long itemCountExcludingData(JsonArray array, int excludedDataId) {
        long total = 0;
        for (JsonElement element : array) {
            if (!element.isJsonObject()) {
                total++;
                continue;
            }
            JsonObject object = element.getAsJsonObject();
            if (positiveLong(object, "data", -1) == excludedDataId) continue;
            total += positiveLong(object, "cnt", 1);
        }
        return total;
    }

    private static long primitiveArrayCount(JsonArray array) {
        return array.size();
    }

    private static long distinctDataCount(JsonArray array) {
        Set<Long> ids = new LinkedHashSet<>();
        for (JsonElement element : array) {
            if (!element.isJsonObject()) continue;
            JsonElement data = element.getAsJsonObject().get("data");
            if (data != null && data.isJsonPrimitive() && data.getAsJsonPrimitive().isNumber()) {
                ids.add(data.getAsLong());
            }
        }
        return ids.size();
    }

    private static long distinctDataCountExcludingData(JsonArray array, int excludedDataId) {
        Set<Long> ids = new LinkedHashSet<>();
        for (JsonElement element : array) {
            if (!element.isJsonObject()) continue;
            JsonElement data = element.getAsJsonObject().get("data");
            if (data == null || !data.isJsonPrimitive() || !data.getAsJsonPrimitive().isNumber()) continue;
            long dataId = data.getAsLong();
            if (dataId != excludedDataId) ids.add(dataId);
        }
        return ids.size();
    }

    private static long levelSum(JsonArray array) {
        long total = 0;
        for (JsonElement element : array) {
            if (!element.isJsonObject()) continue;
            JsonObject object = element.getAsJsonObject();
            total += positiveLong(object, "lvl", 0) * positiveLong(object, "cnt", 1);
        }
        return total;
    }

    private static long levelSumExcludingData(JsonArray array, int excludedDataId) {
        long total = 0;
        for (JsonElement element : array) {
            if (!element.isJsonObject()) continue;
            JsonObject object = element.getAsJsonObject();
            if (positiveLong(object, "data", -1) == excludedDataId) continue;
            total += positiveLong(object, "lvl", 0) * positiveLong(object, "cnt", 1);
        }
        return total;
    }

    private static long countForData(JsonArray array, int dataId) {
        long total = 0;
        for (JsonElement element : array) {
            if (!element.isJsonObject()) continue;
            JsonObject object = element.getAsJsonObject();
            if (positiveLong(object, "data", -1) == dataId) {
                total += positiveLong(object, "cnt", 1);
            }
        }
        return total;
    }

    private static long levelSumForData(JsonArray array, int dataId) {
        long total = 0;
        for (JsonElement element : array) {
            if (!element.isJsonObject()) continue;
            JsonObject object = element.getAsJsonObject();
            if (positiveLong(object, "data", -1) == dataId) {
                total += positiveLong(object, "lvl", 0) * positiveLong(object, "cnt", 1);
            }
        }
        return total;
    }

    private static long timedCount(JsonObject root) {
        String[] timedSections = {"buildings", "traps", "siege_machines", "heroes", "pets", "equipment", "buildings2", "traps2", "heroes2"};
        long total = 0;
        for (String section : timedSections) {
            total += positiveFieldCount(array(root, section), "timer");
        }
        return total;
    }

    private static long positiveFieldCount(JsonArray array, String field) {
        long total = 0;
        for (JsonElement element : array) {
            if (!element.isJsonObject()) continue;
            JsonObject object = element.getAsJsonObject();
            if (positiveLong(object, field, 0) > 0) total += positiveLong(object, "cnt", 1);
        }
        return total;
    }

    private static long maxField(JsonArray array, String field) {
        long max = 0;
        for (JsonElement element : array) {
            if (!element.isJsonObject()) continue;
            max = Math.max(max, positiveLong(element.getAsJsonObject(), field, 0));
        }
        return max;
    }

    private static ModuleTotals moduleTotals(JsonArray buildings) {
        long count = 0;
        long levelSum = 0;
        for (JsonElement buildingElement : buildings) {
            if (!buildingElement.isJsonObject()) continue;
            JsonElement typesElement = buildingElement.getAsJsonObject().get("types");
            if (typesElement == null || !typesElement.isJsonArray()) continue;
            for (JsonElement typeElement : typesElement.getAsJsonArray()) {
                if (!typeElement.isJsonObject()) continue;
                JsonElement modulesElement = typeElement.getAsJsonObject().get("modules");
                if (modulesElement == null || !modulesElement.isJsonArray()) continue;
                for (JsonElement moduleElement : modulesElement.getAsJsonArray()) {
                    if (!moduleElement.isJsonObject()) continue;
                    count++;
                    levelSum += positiveLong(moduleElement.getAsJsonObject(), "lvl", 0);
                }
            }
        }
        return new ModuleTotals(count, levelSum);
    }

    private static long presentSectionCount(JsonObject root) {
        long count = 0;
        for (String section : SNAPSHOT_SECTIONS) {
            JsonElement element = root.get(section);
            if (element != null && element.isJsonArray()) count++;
        }
        return count;
    }

    private static long positiveLong(JsonObject object, String field, long fallback) {
        JsonElement element = object.get(field);
        if (element == null || !element.isJsonPrimitive() || !element.getAsJsonPrimitive().isNumber()) return fallback;
        long value = element.getAsLong();
        return Math.max(value, 0);
    }

    private record ModuleTotals(long count, long levelSum) {}
}

package Java.achievements;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Shared JSON and primitive metric helpers for the fast achievement sources. */
final class AchievementFastMetricsSupport {
    private AchievementFastMetricsSupport() {}

    static void mergeNumeric(Map<String, Long> target, JsonObject source) {
        for (Map.Entry<String, JsonElement> entry : source.entrySet()) {
            JsonElement value = entry.getValue();
            if (value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isNumber()) {
                target.put(entry.getKey(), Math.max(0L, value.getAsLong()));
            }
        }
    }

    static long roleRank(String role) {
        String normalized = role == null ? "" : role.replace("_", "").replace("-", "").toLowerCase();
        return switch (normalized) {
            case "leader" -> 4;
            case "coleader" -> 3;
            case "admin", "elder" -> 2;
            case "member" -> 1;
            default -> 0;
        };
    }

    static long countVillage(JsonArray values, String village) {
        return villageLevels(values, village).size();
    }

    static List<Long> villageLevels(JsonArray values, String... villages) {
        List<Long> levels = new ArrayList<>();
        for (JsonElement element : values) {
            if (!element.isJsonObject()) continue;
            JsonObject item = element.getAsJsonObject();
            String itemVillage = string(item, "village");
            boolean match = itemVillage.isBlank();
            for (String village : villages) {
                if (village.equalsIgnoreCase(itemVillage)) match = true;
            }
            if (match) levels.add(number(item, "level"));
        }
        return levels;
    }

    static long sumLevels(JsonArray values) {
        long total = 0;
        for (JsonElement element : values) {
            if (element.isJsonObject()) total += number(element.getAsJsonObject(), "level");
        }
        return total;
    }

    static long sum(List<Long> values) {
        long total = 0;
        for (Long value : values) total += Math.max(0L, value == null ? 0L : value);
        return total;
    }

    static JsonArray firstArray(JsonObject object, String... fields) {
        for (String field : fields) {
            JsonArray values = array(object.get(field));
            if (!values.isEmpty()) return values;
        }
        return new JsonArray();
    }

    static long firstNumber(JsonObject object, String... fields) {
        for (String field : fields) {
            JsonElement value = object.get(field);
            if (value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isNumber()) {
                return Math.max(0L, value.getAsLong());
            }
        }
        return 0;
    }

    static long number(JsonObject object, String field) {
        return firstNumber(object, field);
    }

    static boolean bool(JsonObject object, String field) {
        JsonElement value = object.get(field);
        return value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isBoolean()
                && value.getAsBoolean();
    }

    static JsonObject object(JsonElement value) {
        return value != null && value.isJsonObject() ? value.getAsJsonObject() : new JsonObject();
    }

    static JsonArray array(JsonElement value) {
        return value != null && value.isJsonArray() ? value.getAsJsonArray() : new JsonArray();
    }

    static String string(JsonObject object, String field) {
        JsonElement value = object.get(field);
        return value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isString()
                ? value.getAsString().trim()
                : "";
    }

    static String nestedString(JsonObject object, String parent, String field) {
        return string(object(object.get(parent)), field);
    }

    static String errorCode(Exception error) {
        String value = error.getClass().getSimpleName();
        return value == null || value.isBlank() ? "SOURCE_ERROR" : value.toUpperCase();
    }
}

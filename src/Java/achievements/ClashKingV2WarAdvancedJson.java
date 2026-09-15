package Java.achievements;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import static Java.achievements.ClashKingV2AchievementJson.bool;
import static Java.achievements.ClashKingV2AchievementJson.decimal;
import static Java.achievements.ClashKingV2AchievementJson.object;
import static Java.achievements.ClashKingV2AchievementJson.text;
import static Java.achievements.ClashKingV2AchievementJson.whole;

/** Strict row ordering and field conversion for advanced war metrics. */
final class ClashKingV2WarAdvancedJson {
    private ClashKingV2WarAdvancedJson() {}

    static List<JsonObject> orderedWars(List<JsonObject> rows) {
        return rows.stream()
                .sorted(Comparator.comparing(
                                (JsonObject war) -> ClashKingV2WarAchievementSupport.timestamp(
                                        text(war, "endTime")
                                ),
                                Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(war -> text(war, "endTime")))
                .toList();
    }

    static List<JsonObject> orderedAttacks(JsonArray rows) {
        List<JsonObject> result = new ArrayList<>();
        if (rows != null) for (JsonElement value : rows) {
            if (value != null && value.isJsonObject()) result.add(value.getAsJsonObject());
        }
        result.sort(Comparator.comparing(
                        ClashKingV2WarAdvancedJson::attackOrder,
                        Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(attack -> text(attack, "order")));
        return result;
    }

    static Long attackOrder(JsonObject attack) {
        return whole(attack, "order", "attackOrder", "round");
    }

    static long capacity(JsonObject war) {
        int attacksPerMember = integer(war, "attacksPerMember");
        return attacksPerMember > 0 ? attacksPerMember : 0;
    }

    static String tag(JsonObject player) {
        return ClashKingV2WarAchievementProvider.normalizedTag(text(player, "tag"));
    }

    static ClashKingV2WarAttackValue attackValue(JsonObject attack) {
        Long starValue = whole(attack, "stars");
        int stars = starValue == null ? -1 : Math.max(0, Math.min(3, starValue.intValue()));
        Double destruction = decimal(attack, "destructionPercentage");
        Boolean fresh = bool(attack, "fresh");
        Long duration = whole(attack, "duration");
        return new ClashKingV2WarAttackValue(stars, destruction, fresh, duration,
                stars == 3 && destruction != null && destruction >= 100);
    }

    static String targetKey(JsonObject attack) {
        JsonObject player = object(attack, "player");
        String targetTag = ClashKingV2WarAchievementProvider.normalizedTag(text(player, "tag"));
        if (!targetTag.isBlank()) return targetTag;
        return "map:" + integer(player, "mapPosition");
    }

    static int integer(JsonObject object, String field) {
        return integer(object, field, 0);
    }

    static int integer(JsonObject object, String field, int fallback) {
        Long value = whole(object, field);
        return value == null || value < 0 || value > Integer.MAX_VALUE ? fallback : value.intValue();
    }
}

record ClashKingV2WarAttackValue(
        int stars,
        Double destruction,
        Boolean fresh,
        Long duration,
        boolean perfect
) {}

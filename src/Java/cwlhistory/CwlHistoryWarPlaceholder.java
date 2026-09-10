package Java.cwlhistory;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.List;

/** Preserves unresolved ClashKing CWL war references as incomplete rows. */
final class CwlHistoryWarPlaceholder {
    private CwlHistoryWarPlaceholder() {}

    static JsonObject taggedWar(JsonElement value, int day) {
        JsonObject war = object(value);
        if (war == null) return null;
        if (CwlHistoryJson.integer(
                war, 0, "_round", "round", "day", "warDay"
        ) <= 0) {
            war.addProperty("_round", day);
        }
        return war;
    }

    static HistoricalCwlSeason.War normalize(
            JsonObject war,
            String selectedTag
    ) {
        String id = CwlHistoryJson.string(
                war, "tag", "warTag", "id", "_warTag"
        );
        if (id.isBlank()) return null;
        return new HistoricalCwlSeason.War(
                CwlHistoryJson.integer(
                        war, 0, "_round", "round", "day", "warDay"
                ),
                id,
                "unknown",
                "unknown",
                CwlHistoryJson.integer(
                        war, 0, "teamSize", "team_size", "warSize"
                ),
                Math.max(1, CwlHistoryJson.integer(
                        war, 1, "attacksPerMember", "attacks_per_member"
                )),
                emptySide(selectedTag),
                emptySide(""),
                false
        );
    }

    private static JsonObject object(JsonElement value) {
        if (value.isJsonObject()) return value.getAsJsonObject().deepCopy();
        if (!value.isJsonPrimitive()
                || !value.getAsJsonPrimitive().isString()) return null;
        JsonObject war = new JsonObject();
        war.addProperty("tag", value.getAsString());
        return war;
    }

    private static HistoricalCwlSeason.WarSide emptySide(String tag) {
        return new HistoricalCwlSeason.WarSide(
                tag, "", 0, 0, 0, List.of()
        );
    }
}

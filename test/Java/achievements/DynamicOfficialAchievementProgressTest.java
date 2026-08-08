package Java.achievements;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DynamicOfficialAchievementProgressTest {
    @Test
    void keepsPreviouslyUnlockedOfficialBadgeWhenLiveSourceIsMissing() {
        JsonObject stored = new JsonObject();
        stored.addProperty("achievement_key", "OFFICIAL_0123456789abcdef");
        stored.addProperty("family_key", "OFFICIAL_0123456789abcdef");
        stored.addProperty("title", "War Hero");
        stored.addProperty("description", "Completed official achievement");
        stored.addProperty("category", "dynamic_official_achievements");
        stored.addProperty("rarity", "uncommon");
        stored.addProperty("tier", 1);
        stored.addProperty("xp", 100);
        stored.addProperty("metric", "official:0123456789abcdef");
        stored.addProperty("progress", 1000);
        stored.addProperty("target", 1000);
        stored.addProperty("unlocked", true);
        JsonArray rows = new JsonArray();
        rows.add(stored);

        JsonArray merged = DynamicOfficialAchievementProgress.merge(rows.toString(), new JsonArray(), false);

        assertEquals(1, merged.size());
        JsonObject badge = merged.get(0).getAsJsonObject();
        assertTrue(badge.get("unlocked").getAsBoolean());
        assertEquals(100, badge.get("xp").getAsInt());
        assertFalse(badge.get("progress_known").getAsBoolean());
        assertTrue(badge.get("has_stored_progress").getAsBoolean());
    }
}

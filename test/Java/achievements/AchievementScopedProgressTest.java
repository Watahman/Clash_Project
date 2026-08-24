package Java.achievements;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;

class AchievementScopedProgressTest {
    @Test
    void readsSharedRowsFromClanLedgerEvenWhenPersonalMapHasSameKey() {
        JsonObject catalog = row("clan", 8, false);
        JsonObject personal = row("player", 99, true);
        JsonObject clan = row("clan", 12, true);

        assertSame(clan, AchievementScopedProgress.storedFor(
                catalog, Map.of("CL_LEVEL_1", personal), Map.of("CL_LEVEL_1", clan)
        ));
    }

    @Test
    void persistsOnlyImprovedClanRowsAndNeverPlayerRows() {
        JsonObject stored = row("clan", 10, true);
        JsonArray complete = new JsonArray();
        complete.add(row("clan", 10, true));
        complete.add(rowWithKey("CL_LEVEL_2", "clan", 15, true));
        complete.add(rowWithKey("PLY_TH_1", "player", 18, true));

        JsonArray changed = AchievementScopedProgress.changedClanRows(
                Map.of("CL_LEVEL_1", stored), complete
        );
        assertEquals(1, changed.size());
        assertEquals("CL_LEVEL_2", changed.get(0).getAsJsonObject().get("achievement_key").getAsString());
    }

    private JsonObject row(String scope, long progress, boolean unlocked) {
        return rowWithKey("CL_LEVEL_1", scope, progress, unlocked);
    }

    private JsonObject rowWithKey(String key, String scope, long progress, boolean unlocked) {
        JsonObject row = new JsonObject();
        row.addProperty("achievement_key", key);
        row.addProperty("scope", scope);
        row.addProperty("progress_known", true);
        row.addProperty("progress", progress);
        row.addProperty("target", key.endsWith("2") ? 15 : 10);
        row.addProperty("unlocked", unlocked);
        return row;
    }
}

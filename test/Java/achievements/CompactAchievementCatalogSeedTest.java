package Java.achievements;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CompactAchievementCatalogSeedTest {
    @Test
    void containsTheCompleteAuthoritativeCatalogAndLteMetadata() throws Exception {
        String sql = Files.readString(Path.of(
                "database/migrations/20260911160035_seed_fixed_achievement_catalog.sql"
        ));
        int start = sql.indexOf("$catalog$") + "$catalog$".length();
        int end = sql.indexOf("$catalog$", start);
        JsonArray rows = JsonParser.parseString(sql.substring(start, end)).getAsJsonArray();
        Set<String> families = new HashSet<>();
        boolean hasBaseTimerLte = false;

        for (JsonElement element : rows) {
            String family = element.getAsJsonObject().get("family_key").getAsString();
            families.add(family);
            if ("BASE_FINISHING_SOON".equals(family)) {
                hasBaseTimerLte = "LTE".equals(
                        element.getAsJsonObject().get("comparison").getAsString()
                );
            }
        }

        assertEquals(AchievementSpecV2Catalog.EXPECTED_FIXED_TIER_COUNT, rows.size());
        assertEquals(AchievementSpecV2Catalog.EXPECTED_FAMILY_COUNT, families.size());
        assertTrue(hasBaseTimerLte);
    }
}

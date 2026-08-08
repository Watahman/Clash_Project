package Java.achievements;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AchievementEvaluatorTest {
    @Test
    void loadsExactV2CatalogCounts() {
        Set<String> familyKeys = AchievementCatalog.definitions().stream()
                .map(AchievementDefinition::familyKey)
                .collect(Collectors.toSet());

        assertEquals(340, AchievementSpecV2Catalog.sourceFamilyCount());
        assertEquals(1331, AchievementSpecV2Catalog.sourceFixedTierCount());
        assertEquals(340, familyKeys.size());
        assertEquals(1331, AchievementCatalog.definitions().size());

        for (String required : List.of(
                "PLY_TH", "OFF_HERO_SUM", "WAR_ATTACKS", "CWL_SEASONS",
                "RAID_WEEKENDS", "APP_BASE_IMPORT_FIRST", "DYN_OFFICIAL_ACHIEVEMENT"
        )) assertTrue(familyKeys.contains(required), required);
    }

    @Test
    void townHallTrailblazerMatchesOriginalSevenTiers() {
        var tiers = family("PLY_TH");
        assertEquals(7, tiers.size());
        assertEquals(List.of(5L, 8L, 10L, 12L, 14L, 16L, 18L),
                tiers.stream().map(AchievementDefinition::target).toList());
        assertEquals(List.of("common", "uncommon", "rare", "epic", "legendary", "mythic", "mythic"),
                tiers.stream().map(AchievementDefinition::rarity).toList());
        assertEquals(List.of(50, 100, 200, 400, 800, 1500, 1500),
                tiers.stream().map(AchievementDefinition::xp).toList());
    }

    @Test
    void directMetricsUnlockOnlyReachedV2Tiers() {
        AchievementEvaluator evaluator = new AchievementEvaluator();
        var tiers = evaluator.evaluate(Map.of("profile_town_hall", 13L)).stream()
                .filter(item -> item.definition().familyKey().equals("PLY_TH"))
                .toList();

        assertEquals(7, tiers.size());
        assertTrue(tiers.get(0).measurable());
        assertTrue(tiers.get(0).unlocked());
        assertTrue(tiers.get(3).unlocked());
        assertFalse(tiers.get(4).unlocked());
    }

    @Test
    void missingOrUnsupportedEvidenceStaysUnknownInsteadOfZero() {
        AchievementEvaluator evaluator = new AchievementEvaluator();
        var warAttack = evaluator.evaluate(Map.of()).stream()
                .filter(item -> item.definition().familyKey().equals("WAR_ATTACKS"))
                .findFirst()
                .orElseThrow();

        assertFalse(warAttack.measurable());
        assertEquals(0, warAttack.progress());
        assertFalse(warAttack.unlocked());

        JsonObject json = evaluator.toJson(List.of(warAttack)).get(0).getAsJsonObject();
        assertFalse(json.get("progress_known").getAsBoolean());
        assertFalse(json.get("source_available").isJsonNull());
    }

    @Test
    void mixedNumericAndCatalogDependentTiersDoNotFalseUnlock() {
        AchievementEvaluator evaluator = new AchievementEvaluator();
        var gear = evaluator.evaluate(Map.of("gear_up_count", 3L)).stream()
                .filter(item -> item.definition().familyKey().equals("BASE_HOME_GEARUPS"))
                .toList();

        assertEquals(4, gear.size());
        assertTrue(gear.get(0).measurable());
        assertTrue(gear.get(2).measurable());
        assertTrue(gear.get(2).unlocked());
        assertFalse(gear.get(3).measurable());
        assertFalse(gear.get(3).unlocked());
    }

    @Test
    void dynamicOfficialAchievementUsesSpecV2Shape() {
        AchievementEvaluator evaluator = new AchievementEvaluator();
        JsonObject official = new JsonObject();
        official.addProperty("name", "War Hero");
        official.addProperty("village", "home");
        official.addProperty("value", 1000);
        official.addProperty("target", 1000);
        official.addProperty("stars", 3);
        official.addProperty("info", "Earn stars for your clan in Clan War battles");
        official.addProperty("completionInfo", "Earn 1000 stars for your clan in Clan War battles");
        JsonArray input = new JsonArray();
        input.add(official);

        JsonObject badge = evaluator.dynamicOfficialAchievements(input, true).get(0).getAsJsonObject();
        assertTrue(badge.get("achievement_key").getAsString().startsWith("OFFICIAL_"));
        assertEquals(25, badge.get("achievement_key").getAsString().length());
        assertEquals("War Hero", badge.get("title").getAsString());
        assertEquals("uncommon", badge.get("rarity").getAsString());
        assertEquals(100, badge.get("xp").getAsInt());
        assertEquals(1000, badge.get("progress").getAsLong());
        assertEquals(1000, badge.get("target").getAsLong());
        assertTrue(badge.get("unlocked").getAsBoolean());
    }

    private static List<AchievementDefinition> family(String familyKey) {
        return AchievementCatalog.definitions().stream()
                .filter(definition -> definition.familyKey().equals(familyKey))
                .toList();
    }
}

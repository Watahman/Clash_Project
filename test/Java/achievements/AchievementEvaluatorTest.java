package Java.achievements;

import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AchievementEvaluatorTest {
    @Test
    void unlocksOnlyReachedTiers() {
        AchievementEvaluator evaluator = new AchievementEvaluator();
        var result = evaluator.evaluate(Map.of("home_wall_count", 200L));

        var wallTiers = result.stream()
                .filter(item -> item.definition().familyKey().equals("wall_collector"))
                .toList();

        assertEquals(4, wallTiers.size());
        assertTrue(wallTiers.get(0).unlocked());
        assertTrue(wallTiers.get(1).unlocked());
        assertFalse(wallTiers.get(2).unlocked());
        assertFalse(wallTiers.get(3).unlocked());
    }

    @Test
    void exposesCurrentHistoricalAndBattleAchievementCatalog() {
        Set<String> familyKeys = AchievementCatalog.definitions().stream()
                .map(AchievementDefinition::familyKey)
                .collect(Collectors.toSet());

        assertEquals(49, familyKeys.size());
        assertEquals(195, AchievementCatalog.definitions().size());
        assertTrue(familyKeys.contains("battle_tracker"));
        assertTrue(familyKeys.contains("star_collector"));
        assertTrue(familyKeys.contains("three_star_specialist"));
    }

    @Test
    void keepsFiniteGameProgressionTargetsReachableAndMeaningful() {
        Map<String, Long> expectedFinalTargets = Map.ofEntries(
                Map.entry("village_builder", 90L),
                Map.entry("gear_engineer", 3L),
                Map.entry("hero_power", 475L),
                Map.entry("army_scholar", 300L),
                Map.entry("siege_engineer", 48L),
                Map.entry("pet_keeper", 12L),
                Map.entry("pet_trainer", 145L),
                Map.entry("equipment_mastery", 850L),
                Map.entry("helper_mastery", 27L),
                Map.entry("builder_wall_grinder", 1750L),
                Map.entry("builder_hero_power", 70L),
                Map.entry("builder_army_power", 235L),
                Map.entry("module_engineer", 9L),
                Map.entry("module_mastery", 90L)
        );

        for (var entry : expectedFinalTargets.entrySet()) {
            var tiers = AchievementCatalog.definitions().stream()
                    .filter(definition -> definition.familyKey().equals(entry.getKey()))
                    .toList();
            assertFalse(tiers.isEmpty(), entry.getKey());
            assertEquals(entry.getValue().longValue(), tiers.getLast().target(), entry.getKey());
        }

        var gearTiers = AchievementCatalog.definitions().stream()
                .filter(definition -> definition.familyKey().equals("gear_engineer"))
                .toList();
        assertEquals(3, gearTiers.size());
        assertEquals("legendary", gearTiers.getLast().rarity());
        assertEquals(400, gearTiers.getLast().xp());
    }
}

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
        assertEquals(196, AchievementCatalog.definitions().size());
        assertTrue(familyKeys.contains("battle_tracker"));
        assertTrue(familyKeys.contains("star_collector"));
        assertTrue(familyKeys.contains("three_star_specialist"));
    }
}
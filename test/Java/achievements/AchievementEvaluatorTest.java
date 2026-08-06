package Java.achievements;

import org.junit.jupiter.api.Test;

import java.util.Map;

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
    void exposesThirtyPlusAchievementFamilies() {
        long families = AchievementCatalog.definitions().stream()
                .map(AchievementDefinition::familyKey)
                .distinct()
                .count();
        assertTrue(families >= 30);
    }
}

package Java;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AchievementProgressMergeTest {
    @Test
    void keepsLowestPositiveRankForLteAchievements() {
        assertEquals(125, AchievementProgressMerge.best("TR_GLOBAL_RANK_1", 125, 400));
        assertEquals(125, AchievementProgressMerge.best("TR_GLOBAL_RANK_1", 400, 125));
        assertEquals(125, AchievementProgressMerge.best("TR_GLOBAL_RANK_1", 0, 125));
        assertEquals(125, AchievementProgressMerge.best("TR_GLOBAL_RANK_1", 125, 0));
    }

    @Test
    void onlyTreatsARealLowerRankAsImprovement() {
        assertTrue(AchievementProgressMerge.improved("TR_GLOBAL_RANK_1", 125, 400));
        assertTrue(AchievementProgressMerge.improved("TR_GLOBAL_RANK_1", 125, 0));
        assertFalse(AchievementProgressMerge.improved("TR_GLOBAL_RANK_1", 400, 125));
        assertFalse(AchievementProgressMerge.improved("TR_GLOBAL_RANK_1", 0, 125));
    }

    @Test
    void retainsHighestProgressForNormalAchievements() {
        assertEquals(500, AchievementProgressMerge.best("PLY_WAR_STARS_1", 500, 200));
        assertEquals(500, AchievementProgressMerge.best("PLY_WAR_STARS_1", 200, 500));
        assertTrue(AchievementProgressMerge.improved("PLY_WAR_STARS_1", 500, 200));
        assertFalse(AchievementProgressMerge.improved("PLY_WAR_STARS_1", 200, 500));
    }

    @Test
    void unknownCatalogKeysUseNormalCounterSemantics() {
        assertEquals(9, AchievementProgressMerge.best("dynamic-official", 9, 7));
        assertTrue(AchievementProgressMerge.improved("dynamic-official", 9, 7));
    }
}

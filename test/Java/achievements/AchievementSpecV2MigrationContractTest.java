package Java.achievements;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class AchievementSpecV2MigrationContractTest {
    @Test
    void widensRarityAndTierChecksWithoutDroppingProgress() throws Exception {
        String sql = Files.readString(Path.of(
                "database/migrations/20260808_011_achievement_spec_v2_constraints.sql"
        ));

        assertTrue(sql.contains("'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'"));
        assertTrue(sql.contains("tier between 1 and 7"));
        assertTrue(sql.contains("drop constraint if exists achievement_progress_rarity_check"));
        assertTrue(sql.contains("drop constraint if exists achievement_progress_tier_check"));
    }
}

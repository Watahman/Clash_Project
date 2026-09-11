package Java.achievements;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class AchievementDefinitionCopyParityMigrationTest {
    private static final Path MIGRATION = Path.of(
            "database/migrations/20260911211500_achievement_definition_copy_parity.sql"
    );

    @Test
    void storesLegacyTierCopyAndProjectsItThroughBothReadContracts() throws Exception {
        String sql = Files.readString(MIGRATION);

        assertTrue(sql.contains("add column if not exists title text not null default ''"));
        assertTrue(sql.contains("add column if not exists description text not null default ''"));
        assertTrue(sql.contains("from public.achievement_progress"));
        assertTrue(sql.contains("from public.clan_achievement_progress"));
        assertTrue(sql.contains("d.title, d.description"));
        assertTrue(sql.contains("insert into public.achievement_definitions ("));
        assertTrue(sql.contains("title = case when excluded.title <> ''"));
        assertTrue(sql.contains("description = case when excluded.description <> ''"));
        assertTrue(!sql.matches("(?s).*\\b(delete|truncate)\\s+from\\s+public\\.(achievement_progress|clan_achievement_progress)\\b.*"));
    }
}

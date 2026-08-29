package Java.achievements;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class AchievementProgressPersistenceContractTest {
    @Test
    void playerProgressBulkUpsertAlwaysIncludesUnlockedAtKey() throws Exception {
        String source = Files.readString(Path.of("src/Java/SUPABASE_Achievements.java"));
        int start = source.indexOf("private boolean persistObservedProgress(");
        int end = source.indexOf("private Map<String, JsonObject> storedRowsByKey", start);
        assertTrue(start >= 0 && end > start, "achievement persistence method must remain discoverable");
        String persistence = source.substring(start, end);

        // PostgREST JSON bulk inserts require uniform object keys. All three states
        // (existing unlock, new unlock, still locked) must therefore write unlocked_at.
        assertTrue(persistence.contains("db.add(\"unlocked_at\", existingUnlockedAt.deepCopy())"));
        assertTrue(persistence.contains("db.addProperty(\"unlocked_at\", unlockedNow)"));
        assertTrue(persistence.contains("db.add(\"unlocked_at\", com.google.gson.JsonNull.INSTANCE)"));
        assertTrue(persistence.contains("SUPABASE_Client.upsert(\"achievement_progress\""));
    }
}

package Java.achievements;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class AchievementProgressPersistenceContractTest {
    @Test
    void usesCompactReadAndAtomicReconcileRpcsWithoutLegacyProgressTableAccess() throws Exception {
        String source = Files.readString(Path.of("src/Java/SUPABASE_Achievements.java"));
        int start = source.indexOf("private boolean persistObservedProgress(");
        int end = source.indexOf("private JsonArray observedProgressRows", start);
        assertTrue(start >= 0 && end > start, "achievement persistence method must remain discoverable");
        String persistence = source.substring(start, end);

        assertTrue(source.contains("read_achievement_progress_v2"));
        assertTrue(source.contains("save_achievement_import"));
        assertTrue(persistence.contains("reconcile_achievement_progress_v2"));
        assertTrue(persistence.contains("p_source_timestamp"));
        assertTrue(persistence.contains("p_progress"));
        assertTrue(!persistence.contains("SUPABASE_Client.upsert"));
        assertTrue(!source.contains("SUPABASE_Client.upsert(\"achievement_progress\""));
    }
}

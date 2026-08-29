package Java.advancedstats;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdvancedStatsBatchedCollectionContractTest {
    @Test
    void scheduledCollectorUsesOnePageRepositoryInsteadOfPerEventPersistence() throws Exception {
        String collector = Files.readString(Path.of(
                "src/Java/advancedstats/AdvancedStatsCompactScheduledCollector.java"
        ));
        String repository = Files.readString(Path.of(
                "src/Java/advancedstats/AdvancedStatsBatchedCompactRepository.java"
        ));

        assertTrue(collector.contains("new AdvancedStatsBatchedCompactRepository(workerId)"));
        assertTrue(repository.contains("save_advanced_stats_compact_page_v1"));
        assertFalse(repository.contains("save_advanced_stats_compact_event_v1"));
        assertFalse(repository.contains("save_advanced_stats_compact_event_v2"));
    }

    @Test
    void pageRpcKeepsCoverageSeparateFromBootstrapCompletion() throws Exception {
        String migration = Files.readString(Path.of(
                "database/migrations/20260829184000_advanced_stats_batched_collection.sql"
        ));

        assertTrue(migration.contains("p_has_more"));
        assertTrue(migration.contains("'RUNNING' else 'COMPLETE'"));
        assertTrue(migration.contains("update_advanced_stats_scope_poll_v2"));
        assertTrue(migration.contains("save_advanced_stats_compact_event_v2"));
    }
}

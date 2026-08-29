package Java.advancedstats;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class AdvancedStatsRepositoryRpcContractTest {
    @Test
    void destructiveDeleteUsesSingleDatabaseRpc() throws Exception {
        String source = Files.readString(Path.of(
                "src/Java/advancedstats/AdvancedStatsRepository.java"
        ));

        assertTrue(source.contains("delete_advanced_stats_tracking_v1"));
        assertTrue(source.contains("p_user_id"));
        assertTrue(source.contains("p_player_tag"));
    }

    @Test
    void startActionCanRetryOnlyFailedBootstrapWithoutDeletingCollectedStats() throws Exception {
        String repository = Files.readString(Path.of(
                "src/Java/advancedstats/AdvancedStatsRepository.java"
        ));
        String migration = Files.readString(Path.of(
                "database/migrations/20260829192000_advanced_stats_retry_failed_bootstrap.sql"
        ));

        assertTrue(repository.contains("retry_advanced_stats_tracking_v1"));
        assertTrue(migration.contains("bootstrap_status, 'PENDING') <> 'FAILED'"));
        assertTrue(migration.contains("next_poll_at = p_now"));
        assertTrue(migration.contains("bootstrap_status = 'PENDING'"));
        assertTrue(migration.contains("where tracking_id = v_tracker.id"));
        assertTrue(migration.contains("grant execute on function public.retry_advanced_stats_tracking_v1"));
    }
}

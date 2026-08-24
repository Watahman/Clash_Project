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
}

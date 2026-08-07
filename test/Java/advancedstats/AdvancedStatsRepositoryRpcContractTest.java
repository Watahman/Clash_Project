package Java.advancedstats;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class AdvancedStatsRepositoryRpcContractTest {
    @Test
    void repositoryUsesReadReadyIngestionRpcAndAvailableLootFields() throws Exception {
        String source = Files.readString(Path.of(
                "src/Java/advancedstats/AdvancedStatsRepository.java"
        ));

        assertTrue(source.contains("save_advanced_stats_battle_v3"));
        assertTrue(source.contains("record_advanced_stats_parser_error_v2"));
        assertTrue(source.contains("p_available_gold"));
        assertTrue(source.contains("p_available_elixir"));
        assertTrue(source.contains("p_available_dark_elixir"));
        assertTrue(source.contains("p_army_hash"));
        assertTrue(source.contains("p_normalized_army_json"));
    }
}

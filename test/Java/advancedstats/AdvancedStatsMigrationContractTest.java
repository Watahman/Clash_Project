package Java.advancedstats;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class AdvancedStatsMigrationContractTest {
    @Test
    void ingestionMigrationKeepsDedupAndAggregatesInOneDatabaseFunction() throws Exception {
        String sql = Files.readString(Path.of(
                "database/migrations/20260807_002_advanced_stats_battle_ingestion.sql"
        ));

        assertTrue(sql.contains("on conflict (tracking_id, battle_fingerprint) do nothing"));
        assertTrue(sql.contains("advanced_stats_battle_units"));
        assertTrue(sql.contains("advanced_stats_unit_totals"));
        assertTrue(sql.contains("advanced_stats_army_totals"));
        assertTrue(sql.contains("advanced_stats_daily"));
        assertTrue(sql.contains("battles_processed = battles_processed + 1"));
        assertTrue(sql.contains("v_existing_status <> 'PARSER_ERROR'"));
    }

    @Test
    void identityHardeningPersistsAvailableLootUsedByFingerprint() throws Exception {
        String sql = Files.readString(Path.of(
                "database/migrations/20260807_003_advanced_stats_identity_hardening.sql"
        ));

        assertTrue(sql.contains("available_gold"));
        assertTrue(sql.contains("available_elixir"));
        assertTrue(sql.contains("available_dark_elixir"));
        assertTrue(sql.contains("save_advanced_stats_battle_v2"));
        assertTrue(sql.contains("record_advanced_stats_parser_error_v2"));
    }
}

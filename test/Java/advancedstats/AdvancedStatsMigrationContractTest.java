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

    @Test
    void scheduledCollectionUsesAtomicLeasesAndConservativeGapRecovery() throws Exception {
        String sql = Files.readString(Path.of(
                "database/migrations/20260807_004_advanced_stats_scheduled_collection.sql"
        ));

        assertTrue(sql.contains("for update skip locked"));
        assertTrue(sql.contains("locked_until is null or t.locked_until <= p_now"));
        assertTrue(sql.contains("claim_advanced_stats_trackers_v1"));
        assertTrue(sql.contains("complete_advanced_stats_poll_v1"));
        assertTrue(sql.contains("fail_advanced_stats_poll_v1"));
        assertTrue(sql.contains("consecutive_failures = 0"));
        assertTrue(sql.contains("when v_failures >= v_threshold then 'DEGRADED'"));
        assertTrue(sql.contains("'WORKER_OUTAGE'"));
        assertTrue(sql.contains("advanced_stats_tracking_gaps"));
        assertTrue(sql.contains("when v_tracker.gap_started_at is not null then p_now"));
        assertTrue(sql.contains("revoke all on function public.claim_advanced_stats_trackers_v1"));
    }
}

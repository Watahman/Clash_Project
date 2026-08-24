package Java.advancedstats;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class AdvancedStatsCompactCapabilityContractTest {
    @Test
    void compactRepositoryUsesCompareAndSwapCheckpointsAndCapabilityRpc() throws Exception {
        String source = Files.readString(Path.of(
                "src/Java/advancedstats/AdvancedStatsCompactRepository.java"));
        String capabilityWriter = Files.readString(Path.of(
                "src/Java/advancedstats/AdvancedStatsCompactCapabilityWriter.java"));

        assertTrue(source.contains("p_expected_cursor"));
        assertTrue(source.contains("p_expected_watermark_at"));
        assertTrue(source.contains("p_expected_watermark_key"));
        assertTrue(capabilityWriter.contains("record_advanced_stats_scope_capability_v1"));
        assertTrue(source.contains("switch_advanced_stats_ranked_season_v1"));
        assertTrue(source.contains("source_season_key"));
    }

    @Test
    void databaseContractPersistsExplicitCapabilityAndCoverage() throws Exception {
        String sql = Files.readString(Path.of(
                "database/migrations/20260814205530_advanced_stats_compact_capabilities.sql"));

        assertTrue(sql.contains("record_advanced_stats_scope_capability_v1"));
        assertTrue(sql.contains("capability_status"));
        assertTrue(sql.contains("coverage_status"));
        assertTrue(sql.contains("source_adapter_version"));
        assertTrue(sql.contains("'UNSUPPORTED'"));
    }

    @Test
    void scopedReadsPreferSeasonAwareRpcAndKeepV1Fallback() throws Exception {
        String source = Files.readString(Path.of(
                "src/Java/advancedstats/AdvancedStatsReadRepository.java"));

        assertTrue(source.contains("read_advanced_stats_compact_overview_v2"));
        assertTrue(source.contains("read_advanced_stats_compact_units_v2"));
        assertTrue(source.contains("read_advanced_stats_compact_armies_v2"));
        assertTrue(source.contains("read_advanced_stats_compact_trends_v2"));
        assertTrue(source.contains("p_season_key"));
        assertTrue(source.contains("read_advanced_stats_compact_overview_v1"));
        assertTrue(source.contains("legacyScopedBody"));
    }
}

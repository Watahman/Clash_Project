package Java.advancedstats;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class AdvancedStatsCollectorContractTest {
    @Test
    void collectorRepositoryUsesLeaseLifecycleRpcs() throws Exception {
        String source = Files.readString(Path.of(
                "src/Java/advancedstats/AdvancedStatsCollectorRepository.java"
        ));

        assertTrue(source.contains("claim_advanced_stats_trackers_v1"));
        assertTrue(source.contains("complete_advanced_stats_poll_v1"));
        assertTrue(source.contains("fail_advanced_stats_poll_v1"));
        assertTrue(source.contains("p_worker_id"));
        assertTrue(source.contains("p_lease_seconds"));
    }

    @Test
    void internalTriggerIsDisabledByDefaultAndRequiresDedicatedSecret() throws Exception {
        String config = Files.readString(Path.of("src/Java/AdvancedStatsCollectorConfig.java"));
        String endpoint = Files.readString(Path.of("src/Java/AdvancedStatsInternalPoll.java"));

        assertTrue(config.contains("ADVANCED_STATS_COLLECTION_ENABLED\", false"));
        assertTrue(config.contains("ADVANCED_STATS_SCHEDULER_SECRET"));
        assertTrue(config.contains("X-ClashPanel-Scheduler-Secret"));
        assertTrue(config.contains("MessageDigest.isEqual"));

        assertTrue(endpoint.contains("if (!collectorConfig.isEnabled())"));
        assertTrue(endpoint.contains("if (!collectorConfig.hasSchedulerSecret())"));
        assertTrue(endpoint.contains("if (!collectorConfig.isAuthorized(provided))"));
        assertTrue(endpoint.contains("collector.runOnce()"));
    }
}

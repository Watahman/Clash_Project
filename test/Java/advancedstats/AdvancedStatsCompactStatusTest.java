package Java.advancedstats;

import Java.advancedstats.AdvancedStatsCollectionModels.BootstrapStatus;
import Java.advancedstats.AdvancedStatsHistoryModels.Checkpoint;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class AdvancedStatsCompactStatusTest {
    @Test
    void pendingScopeRemainsNonTerminalWhenCapabilityIsPartial() {
        var status = new AdvancedStatsCompactStatusRepository.ScopeStatus(
                AdvancedStatsScope.NORMAL, BootstrapStatus.PENDING,
                AdvancedStatsCapabilityStatus.PARTIAL, "PARTIAL", "", 0, 0, null,
                "coc-battlelog", Checkpoint.initial(), new com.google.gson.JsonObject(), null, "", "");

        assertEquals("PENDING", status.coverage());
    }
}

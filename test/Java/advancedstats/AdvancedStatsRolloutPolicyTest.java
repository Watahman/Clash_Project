package Java.advancedstats;

import Java.HttpException;
import org.junit.jupiter.api.Test;

import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdvancedStatsRolloutPolicyTest {
    private static final UUID DEVELOPER = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID OTHER = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @Test
    void defaultRolloutShapeDeniesNewEnrollment() throws Exception {
        AdvancedStatsRolloutPolicy policy = new AdvancedStatsRolloutPolicy(false, Set.of());

        assertFalse(policy.canStart(DEVELOPER));
        HttpException error = assertThrows(HttpException.class, () -> policy.requireCanStart(DEVELOPER));
        assertEquals(403, error.getStatusCode());
        assertTrue(error.getResponseBody().contains("ADVANCED_STATS_ROLLOUT_RESTRICTED"));
    }

    @Test
    void allowlistEnablesOnlySelectedDeveloperAccounts() {
        AdvancedStatsRolloutPolicy policy = new AdvancedStatsRolloutPolicy(false, Set.of(DEVELOPER));

        assertTrue(policy.canStart(DEVELOPER));
        assertFalse(policy.canStart(OTHER));
        assertDoesNotThrow(() -> policy.requireCanStart(DEVELOPER));
    }

    @Test
    void explicitPublicEnrollmentFlagAllowsAnyAuthenticatedUserId() {
        AdvancedStatsRolloutPolicy policy = new AdvancedStatsRolloutPolicy(true, Set.of());

        assertTrue(policy.canStart(DEVELOPER));
        assertTrue(policy.canStart(OTHER));
        assertFalse(policy.canStart(null));
    }
}
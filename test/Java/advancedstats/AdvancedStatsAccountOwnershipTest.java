package Java.advancedstats;

import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdvancedStatsAccountOwnershipTest {
    @Test
    void matchesExistingLinkedAccountAcrossSupportedShapes() {
        assertTrue(AdvancedStatsAccountOwnership.containsLinkedAccount(
                JsonParser.parseString("[{\"tag\":\"#P0Y8LQ\"}]"),
                "p0y8lq"
        ));
        assertTrue(AdvancedStatsAccountOwnership.containsLinkedAccount(
                JsonParser.parseString("[{\"playerTag\":\"#P0Y8LQ\"}]"),
                "#P0Y8LQ"
        ));
        assertTrue(AdvancedStatsAccountOwnership.containsLinkedAccount(
                JsonParser.parseString("[{\"base\":{\"accountTag\":\"#P0Y8LQ\"}}]"),
                "%23P0Y8LQ"
        ));
        assertTrue(AdvancedStatsAccountOwnership.containsLinkedAccount(
                JsonParser.parseString("[\"#P0Y8LQ\"]"),
                "#P0Y8LQ"
        ));
    }

    @Test
    void rejectsDifferentOrInvalidAccounts() {
        assertFalse(AdvancedStatsAccountOwnership.containsLinkedAccount(
                JsonParser.parseString("[{\"tag\":\"#P0Y8LQ\"}]"),
                "#Q2L9GR"
        ));
        assertFalse(AdvancedStatsAccountOwnership.containsLinkedAccount(
                JsonParser.parseString("[]"),
                "#P0Y8LQ"
        ));
        assertFalse(AdvancedStatsAccountOwnership.containsLinkedAccount(
                JsonParser.parseString("[{\"tag\":\"not-a-tag\"}]"),
                "#P0Y8LQ"
        ));
        assertFalse(AdvancedStatsAccountOwnership.containsLinkedAccount(
                JsonParser.parseString("[{\"tag\":\"#P0Y8LQ\"}]"),
                "bad"
        ));
    }
}

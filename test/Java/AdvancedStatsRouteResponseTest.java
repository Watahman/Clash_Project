package Java;

import Java.advancedstats.AdvancedStatsModels;
import Java.advancedstats.AdvancedStatsTrackingStatus;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdvancedStatsRouteResponseTest {
    @Test
    void missingTrackingReturnsDisabledState() {
        JsonObject response = SUPABASE_AdvancedStats.trackingResponse(Optional.empty());

        assertFalse(response.get("trackingExists").getAsBoolean());
        assertFalse(response.get("enabled").getAsBoolean());
        assertEquals("DISABLED", response.get("status").getAsString());
    }

    @Test
    void stoppedTrackingKeepsHistoryButIsDisabled() {
        JsonObject response = SUPABASE_AdvancedStats.trackingResponse(Optional.of(state(
                AdvancedStatsTrackingStatus.STOPPED,
                Instant.parse("2026-08-07T12:00:00Z")
        )));

        assertTrue(response.get("trackingExists").getAsBoolean());
        assertFalse(response.get("enabled").getAsBoolean());
        assertEquals("STOPPED", response.get("status").getAsString());
        assertTrue(response.get("hasPotentialGap").getAsBoolean());
        assertEquals(12, response.get("battlesProcessed").getAsLong());
    }

    @Test
    void activeTrackingIsEnabled() {
        JsonObject response = SUPABASE_AdvancedStats.trackingResponse(Optional.of(state(
                AdvancedStatsTrackingStatus.ACTIVE,
                null
        )));

        assertTrue(response.get("trackingExists").getAsBoolean());
        assertTrue(response.get("enabled").getAsBoolean());
        assertEquals("ACTIVE", response.get("status").getAsString());
        assertFalse(response.get("hasPotentialGap").getAsBoolean());
    }

    private AdvancedStatsModels.TrackingState state(
            AdvancedStatsTrackingStatus status,
            Instant gapStartedAt
    ) {
        return new AdvancedStatsModels.TrackingState(
                UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
                UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                "#P0Y8LQ",
                "Player",
                17,
                status,
                Instant.parse("2026-08-01T10:00:00Z"),
                null,
                null,
                Instant.parse("2026-08-07T11:55:00Z"),
                null,
                0,
                gapStartedAt,
                Instant.parse("2026-08-01T10:00:00Z"),
                12
        );
    }
}

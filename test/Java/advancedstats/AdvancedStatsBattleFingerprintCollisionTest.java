package Java.advancedstats;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

class AdvancedStatsBattleFingerprintCollisionTest {
    @Test
    void differentPollTimesDoNotCreateFakeNewBattles() {
        assertEquals(
                BattleFingerprint.from(candidate(Instant.parse("2026-08-07T13:00:00Z"), 900000)),
                BattleFingerprint.from(candidate(Instant.parse("2026-08-07T14:00:00Z"), 900000))
        );
    }

    @Test
    void availableLootCanDistinguishOtherwiseMatchingTimestampLessBattles() {
        assertNotEquals(
                BattleFingerprint.from(candidate(Instant.parse("2026-08-07T13:00:00Z"), 900000)),
                BattleFingerprint.from(candidate(Instant.parse("2026-08-07T13:00:00Z"), 900001))
        );
    }

    private AdvancedStatsModels.BattleCandidate candidate(Instant observedAt, long availableGold) {
        return new AdvancedStatsModels.BattleCandidate(
                "#2PYLQ", null, observedAt, true, "multiplayer", "#9GCUV", "Opponent",
                18, 18, 3, 100.0, "u8x110s2x2",
                500000, 400000, 5000,
                availableGold, 800000, 10000
        );
    }
}

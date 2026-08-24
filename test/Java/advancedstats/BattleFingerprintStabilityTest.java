package Java.advancedstats;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;

class BattleFingerprintStabilityTest {
    private static final Instant OBSERVED = Instant.parse("2026-08-07T13:00:00Z");

    @Test
    void trackedPlayerTownHallUpgradeDoesNotDuplicateRecentBattle() {
        assertEquals(
                BattleFingerprint.from(candidate(17, "Old opponent name")),
                BattleFingerprint.from(candidate(18, "Old opponent name"))
        );
    }

    @Test
    void opponentNameChangeDoesNotMatterWhenStableTagExists() {
        assertEquals(
                BattleFingerprint.from(candidate(18, "Old opponent name")),
                BattleFingerprint.from(candidate(18, "New opponent name"))
        );
    }

    private AdvancedStatsModels.BattleCandidate candidate(int playerTownHall, String opponentName) {
        return new AdvancedStatsModels.BattleCandidate(
                "#2PYLQ",
                null,
                OBSERVED,
                true,
                "multiplayer",
                "#9GCUV",
                opponentName,
                18,
                playerTownHall,
                3,
                100.0,
                "u8x110s2x2",
                500000,
                400000,
                5000,
                900000,
                800000,
                10000
        );
    }
}

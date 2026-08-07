package Java.advancedstats;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class BattleFingerprintTest {
    @Test
    void sameBattleProducesSameFingerprint() {
        var first = battle("#2PYLQ", "#9GCUV", "2026-08-07T12:30:00Z", "u1x10-s2x1", 87.5);
        var second = battle("2pylq", "9gcuv", " 2026-08-07T12:30:00Z ", " u1x10-s2x1 ", 87.50);

        String firstHash = BattleFingerprint.from(first);
        String secondHash = BattleFingerprint.from(second);

        assertEquals(firstHash, secondHash);
        assertEquals(64, firstHash.length());
    }

    @Test
    void identityChangesProduceDifferentFingerprints() {
        var base = battle("#2PYLQ", "#9GCUV", "2026-08-07T12:30:00Z", "u1x10-s2x1", 87.5);

        assertNotEquals(
                BattleFingerprint.from(base),
                BattleFingerprint.from(battle("#2PYLQ", "#9GCUV", "2026-08-07T12:31:00Z", "u1x10-s2x1", 87.5))
        );
        assertNotEquals(
                BattleFingerprint.from(base),
                BattleFingerprint.from(battle("#2PYLQ", "#8GCUV", "2026-08-07T12:30:00Z", "u1x10-s2x1", 87.5))
        );
        assertNotEquals(
                BattleFingerprint.from(base),
                BattleFingerprint.from(battle("#2PYLQ", "#9GCUV", "2026-08-07T12:30:00Z", "u1x11-s2x1", 87.5))
        );
        assertNotEquals(
                BattleFingerprint.from(base),
                BattleFingerprint.from(battle("#2PYLQ", "#9GCUV", "2026-08-07T12:30:00Z", "u1x10-s2x1", 88.0))
        );
    }

    @Test
    void modelValidationRejectsImpossibleValues() {
        assertThrows(IllegalArgumentException.class, () -> new AdvancedStatsModels.UnitUsage(
                "root_rider",
                "Root Rider",
                AdvancedStatsUnitCategory.TROOP,
                0,
                3
        ));

        assertThrows(IllegalArgumentException.class, () -> battle(
                "#2PYLQ",
                "#9GCUV",
                "2026-08-07T12:30:00Z",
                "army",
                101.0
        ));
    }

    @Test
    void databaseEnumsAreCaseInsensitiveButStrict() {
        assertEquals(AdvancedStatsTrackingStatus.ACTIVE, AdvancedStatsTrackingStatus.fromDatabase("active"));
        assertEquals(AdvancedStatsUnitCategory.CLAN_CASTLE_TROOP,
                AdvancedStatsUnitCategory.fromDatabase("clan_castle_troop"));
        assertEquals(AdvancedStatsBattleProcessingStatus.PARSER_ERROR,
                AdvancedStatsBattleProcessingStatus.fromDatabase("parser_error"));

        assertThrows(IllegalArgumentException.class,
                () -> AdvancedStatsTrackingStatus.fromDatabase("unknown"));
    }

    private AdvancedStatsModels.BattleIdentity battle(
            String playerTag,
            String opponentTag,
            String timestamp,
            String armyShareCode,
            double destruction
    ) {
        return new AdvancedStatsModels.BattleIdentity(
                playerTag,
                timestamp,
                true,
                "multiplayer",
                opponentTag,
                2,
                destruction,
                armyShareCode
        );
    }
}

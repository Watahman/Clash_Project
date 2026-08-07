package Java.advancedstats;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdvancedStatsFuzzRegressionTest {
    private static final Instant OBSERVED = Instant.parse("2026-08-07T18:00:00Z");

    @Test
    void armyNormalizationIsStableAcrossDeterministicPermutations() throws Exception {
        ArmyShareCodeParser parser = new ArmyShareCodeParser();
        String baseline = parser.parse("u10x0-2x5-3x999s3x2-1x999").normalizedArmyHash();
        Random random = new Random(0xC1A5_2026L);

        for (int iteration = 0; iteration < 250; iteration++) {
            List<String> troops = new ArrayList<>(List.of("10x0", "2x5", "3x999"));
            List<String> spells = new ArrayList<>(List.of("3x2", "1x999"));
            Collections.shuffle(troops, random);
            Collections.shuffle(spells, random);

            String troopSection = "u" + String.join("-", troops);
            String spellSection = "s" + String.join("-", spells);
            String payload = random.nextBoolean()
                    ? troopSection + spellSection
                    : spellSection + troopSection;

            assertEquals(baseline, parser.parse(payload).normalizedArmyHash(), payload);
        }
    }

    @Test
    void unknownIdsRemainStableAcrossAWideRange() throws Exception {
        ArmyShareCodeParser parser = new ArmyShareCodeParser();

        for (int id = 500; id < 700; id++) {
            var army = parser.parse("u1x" + id + "s1x" + id);
            int troopAbsoluteId = 4_000_000 + id;
            int spellAbsoluteId = 26_000_000 + id;

            assertTrue(army.units().stream().anyMatch(unit ->
                    unit.unitKey().equals("unknown_" + troopAbsoluteId)
                            && unit.category() == AdvancedStatsUnitCategory.TROOP));
            assertTrue(army.units().stream().anyMatch(unit ->
                    unit.unitKey().equals("unknown_" + spellAbsoluteId)
                            && unit.category() == AdvancedStatsUnitCategory.SPELL));
        }
    }

    @Test
    void timestampLessFingerprintIsStableAcrossManyPollTimes() {
        String expected = BattleFingerprint.from(candidate(OBSERVED, 900_000, "multiplayer", "u8x110s2x2"));

        for (int minute = 1; minute <= 500; minute++) {
            assertEquals(
                    expected,
                    BattleFingerprint.from(candidate(
                            OBSERVED.plusSeconds(minute * 60L),
                            900_000,
                            "multiplayer",
                            "u8x110s2x2"
                    ))
            );
        }
    }

    @Test
    void changingStableIdentityFieldsProducesDistinctFingerprintsAcrossLargeSample() {
        Set<String> fingerprints = new HashSet<>();
        for (int value = 0; value < 2_000; value++) {
            String fingerprint = BattleFingerprint.from(candidate(
                    OBSERVED,
                    1_000_000L + value,
                    "multiplayer",
                    "u8x110s2x2"
            ));
            assertTrue(fingerprints.add(fingerprint), "duplicate fingerprint at value=" + value);
        }
        assertEquals(2_000, fingerprints.size());
    }

    @Test
    void delimiterEscapingKeepsDistinctTuplesDistinct() {
        String first = BattleFingerprint.from(candidate(
                OBSERVED,
                900_000,
                "multi|player\\variant",
                "u1x0|s1x2"
        ));
        String second = BattleFingerprint.from(candidate(
                OBSERVED,
                900_000,
                "multi",
                "player\\variant|u1x0|s1x2"
        ));

        assertNotEquals(first, second);
    }

    private AdvancedStatsModels.BattleCandidate candidate(
            Instant observedAt,
            long availableGold,
            String battleType,
            String armyShareCode
    ) {
        return new AdvancedStatsModels.BattleCandidate(
                "#2PYLQ",
                null,
                observedAt,
                true,
                battleType,
                "#9GCUV",
                "Opponent",
                18,
                18,
                3,
                100.0,
                armyShareCode,
                500_000,
                400_000,
                5_000,
                availableGold,
                800_000,
                10_000
        );
    }
}

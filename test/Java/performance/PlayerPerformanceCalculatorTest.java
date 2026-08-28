package Java.performance;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class PlayerPerformanceCalculatorTest {
    private static final Instant NOW = Instant.parse("2026-07-26T12:00:00Z");
    private final PlayerPerformanceCalculator calculator =
            new PlayerPerformanceCalculator(Clock.fixed(NOW, ZoneOffset.UTC));

    @Test
    void appliesQualityDifficultyRecencyAndDocumentedConfidenceThresholds() {
        List<HistoricalAttack> attacks = new ArrayList<>();
        List<HistoricalParticipation> participation = new ArrayList<>();
        for (int index = 0; index < 15; index++) {
            Instant time = NOW.minus(index * 3L, ChronoUnit.DAYS);
            attacks.add(attack(HistoricalWarType.CWL, time, 17, 17, 3, 100));
            participation.add(new HistoricalParticipation(
                    "#P0L", HistoricalWarType.CWL, time, 1, index == 14 ? 0 : 1,
                    "war-" + index, true
            ));
        }

        PlayerPerformanceResult result = calculator.calculate(new HistoricalPlayerData(
                "#P0L", attacks, participation, "test", true
        ));

        assertEquals("CWL", result.scope());
        assertEquals(100.0, result.performance());
        assertEquals(3.0, result.avgStars());
        assertEquals(100.0, result.tripleRate());
        assertEquals("High", result.confidence());
        assertEquals("stable", result.form().trend());
        assertEquals(14, result.usedAttacks());
        assertEquals(15, result.availableAttacks());
        assertNotNull(result.reliability());
        assertTrue(result.reliability() < 100);
    }

    @Test
    void rewardsUpHitsWithoutExceedingTheNormalizedScale() {
        PlayerPerformanceResult result = calculator.calculate(new HistoricalPlayerData(
                "#P0L",
                List.of(attack(HistoricalWarType.REGULAR, NOW, 16, 17, 3, 100)),
                List.of(),
                "test",
                true
        ));

        assertEquals(100.0, result.performance());
        assertEquals(1, result.upHitCount());
        assertNull(result.reliability());
        assertEquals(
                "insufficient_tracked_participation",
                result.reliabilityMessage()
        );
    }

    @Test
    void prefersCwlOnlyWhenAtLeastFiveCwlAttacksExist() {
        List<HistoricalAttack> attacks = new ArrayList<>();
        for (int index = 0; index < 5; index++) {
            attacks.add(attack(
                    HistoricalWarType.CWL, NOW.minus(index, ChronoUnit.DAYS),
                    17, 17, 3, 100
            ));
        }
        attacks.add(attack(HistoricalWarType.REGULAR, NOW, 17, 17, 0, 0));

        PlayerPerformanceResult result = calculator.calculate(new HistoricalPlayerData(
                "#P0L", attacks, List.of(), "test", true
        ));

        assertEquals("CWL", result.scope());
        assertEquals(5, result.attackCount());
        assertEquals(100.0, result.performance());
    }

    @Test
    void ignoresCwlOutsideTheBaselineWhenChoosingThePerformanceScope() {
        List<HistoricalAttack> attacks = new ArrayList<>();
        for (int index = 0; index < 5; index++) {
            attacks.add(attack(
                    HistoricalWarType.CWL, NOW.minus(91L + index, ChronoUnit.DAYS),
                    17, 17, 3, 100
            ));
        }
        attacks.add(attack(HistoricalWarType.REGULAR, NOW, 17, 17, 2, 80));

        PlayerPerformanceResult result = calculator.calculate(new HistoricalPlayerData(
                "#P0L", attacks, List.of(), "test", true
        ));

        assertEquals("All wars", result.scope());
        assertEquals(1, result.attackCount());
        assertEquals(2.0, result.avgStars());
    }

    private HistoricalAttack attack(
            HistoricalWarType type,
            Instant time,
            int attackerTownHall,
            int defenderTownHall,
            int stars,
            double destruction
    ) {
        return new HistoricalAttack(
                "#P0L", type, time, attackerTownHall, defenderTownHall,
                stars, destruction, 1, "war"
        );
    }
}

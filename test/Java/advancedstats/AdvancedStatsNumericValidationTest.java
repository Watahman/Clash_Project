package Java.advancedstats;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertThrows;

class AdvancedStatsNumericValidationTest {
    private static final Instant OBSERVED = Instant.parse("2026-08-07T18:00:00Z");

    @Test
    void battleCandidateRejectsNonFiniteDestruction() {
        assertThrows(IllegalArgumentException.class, () -> candidate(Double.NaN));
        assertThrows(IllegalArgumentException.class, () -> candidate(Double.POSITIVE_INFINITY));
        assertThrows(IllegalArgumentException.class, () -> candidate(Double.NEGATIVE_INFINITY));
    }

    @Test
    void battleLogParserRejectsStringEncodedNaNInsteadOfReachingFingerprinting() {
        String payload = """
                [{
                  "attack": true,
                  "battleType": "multiplayer",
                  "opponentPlayerTag": "#9GCUV",
                  "stars": 2,
                  "destructionPercentage": "NaN"
                }]
                """;

        assertThrows(
                IllegalArgumentException.class,
                () -> new AdvancedStatsBattleLogParser().parse("#2PYLQ", payload, OBSERVED, 18)
        );
    }

    @Test
    void processedDeltaRejectsNonFiniteDestruction() {
        assertThrows(IllegalArgumentException.class, () -> new AdvancedStatsModels.ProcessedBattleDelta(
                "a".repeat(64),
                OBSERVED,
                "multiplayer",
                2,
                Double.NaN,
                List.of(),
                "b".repeat(64),
                false
        ));
    }

    @Test
    void dailyAggregateRejectsNonFiniteTotals() {
        assertThrows(IllegalArgumentException.class, () -> new AdvancedStatsModels.DailyAggregate(
                LocalDate.of(2026, 8, 7),
                1,
                2,
                Double.NaN,
                0,
                1,
                0,
                0,
                1,
                1,
                1
        ));
    }

    private AdvancedStatsModels.BattleCandidate candidate(double destruction) {
        return new AdvancedStatsModels.BattleCandidate(
                "#2PYLQ",
                null,
                OBSERVED,
                true,
                "multiplayer",
                "#9GCUV",
                "Opponent",
                18,
                18,
                2,
                destruction,
                "",
                0,
                0,
                0,
                0,
                0,
                0
        );
    }
}

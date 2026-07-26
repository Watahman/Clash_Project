package Java.performance;

import java.time.Instant;

public record HistoricalAttack(
        String playerTag,
        HistoricalWarType warType,
        Instant warEndTime,
        int attackerTownHall,
        int defenderTownHall,
        int stars,
        double destruction,
        Integer attackOrder,
        String warId
) {}

package Java.performance;

import java.time.Instant;

public record HistoricalParticipation(
        String playerTag,
        HistoricalWarType warType,
        Instant warEndTime,
        int availableAttacks,
        int usedAttacks,
        String warId,
        boolean reliable
) {}

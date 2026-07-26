package Java.performance;

import java.util.List;

public record HistoricalPlayerData(
        String playerTag,
        List<HistoricalAttack> attacks,
        List<HistoricalParticipation> participation,
        String source,
        boolean available
) {
    public HistoricalPlayerData {
        attacks = attacks == null ? List.of() : List.copyOf(attacks);
        participation = participation == null ? List.of() : List.copyOf(participation);
        source = source == null ? "" : source;
    }

    public static HistoricalPlayerData unavailable(String playerTag, String source) {
        return new HistoricalPlayerData(playerTag, List.of(), List.of(), source, false);
    }
}

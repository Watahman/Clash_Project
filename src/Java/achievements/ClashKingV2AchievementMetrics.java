package Java.achievements;

import Java.Config;

import java.util.LinkedHashMap;
import java.util.Map;

/** Public facade for fetching and reducing ClashKing V2 achievement evidence. */
public final class ClashKingV2AchievementMetrics {
    private final ClashKingV2WarAchievementProvider provider;

    public ClashKingV2AchievementMetrics(Config config) {
        this.provider = new ClashKingV2WarAchievementProvider(config);
    }

    public ClashKingV2AchievementMetrics(String baseUrl) {
        this.provider = new ClashKingV2WarAchievementProvider(baseUrl);
    }

    public Result collect(String playerTag) {
        ClashKingV2WarAchievementProvider.Snapshot snapshot = provider.fetch(playerTag);
        return reduce(snapshot);
    }

    public static Result reduce(ClashKingV2WarAchievementProvider.Snapshot snapshot) {
        if (snapshot == null) return Result.empty();
        Map<String, Long> metrics = new LinkedHashMap<>();
        metrics.putAll(ClashKingV2WarAchievementReducer.reduce(snapshot.war(), snapshot.playerTag()));
        metrics.putAll(ClashKingV2CwlAchievementReducer.reduce(snapshot.cwl(), snapshot.playerTag()));
        return new Result(
                Map.copyOf(metrics),
                snapshot.war().available(),
                snapshot.cwl().available(),
                snapshot.war().error(),
                snapshot.cwl().error()
        );
    }

    public record Result(
            Map<String, Long> metrics,
            boolean warAvailable,
            boolean cwlAvailable,
            String warError,
            String cwlError
    ) {
        public Result {
            metrics = metrics == null ? Map.of() : Map.copyOf(metrics);
            warError = warError == null ? "" : warError;
            cwlError = cwlError == null ? "" : cwlError;
        }

        static Result empty() {
            return new Result(Map.of(), false, false, "NOT_REQUESTED", "NOT_REQUESTED");
        }
    }
}

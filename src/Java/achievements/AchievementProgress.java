package Java.achievements;

public record AchievementProgress(
        AchievementDefinition definition,
        long progress,
        boolean unlocked,
        boolean measurable
) {
    public AchievementProgress(AchievementDefinition definition, long progress, boolean unlocked) {
        this(definition, progress, unlocked, true);
    }
}

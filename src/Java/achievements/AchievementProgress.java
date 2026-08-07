package Java.achievements;

public record AchievementProgress(
        AchievementDefinition definition,
        long progress,
        boolean unlocked
) {}

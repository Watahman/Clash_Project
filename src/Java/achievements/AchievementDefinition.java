package Java.achievements;

public record AchievementDefinition(
        String key,
        String familyKey,
        String title,
        String description,
        String category,
        String rarity,
        String metric,
        long target,
        int tier,
        int xp
) {}

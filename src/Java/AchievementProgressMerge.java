package Java;

import Java.achievements.AchievementSpecV2Bindings;
import Java.achievements.AchievementSpecV2Catalog;

/** Pure merge rules for monotonic achievement progress. */
public final class AchievementProgressMerge {
    private AchievementProgressMerge() {}

    public static long best(String achievementKey, long current, long stored) {
        long safeCurrent = Math.max(0, current);
        long safeStored = Math.max(0, stored);
        if (!isLowerBetter(achievementKey)) return Math.max(safeCurrent, safeStored);
        if (safeCurrent == 0) return safeStored;
        if (safeStored == 0) return safeCurrent;
        return Math.min(safeCurrent, safeStored);
    }

    public static boolean improved(String achievementKey, long current, long stored) {
        long safeCurrent = Math.max(0, current);
        long safeStored = Math.max(0, stored);
        if (safeCurrent == 0) return false;
        if (!isLowerBetter(achievementKey)) return safeCurrent > safeStored;
        return safeStored == 0 || safeCurrent < safeStored;
    }

    private static boolean isLowerBetter(String achievementKey) {
        AchievementSpecV2Catalog.Metadata metadata = AchievementSpecV2Catalog.metadata(achievementKey);
        return metadata != null && metadata.comparison() == AchievementSpecV2Bindings.Comparison.LTE;
    }
}

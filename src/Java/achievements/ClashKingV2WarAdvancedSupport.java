package Java.achievements;

import java.util.List;
import java.util.Map;

/** Math helpers shared by the regular-war family reducer. */
final class ClashKingV2WarAdvancedSupport {
    private ClashKingV2WarAdvancedSupport() {}

    static long maxStreak(List<Integer> values, int minimum) {
        long current = 0;
        long best = 0;
        for (int value : values) {
            current = value >= minimum ? current + 1 : 0;
            best = Math.max(best, current);
        }
        return best;
    }

    static long maxBelow(List<Integer> values, int exclusive) {
        long current = 0;
        long best = 0;
        for (int value : values) {
            current = value >= 0 && value < exclusive ? current + 1 : 0;
            best = Math.max(best, current);
        }
        return best;
    }

    static long maxExactStreak(List<Integer> values, int expected) {
        long current = 0;
        long best = 0;
        for (int value : values) {
            current = value == expected ? current + 1 : 0;
            best = Math.max(best, current);
        }
        return best;
    }

    static long maxBooleanStreak(List<Boolean> values) {
        long current = 0;
        long best = 0;
        for (boolean value : values) {
            current = value ? current + 1 : 0;
            best = Math.max(best, current);
        }
        return best;
    }

    static void put(Map<String, Long> result, String key, long value, boolean measurable) {
        if (measurable) result.put(key, Math.max(0, value));
    }

    static long scaled(double value) {
        return Math.max(0, Math.round(value * 100));
    }

    static long average(long total, long samples) {
        return samples <= 0 ? 0 : Math.round((double) total / samples);
    }

    static long rate(long numerator, long denominator) {
        return denominator <= 0 ? 0 : Math.round(10000d * numerator / denominator);
    }
}

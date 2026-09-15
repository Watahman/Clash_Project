package Java.achievements;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/** Shared war-only math that is deliberately absent from transport code. */
final class ClashKingV2WarAchievementSupport {
    private static final DateTimeFormatter CLASH_TIME =
            DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss.SSS'Z'");

    private ClashKingV2WarAchievementSupport() {}

    static void putStreaks(Map<String, Long> result, List<Outcome> outcomes) {
        List<Outcome> ordered = outcomes.stream()
                .sorted(Comparator.comparing(Outcome::when, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparingInt(Outcome::order))
                .toList();
        long current = 0;
        long best = 0;
        for (Outcome outcome : ordered) {
            current = outcome.result() > 0 ? current + 1 : 0;
            best = Math.max(best, current);
        }
        result.put("war_current_win_streak", current);
        result.put("war_best_win_streak", best);
    }

    static Instant timestamp(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return Instant.parse(value);
        } catch (DateTimeParseException ignored) {
            try {
                return LocalDateTime.parse(value, CLASH_TIME).toInstant(ZoneOffset.UTC);
            } catch (DateTimeParseException invalid) {
                return null;
            }
        }
    }

    record Outcome(int result, Instant when, int order) {}
}

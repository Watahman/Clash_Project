package Java;

import Java.advancedstats.AdvancedStatsScheduledCollector;
import Java.advancedstats.AdvancedStatsCompactScheduledCollector;
import io.github.cdimascio.dotenv.Dotenv;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;

/**
 * Internal-only collector configuration. It is intentionally separate from the
 * browser-facing endpoint config and defaults to disabled until rollout.
 */
public final class AdvancedStatsCollectorConfig {
    public static final String SECRET_HEADER = "X-ClashPanel-Scheduler-Secret";

    private static final Dotenv DOTENV = Dotenv.configure()
            .ignoreIfMissing()
            .load();

    private final boolean enabled = bool("ADVANCED_STATS_COLLECTION_ENABLED", false);
    private final String schedulerSecret = env("ADVANCED_STATS_SCHEDULER_SECRET");

    public boolean isEnabled() {
        return enabled;
    }

    public boolean hasSchedulerSecret() {
        return schedulerSecret != null && !schedulerSecret.isBlank();
    }

    public boolean isAuthorized(String providedSecret) {
        if (!hasSchedulerSecret() || providedSecret == null || providedSecret.isBlank()) return false;
        return MessageDigest.isEqual(
                schedulerSecret.getBytes(StandardCharsets.UTF_8),
                providedSecret.getBytes(StandardCharsets.UTF_8)
        );
    }

    public AdvancedStatsScheduledCollector.Settings settings() {
        return new AdvancedStatsScheduledCollector.Settings(
                boundedInt("ADVANCED_STATS_BATCH_SIZE", 25, 1, 500),
                boundedInt("ADVANCED_STATS_LEASE_SECONDS", 600, 30, 900),
                Duration.ofMinutes(boundedInt("ADVANCED_STATS_ACTIVE_POLL_MINUTES", 15, 5, 120)),
                Duration.ofMinutes(boundedInt("ADVANCED_STATS_IDLE_POLL_MINUTES", 30, 10, 240)),
                Duration.ofMinutes(boundedInt("ADVANCED_STATS_RATE_LIMIT_BACKOFF_MINUTES", 30, 5, 240)),
                Duration.ofMinutes(boundedInt("ADVANCED_STATS_OUTAGE_BACKOFF_MINUTES", 10, 2, 240)),
                Duration.ofMinutes(boundedInt("ADVANCED_STATS_UNKNOWN_BACKOFF_MINUTES", 15, 2, 240)),
                Duration.ofMinutes(boundedInt("ADVANCED_STATS_MAX_BACKOFF_MINUTES", 240, 30, 1440)),
                boundedInt("ADVANCED_STATS_DEGRADED_THRESHOLD", 3, 2, 20)
        );
    }

    public AdvancedStatsCompactScheduledCollector.Settings compactSettings() {
        AdvancedStatsScheduledCollector.Settings legacy = settings();
        return new AdvancedStatsCompactScheduledCollector.Settings(
                legacy.batchSize(),
                boundedInt("ADVANCED_STATS_PAGE_SIZE", 500, 1, 500),
                boundedInt("ADVANCED_STATS_MAX_BOOTSTRAP_PAGES", 20, 1, 1000),
                legacy.leaseSeconds(),
                legacy.activePollDelay(),
                legacy.idlePollDelay()
        );
    }

    private static boolean bool(String name, boolean fallback) {
        String value = env(name);
        if (value == null || value.isBlank()) return fallback;
        return "true".equalsIgnoreCase(value.trim());
    }

    private static int boundedInt(String name, int fallback, int minimum, int maximum) {
        String value = env(name);
        if (value == null || value.isBlank()) return fallback;
        try {
            return Math.max(minimum, Math.min(Integer.parseInt(value.trim()), maximum));
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private static String env(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) value = DOTENV.get(name);
        if (value == null) return null;
        String trimmed = value.trim();
        if (trimmed.length() >= 2) {
            char first = trimmed.charAt(0);
            char last = trimmed.charAt(trimmed.length() - 1);
            if ((first == '\'' && last == '\'') || (first == '"' && last == '"')) {
                return trimmed.substring(1, trimmed.length() - 1).trim();
            }
        }
        return trimmed;
    }
}

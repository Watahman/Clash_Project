package Java.advancedstats;

import Java.HttpException;
import io.github.cdimascio.dotenv.Dotenv;

import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Server-side enrollment gate for staged Advanced Stats rollout.
 * Collection has its own independent kill switch; this policy only controls
 * creation of new tracking rows.
 */
public final class AdvancedStatsRolloutPolicy {
    static final String PUBLIC_ENROLLMENT_ENV = "ADVANCED_STATS_PUBLIC_ENROLLMENT_ENABLED";
    static final String ALLOWLIST_ENV = "ADVANCED_STATS_ROLLOUT_USER_IDS";

    private static final Dotenv DOTENV = Dotenv.configure()
            .ignoreIfMissing()
            .load();

    private final boolean publicEnrollmentEnabled;
    private final Set<UUID> allowedUserIds;

    public AdvancedStatsRolloutPolicy() {
        this(
                booleanEnv(PUBLIC_ENROLLMENT_ENV, false),
                parseUserIds(env(ALLOWLIST_ENV))
        );
    }

    AdvancedStatsRolloutPolicy(boolean publicEnrollmentEnabled, Set<UUID> allowedUserIds) {
        this.publicEnrollmentEnabled = publicEnrollmentEnabled;
        this.allowedUserIds = Set.copyOf(allowedUserIds == null ? Set.of() : allowedUserIds);
    }

    public boolean canStart(UUID userId) {
        return userId != null && (publicEnrollmentEnabled || allowedUserIds.contains(userId));
    }

    public void requireCanStart(UUID userId) throws HttpException {
        if (canStart(userId)) return;
        throw new HttpException(
                403,
                "{\"error\":\"Advanced Stats is not enabled for this account yet\",\"code\":\"ADVANCED_STATS_ROLLOUT_RESTRICTED\"}"
        );
    }

    private static Set<UUID> parseUserIds(String raw) {
        if (raw == null || raw.isBlank()) return Set.of();
        Set<UUID> ids = new LinkedHashSet<>();
        for (String token : raw.split(",")) {
            String value = token.trim();
            if (value.isEmpty()) continue;
            try {
                ids.add(UUID.fromString(value));
            } catch (IllegalArgumentException invalid) {
                throw new IllegalStateException(
                        ALLOWLIST_ENV + " contains an invalid UUID",
                        invalid
                );
            }
        }
        return Set.copyOf(ids);
    }

    private static boolean booleanEnv(String name, boolean fallback) {
        String value = env(name);
        if (value == null || value.isBlank()) return fallback;
        return "true".equalsIgnoreCase(value.trim());
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
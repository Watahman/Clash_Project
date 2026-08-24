package Java.advancedstats;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;

/** Canonical period filters exposed by the Advanced Stats read API. */
public enum AdvancedStatsPeriod {
    SEVEN_DAYS("7d", Duration.ofDays(7)),
    THIRTY_DAYS("30d", Duration.ofDays(30)),
    NINETY_DAYS("90d", Duration.ofDays(90)),
    ALL("all", null);

    private final String apiValue;
    private final Duration lookback;

    AdvancedStatsPeriod(String apiValue, Duration lookback) {
        this.apiValue = apiValue;
        this.lookback = lookback;
    }

    public String apiValue() {
        return apiValue;
    }

    public Instant from(Instant now) {
        if (now == null) throw new IllegalArgumentException("now is required");
        return lookback == null ? null : now.minus(lookback);
    }

    public static AdvancedStatsPeriod parse(String raw) {
        if (raw == null || raw.isBlank()) return ALL;
        String normalized = raw.trim().toLowerCase(Locale.ROOT);
        for (AdvancedStatsPeriod period : values()) {
            if (period.apiValue.equals(normalized)) return period;
        }
        throw new IllegalArgumentException("Ongeldige Advanced Stats periode: " + raw);
    }
}

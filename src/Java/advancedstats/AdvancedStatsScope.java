package Java.advancedstats;

import java.util.Locale;

/** Logical Advanced Stats scopes. Provider routes are deliberately not part of this contract. */
public enum AdvancedStatsScope {
    NORMAL("normal"),
    WAR("war"),
    RANKED("ranked");

    /** Source-compatible alias for the former grouped ranked/legend label. */
    @Deprecated
    public static final AdvancedStatsScope RANKED_LEGEND = RANKED;

    private final String apiValue;

    AdvancedStatsScope(String apiValue) {
        this.apiValue = apiValue;
    }

    public String apiValue() {
        return apiValue;
    }

    public static AdvancedStatsScope parse(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("Advanced Stats scope is required");
        }
        String value = raw.trim().toLowerCase(Locale.ROOT).replace('-', '_').replace('/', '_');
        if (value.equals("ranked") || value.equals("legend") || value.equals("rankedlegend")
                || value.equals("ranked_legend")) {
            return RANKED;
        }
        for (AdvancedStatsScope scope : values()) {
            if (scope.apiValue.equals(value)) return scope;
        }
        throw new IllegalArgumentException("Unsupported Advanced Stats scope: " + raw);
    }
}

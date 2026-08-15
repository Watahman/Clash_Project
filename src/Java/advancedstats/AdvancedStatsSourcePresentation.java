package Java.advancedstats;

import java.util.Locale;

/** Maps internal adapter identifiers to stable, user-facing source labels. */
public record AdvancedStatsSourcePresentation(String kind, String label) {
    public AdvancedStatsSourcePresentation {
        kind = normalize(kind);
        label = normalize(label);
        if (kind.isBlank() || label.isBlank()) throw new IllegalArgumentException("source presentation is required");
    }

    public static AdvancedStatsSourcePresentation fromInternalId(String sourceId) {
        String value = normalize(sourceId).toLowerCase(Locale.ROOT);
        if (value.contains("clashking-v2") || value.contains("clashking_v2") || value.equals("v2")) {
            return new AdvancedStatsSourcePresentation("CLASHKING_V2", "ClashKing V2");
        }
        if (value.contains("coc-battlelog") || value.contains("official")
                || value.contains("official_battlelog")) {
            return new AdvancedStatsSourcePresentation("OFFICIAL_BATTLELOG", "Official battle log");
        }
        if (value.contains("legacy") || value.contains("historical")
                || value.contains("legacy_war_history")) {
            return new AdvancedStatsSourcePresentation("LEGACY_WAR_HISTORY", "Legacy war history");
        }
        return new AdvancedStatsSourcePresentation("UNKNOWN", "Source unavailable");
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}

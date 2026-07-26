package Java.performance;

public enum HistoricalWarType {
    CWL,
    REGULAR,
    UNKNOWN;

    static HistoricalWarType from(String value) {
        String normalized = value == null ? "" : value.trim().toLowerCase();
        if (normalized.contains("cwl") || normalized.contains("league")) return CWL;
        if (normalized.contains("random") || normalized.contains("regular")
                || normalized.contains("classic")) return REGULAR;
        return UNKNOWN;
    }
}

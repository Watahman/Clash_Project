package Java.advancedstats;

public enum AdvancedStatsTrackingStatus {
    INITIALIZING,
    ACTIVE,
    PAUSED,
    DEGRADED,
    STOPPED,
    ERROR;

    public static AdvancedStatsTrackingStatus fromDatabase(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Advanced Stats status is required");
        }
        return AdvancedStatsTrackingStatus.valueOf(value.trim().toUpperCase());
    }
}

package Java.advancedstats;

/** Explicit availability state; PARTIAL must never be silently treated as complete coverage. */
public enum AdvancedStatsCapabilityStatus {
    UNKNOWN,
    SUPPORTED,
    PARTIAL,
    UNSUPPORTED;

    public boolean usable() {
        return this == SUPPORTED || this == PARTIAL;
    }
}

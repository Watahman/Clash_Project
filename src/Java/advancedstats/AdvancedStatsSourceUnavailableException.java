package Java.advancedstats;

/** Signals that a declared source was temporarily unavailable and another capability source may be tried. */
public final class AdvancedStatsSourceUnavailableException extends Exception {
    public AdvancedStatsSourceUnavailableException(String message) {
        super(message);
    }
}

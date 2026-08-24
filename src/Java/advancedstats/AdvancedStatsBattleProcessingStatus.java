package Java.advancedstats;

public enum AdvancedStatsBattleProcessingStatus {
    PENDING,
    PROCESSED,
    PARSER_ERROR,
    IGNORED;

    public static AdvancedStatsBattleProcessingStatus fromDatabase(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Advanced Stats battle processing status is required");
        }
        return AdvancedStatsBattleProcessingStatus.valueOf(value.trim().toUpperCase());
    }
}

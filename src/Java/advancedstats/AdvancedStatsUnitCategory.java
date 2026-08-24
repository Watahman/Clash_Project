package Java.advancedstats;

public enum AdvancedStatsUnitCategory {
    TROOP,
    SPELL,
    SIEGE,
    SUPER_TROOP,
    CLAN_CASTLE_TROOP,
    CLAN_CASTLE_SPELL,
    HERO,
    PET,
    EQUIPMENT;

    public static AdvancedStatsUnitCategory fromDatabase(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Advanced Stats unit category is required");
        }
        return AdvancedStatsUnitCategory.valueOf(value.trim().toUpperCase());
    }
}

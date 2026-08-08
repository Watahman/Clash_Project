package Java.achievements;

public final class AchievementSources {
    public static final String LIVE_PROFILE = "live_profile";
    public static final String BASE_DATA = "base_data";
    public static final String BASE_HISTORY = "base_history";
    public static final String ADVANCED_STATS = "advanced_stats";
    public static final String WAR = "war";
    public static final String CWL = "cwl_history";
    public static final String CLASHPANEL = "clashpanel";
    public static final String CLAN_FAMILY = "clan_family";
    public static final String MIXED = "mixed";

    private AchievementSources() {}

    public static String forMetric(String metric) {
        String value = metric == null ? "" : metric;
        if (value.startsWith("profile_") || value.startsWith("native_") || value.startsWith("mastery_")) return LIVE_PROFILE;
        if (value.startsWith("war_current_") || value.startsWith("war_recorded_")) return WAR;
        if (value.startsWith("cwl_")) return CWL;
        if (value.startsWith("clashpanel_") || value.equals("war_assignment_count")) return CLASHPANEL;
        if (value.startsWith("family_")) return CLAN_FAMILY;
        if (value.startsWith("fun_")) return MIXED;
        if (isAdvancedStatsMetric(value)) return ADVANCED_STATS;
        if (value.startsWith("tracked_")) return BASE_HISTORY;
        if (value.equals("snapshot_import_count")) return BASE_HISTORY;
        return BASE_DATA;
    }

    private static boolean isAdvancedStatsMetric(String metric) {
        return metric.startsWith("tracked_attack_")
                || metric.equals("tracked_attack_count")
                || metric.startsWith("tracked_star_")
                || metric.equals("tracked_star_count")
                || metric.startsWith("tracked_three_star_")
                || metric.equals("tracked_three_star_count")
                || metric.startsWith("tracked_two_star_")
                || metric.startsWith("tracked_one_star_")
                || metric.startsWith("tracked_zero_star_")
                || metric.startsWith("tracked_gold_looted")
                || metric.startsWith("tracked_elixir_looted")
                || metric.startsWith("tracked_dark_elixir_looted")
                || metric.startsWith("tracked_active_days");
    }
}

package Java.achievements;

import java.util.List;

public final class AchievementSources {
    public static final String LIVE_PROFILE = "live_profile";
    public static final String BASE_DATA = "base_data";
    public static final String BASE_HISTORY = "base_history";
    public static final String ADVANCED_STATS = "advanced_stats";
    public static final String WAR = "war";
    public static final String CWL = "cwl_history";
    public static final String RAID_HISTORY = "raid_history";
    public static final String LEGEND_HISTORY = "legend_history";
    public static final String CLASHKING_HISTORY = "clashking_history";
    public static final String CLAN_PROFILE = "clan_profile";
    public static final String CLASHPANEL = "clashpanel";
    public static final String CLAN_FAMILY = "clan_family";
    public static final String MIXED = "mixed";

    private AchievementSources() {}

    public static String forDefinition(AchievementDefinition definition) {
        if (definition == null) return MIXED;
        AchievementSpecV2Catalog.Metadata metadata = AchievementSpecV2Catalog.metadata(definition.key());
        if (metadata == null) return forMetric(definition.metric());

        if (metadata.measurableRule() && !definition.metric().startsWith("spec:")) {
            return forMetric(definition.metric());
        }

        String mode = metadata.evaluationMode();
        if ("IMPORT_CURRENT".equals(mode)) return BASE_DATA;
        if ("IMPORT_HISTORY".equals(mode)) return BASE_HISTORY;
        if ("APP".equals(mode)) {
            return metadata.sourceCodes().contains("CP-F") && !metadata.sourceCodes().contains("CP-U")
                    ? CLAN_FAMILY : CLASHPANEL;
        }

        String category = definition.category();
        if (category.startsWith("regular_war_")) return WAR;
        if ("clan_war_league".equals(category)) return CWL;
        if ("clan_capital_and_raids".equals(category)) return RAID_HISTORY;
        if ("legend_and_ranked_performance".equals(category)) return LEGEND_HISTORY;
        if ("clan_family_achievements".equals(category)) return CLAN_FAMILY;
        if ("clashpanel_workflow".equals(category)) return CLASHPANEL;
        if ("clan_achievements".equals(category) || "clan_loyalty_and_social".equals(category)) return CLAN_PROFILE;

        List<String> codes = metadata.sourceCodes();
        if (codes.contains("CK-L")) return LEGEND_HISTORY;
        if (codes.contains("CK-R") || codes.contains("COC-R")) return RAID_HISTORY;
        if (codes.contains("CK-W") || codes.contains("COC-W") || codes.contains("COC-WL")) return WAR;
        if (codes.stream().anyMatch(code -> code.startsWith("CK-"))) return CLASHKING_HISTORY;
        if (codes.contains("COC-C")) return CLAN_PROFILE;
        if (codes.contains("COC-P")) return LIVE_PROFILE;
        if (codes.contains("CP-F")) return CLAN_FAMILY;
        if (codes.contains("CP-U")) return CLASHPANEL;
        return MIXED;
    }

    public static String forMetric(String metric) {
        String value = metric == null ? "" : metric;
        if (value.startsWith("profile_") || value.startsWith("native_") || value.startsWith("official:")) return LIVE_PROFILE;
        if (value.startsWith("war_current_") || value.startsWith("war_recorded_")) return WAR;
        if (value.startsWith("cwl_")) return CWL;
        if (value.startsWith("clashpanel_") || value.equals("war_assignment_count")) return CLASHPANEL;
        if (value.startsWith("family_")) return CLAN_FAMILY;
        if (value.startsWith("fun_")) return MIXED;
        if (isAdvancedStatsMetric(value)) return ADVANCED_STATS;
        if (value.startsWith("tracked_") || value.equals("snapshot_import_count")) return BASE_HISTORY;
        if (value.startsWith("spec:")) return MIXED;
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

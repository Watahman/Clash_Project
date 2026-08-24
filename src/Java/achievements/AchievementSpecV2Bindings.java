package Java.achievements;

import com.google.gson.JsonElement;

/**
 * Maps only v2 rules that ClashPanel can currently prove from already-normalized
 * evidence. Everything else stays visible but UNKNOWN until its source/evaluator
 * is implemented. This prevents false zeroes and false unlocks.
 */
public final class AchievementSpecV2Bindings {
    public enum Comparison { GTE, LTE, BOOLEAN, UNSUPPORTED }

    public record Binding(String metric, Comparison comparison, long targetScale) {
        public boolean supports(boolean simpleNumeric, JsonElement threshold) {
            if (comparison == Comparison.UNSUPPORTED) return false;
            if (comparison == Comparison.BOOLEAN) return threshold != null;
            return simpleNumeric;
        }

        public long target(JsonElement threshold, boolean measurable) {
            if (!measurable) return 1L;
            if (comparison == Comparison.BOOLEAN) return 1L;
            if (threshold == null || !threshold.isJsonPrimitive() || !threshold.getAsJsonPrimitive().isNumber()) {
                return 1L;
            }
            double value = threshold.getAsDouble() * targetScale;
            if (!Double.isFinite(value)) return 1L;
            return Math.max(1L, Math.round(value));
        }
    }

    private AchievementSpecV2Bindings() {}

    public static Binding forFamily(String familyId) {
        return switch (familyId) {
            case "PLY_TH" -> gte("profile_town_hall");
            case "PLY_XP" -> gte("profile_exp_level");
            case "PLY_WAR_STARS" -> gte("profile_war_stars");
            case "PLY_CAP_CONTRIB" -> gte("profile_capital_contributions");
            case "PLY_ACH_STARS" -> gte("profile_native_achievement_stars");
            case "PLY_ACH_COMPLETE" -> gte("profile_completed_achievement_count");
            case "PLY_ACH_PROGRESS" -> gtePercent("profile_achievement_completion_pct");
            case "PLY_WAR_READY" -> bool("profile_war_ready");
            case "PLY_PROFILED" -> bool("profile_complete");

            case "OFF_HERO_SUM" -> gte("profile_hero_level_sum");
            case "OFF_EQUIP_LEVEL_SUM" -> gte("profile_equipment_level_sum");
            case "OFF_EQUIP_MAX_COUNT" -> gte("profile_equipment_max_count");
            case "OFF_ALL_OWNED_EQUIP_MAX" -> bool("profile_all_returned_equipment_max");
            case "OFF_BALANCED_HEROES" -> bool("profile_balanced_heroes");
            case "OFF_SUPER_ACTIVE" -> bool("profile_super_troop_active");
            case "OFF_SUPER_ACTIVE_COUNT" -> gte("profile_super_troop_active_count");

            case "SEA_DONATE" -> gte("profile_donations");
            case "SEA_RECEIVE" -> gte("profile_donations_received");
            case "SEA_DONATION_RATIO" -> bool("profile_generous_spirit");
            case "SEA_BALANCED_DONATION" -> bool("profile_balanced_donation");
            case "SEA_ATTACK_WINS" -> gte("profile_attack_wins");
            case "SEA_DEFENSE_WINS" -> gte("profile_defense_wins");

            case "TR_HOME_CURRENT" -> gte("profile_trophies");
            case "TR_HOME_BEST" -> gte("profile_best_trophies");
            case "TR_LEGEND_TROPHIES" -> gte("profile_legend_trophies");
            case "TR_GLOBAL_RANK" -> lte("ranking_best_global_rank");
            case "TR_RANKED_SEASONS" -> gte("legend_ranked_seasons");
            case "BB_HALL" -> gte("profile_builder_hall");
            case "BB_TROPHIES" -> gte("profile_builder_trophies");
            case "BB_BEST" -> gte("profile_best_builder_trophies");
            case "BB_HERO_SUM" -> gte("profile_builder_hero_level_sum");

            case "BASE_HOME_TH_WEAPON" -> gte("townhall_weapon_level");
            case "BASE_ACTIVE_STRUCTURE_TIMERS" -> gte("base_active_structure_timers");
            case "BASE_ACTIVE_HERO_TIMERS" -> gte("base_active_hero_timers");
            case "BASE_ACTIVE_RESEARCH_TIMERS" -> gte("base_active_research_timers");
            case "BASE_ACTIVE_PET_TIMER" -> gte("base_active_pet_timers");
            case "BASE_BOTH_VILLAGES_BUSY" -> bool("base_both_villages_busy");
            case "BASE_LONG_TIMER" -> gte("base_max_timer_seconds");
            case "BASE_FINISHING_SOON" -> lte("base_min_positive_timer_seconds");
            case "BASE_CURRENT_TIMER_TOTAL" -> gte("base_timer_seconds_total");
            case "BASE_BB_ACTIVE_TIMERS" -> gte("builder_active_timer_count");
            case "BASE_HOME_GEARUPS" -> gte("gear_up_count");

            case "BASE_HELPER_LEVEL_SUM" -> gte("helper_level_sum");
            case "BASE_HELPERS_UNLOCKED" -> gte("helper_distinct_count");
            case "COL_SKINS" -> gte("skin_count");
            case "COL_SCENERIES" -> gte("scenery_count");
            case "COL_BUILDER_SCENERIES" -> gte("builder_scenery_count");
            case "COL_TWO_VILLAGE_SCENERIES" -> bool("collection_two_village_sceneries");
            case "COL_HOUSE_PARTS" -> gte("house_part_count");
            case "COL_HOME_DECOS_UNIQUE" -> gte("decoration_distinct_count");
            case "COL_HOME_DECOS_TOTAL" -> gte("decoration_count");
            case "COL_BB_DECOS_UNIQUE" -> gte("builder_decoration_distinct_count");
            case "COL_BB_DECOS_TOTAL" -> gte("builder_decoration_count");
            case "COL_HOME_OBSTACLES_UNIQUE" -> gte("obstacle_distinct_count");
            case "COL_HOME_OBSTACLES_TOTAL" -> gte("obstacle_count");
            case "COL_BB_OBSTACLES_UNIQUE" -> gte("builder_obstacle_distinct_count");
            case "COL_BB_OBSTACLES_TOTAL" -> gte("builder_obstacle_count");
            case "COL_CATEGORY_MASTER" -> gte("collection_non_empty_category_count");

            case "APP_BASE_IMPORT_FIRST", "APP_BASE_IMPORTS" -> gte("snapshot_import_count");

            case "CWL_SEASONS" -> gte("cwl_seasons_played");
            case "CWL_ROUNDS" -> gte("cwl_wars_played");
            case "CWL_ATTACKS" -> gte("cwl_attacks");
            case "CWL_STARS" -> gte("cwl_stars");
            case "CWL_TRIPLES" -> gte("cwl_three_stars");
            case "CWL_UPHIT_TRIPLES" -> gte("cwl_uphit_three_stars");
            case "CWL_PERFECT_21" -> gte("cwl_perfect_seasons");
            case "CWL_TOP_FINISH" -> gte("cwl_top3_finishes");

            case "RAID_WEEKENDS" -> gte("raid_weekends");
            case "RAID_ATTACKS" -> gte("raid_attacks");
            case "RAID_LOOT" -> gte("raid_loot");
            case "RAID_WEEKEND_LOOT" -> gte("raid_weekend_loot");
            case "RAID_FULL_ATTACKS" -> gte("raid_full_weekends");
            case "RAID_BONUS" -> gte("raid_bonus_weekends");
            case "RAID_TOP_LOOTER_COUNT" -> gte("raid_top_looter_weekends");

            case "LEG_EOS_TROPHIES" -> gte("legend_best_season_trophies");
            case "LEG_EOS_RANK" -> lte("legend_best_season_rank");

            case "CL_LEVEL" -> gte("clan_level");
            case "CL_MEMBERS" -> gte("clan_members");
            case "CL_WAR_WINS" -> gte("clan_war_wins");
            case "CL_WIN_STREAK" -> gte("clan_war_win_streak");
            case "CL_CAPITAL_POINTS" -> gte("clan_capital_points");
            case "CL_DONATIONS" -> gte("clan_donations");
            case "CL_DONOR_PARTICIPATION" -> gtePercent("clan_donor_participation_pct");
            case "CL_BALANCED_ROSTER" -> bool("clan_balanced_roster");

            default -> unsupported(familyId);
        };
    }

    private static Binding gte(String metric) { return new Binding(metric, Comparison.GTE, 1L); }
    private static Binding gtePercent(String metric) { return new Binding(metric, Comparison.GTE, 100L); }
    private static Binding lte(String metric) { return new Binding(metric, Comparison.LTE, 1L); }
    private static Binding bool(String metric) { return new Binding(metric, Comparison.BOOLEAN, 1L); }
    private static Binding unsupported(String familyId) {
        return new Binding("spec:" + familyId, Comparison.UNSUPPORTED, 1L);
    }
}

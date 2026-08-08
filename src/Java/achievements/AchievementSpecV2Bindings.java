package Java.achievements;

import com.google.gson.JsonElement;

/**
 * Maps only v2 rules that ClashPanel can currently prove from already-normalized
 * evidence. Everything else stays visible but UNKNOWN until its source/evaluator
 * is implemented. This prevents false zeroes and false unlocks.
 */
public final class AchievementSpecV2Bindings {
    public enum Comparison { GTE, LTE, BOOLEAN, UNSUPPORTED }

    public record Binding(String metric, Comparison comparison) {
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
            double value = threshold.getAsDouble();
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
            case "PLY_ACH_PROGRESS" -> gte("profile_achievement_completion_pct");
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
            case "BB_HALL" -> gte("profile_builder_hall");
            case "BB_TROPHIES" -> gte("profile_builder_trophies");
            case "BB_BEST" -> gte("profile_best_builder_trophies");
            case "BB_HERO_SUM" -> gte("profile_builder_hero_level_sum");

            case "BASE_HOME_TH_WEAPON" -> gte("townhall_weapon_level");
            case "BASE_ACTIVE_STRUCTURE_TIMERS" -> gte("base_active_structure_timers");
            case "BASE_ACTIVE_HERO_TIMERS" -> gte("base_active_hero_timers");
            case "BASE_ACTIVE_RESEARCH_TIMERS" -> gte("base_active_research_timers");
            case "BASE_ACTIVE_PET_TIMER" -> gte("base_active_pet_timers");
            case "BASE_BUSY_SYSTEMS" -> gte("base_active_system_count");
            case "BASE_BOTH_VILLAGES_BUSY" -> bool("base_both_villages_busy");
            case "BASE_LONG_TIMER" -> gte("base_max_timer_seconds");
            case "BASE_FINISHING_SOON" -> lte("base_min_positive_timer_seconds");
            case "BASE_CURRENT_TIMER_TOTAL" -> gte("base_timer_seconds_total");
            case "BASE_BB_ACTIVE_TIMERS" -> gte("builder_active_timer_count");
            case "BASE_HOME_GEARUPS" -> gte("gear_up_count");

            case "BASE_BUILDING_LEVELS_GAINED" -> gte("tracked_home_building_levels");
            case "BASE_TRAP_LEVELS_GAINED" -> gte("tracked_home_trap_levels");
            case "BASE_WALL_LEVELS_GAINED" -> gte("tracked_home_wall_levels");
            case "BASE_BB_WALL_LEVELS_GAINED" -> gte("tracked_builder_wall_levels");
            case "BASE_HELPER_PROGRESS" -> gte("tracked_helper_levels");

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
            case "COL_MUSEUM" -> gte("cosmetic_collection_count");
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

            default -> unsupported(familyId);
        };
    }

    private static Binding gte(String metric) { return new Binding(metric, Comparison.GTE); }
    private static Binding lte(String metric) { return new Binding(metric, Comparison.LTE); }
    private static Binding bool(String metric) { return new Binding(metric, Comparison.BOOLEAN); }
    private static Binding unsupported(String familyId) {
        return new Binding("spec:" + familyId, Comparison.UNSUPPORTED);
    }
}

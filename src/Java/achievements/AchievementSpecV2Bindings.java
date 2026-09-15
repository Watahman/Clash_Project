package Java.achievements;

import com.google.gson.JsonElement;

/**
 * Maps only v2 rules that ClashPanel can currently prove from already-normalized
 * evidence. Everything else stays visible but UNKNOWN until its source/evaluator
 * is implemented. This prevents false zeroes and false unlocks.
 */
public final class AchievementSpecV2Bindings {
    public enum Comparison { GTE, LTE, BOOLEAN, UNSUPPORTED }

    public record Binding(
            String metric,
            Comparison comparison,
            long targetScale,
            String objectThresholdField
    ) {
        public Binding(String metric, Comparison comparison, long targetScale) {
            this(metric, comparison, targetScale, "");
        }

        public Binding {
            metric = metric == null ? "" : metric;
            comparison = comparison == null ? Comparison.UNSUPPORTED : comparison;
            objectThresholdField = objectThresholdField == null ? "" : objectThresholdField;
        }

        public boolean supports(boolean simpleNumeric, JsonElement threshold) {
            if (comparison == Comparison.UNSUPPORTED) return false;
            if (comparison == Comparison.BOOLEAN) return threshold != null;
            return simpleNumeric || hasNumericObjectThreshold(threshold);
        }

        public long target(JsonElement threshold, boolean measurable) {
            if (!measurable) return 1L;
            if (comparison == Comparison.BOOLEAN) return 1L;
            JsonElement value = thresholdValue(threshold);
            if (value == null || !value.isJsonPrimitive() || !value.getAsJsonPrimitive().isNumber()) {
                return 1L;
            }
            double target = value.getAsDouble() * targetScale;
            if (!Double.isFinite(target)) return 1L;
            return Math.max(1L, Math.round(target));
        }

        private boolean hasNumericObjectThreshold(JsonElement threshold) {
            return !objectThresholdField.isBlank()
                    && threshold != null
                    && threshold.isJsonObject()
                    && threshold.getAsJsonObject().has(objectThresholdField)
                    && threshold.getAsJsonObject().get(objectThresholdField).isJsonPrimitive()
                    && threshold.getAsJsonObject().get(objectThresholdField).getAsJsonPrimitive().isNumber();
        }

        private JsonElement thresholdValue(JsonElement threshold) {
            if (hasNumericObjectThreshold(threshold)) {
                return threshold.getAsJsonObject().get(objectThresholdField);
            }
            return threshold;
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
            case "PLY_TRACKED_AGE" -> gte("tracked_days");

            case "OFF_HERO_SUM" -> gte("profile_hero_level_sum");
            case "OFF_MAX_HERO_COUNT" -> gte("profile_home_hero_max_count");
            case "OFF_ALL_HERO_MAX" -> bool("profile_all_home_heroes_max");
            case "OFF_TROOP_MAX_COUNT" -> gte("profile_home_troop_max_count");
            case "OFF_ALL_TROOPS_MAX" -> bool("profile_all_home_troops_max");
            case "OFF_SPELL_MAX_COUNT" -> gte("profile_home_spell_max_count");
            case "OFF_ALL_SPELLS_MAX" -> bool("profile_all_home_spells_max");
            case "OFF_SIEGE_MAX_COUNT" -> gte("profile_siege_max_count");
            case "OFF_ALL_SIEGE_MAX" -> bool("profile_all_siege_max");
            case "OFF_PET_LEVEL_SUM" -> gte("profile_pet_level_sum");
            case "OFF_MAX_PET_COUNT" -> gte("profile_pet_max_count");
            case "OFF_ALL_PETS_MAX" -> bool("profile_all_pets_max");
            case "OFF_EQUIP_LEVEL_SUM" -> gte("profile_equipment_level_sum");
            case "OFF_EQUIP_MAX_COUNT" -> gte("profile_equipment_max_count");
            case "OFF_ALL_OWNED_EQUIP_MAX" -> bool("profile_all_returned_equipment_max");
            case "OFF_BALANCED_HEROES" -> bool("profile_balanced_heroes");
            case "OFF_PROGRESS_PCT" -> gtePercent("profile_offense_completion_pct");
            case "OFF_BALANCED_ARMY" -> bool("profile_balanced_army");
            case "OFF_UPGRADES_30D" -> gte("off_upgrades_30d");
            case "OFF_HERO_UP_30D" -> gte("off_hero_up_30d");
            case "OFF_EQUIP_UP_30D" -> gte("off_equip_up_30d");
            case "OFF_SUPER_ACTIVE" -> bool("profile_super_troop_active");
            case "OFF_SUPER_ACTIVE_COUNT" -> gte("profile_super_troop_active_count");

            case "SEA_DONATE" -> gte("profile_donations");
            case "SEA_RECEIVE" -> gte("profile_donations_received");
            case "SEA_DONATION_RATIO" -> bool("profile_generous_spirit");
            case "SEA_BALANCED_DONATION" -> bool("profile_balanced_donation");
            case "SEA_ATTACK_WINS" -> gte("profile_attack_wins");
            case "SEA_DEFENSE_WINS" -> gte("profile_defense_wins");
            case "SEA_CLAN_GAMES" -> gte("sea_clan_games_points");
            case "SEA_ACTIVE_DAYS" -> gte("sea_active_days");
            case "SEA_DONATION_LIFETIME" -> gte("sea_donations_lifetime");

            case "TR_HOME_CURRENT" -> gte("profile_trophies");
            case "TR_HOME_BEST" -> gte("profile_best_trophies");
            case "TR_LEGEND_TROPHIES" -> gte("profile_legend_trophies");
            case "TR_GLOBAL_RANK" -> lte("ranking_best_global_rank");
            case "TR_LOCAL_RANK" -> lte("ranking_best_local_rank");
            case "TR_DOUBLE_RANK" -> bool("ranking_double_rank");
            case "TR_RANKED_SEASONS" -> gte("legend_ranked_seasons");
            case "BB_HALL" -> gte("profile_builder_hall");
            case "BB_TROPHIES" -> gte("profile_builder_trophies");
            case "BB_BEST" -> gte("profile_best_builder_trophies");
            case "BB_GLOBAL_RANK" -> lte("ranking_builder_global_rank");
            case "BB_HERO_SUM" -> gte("profile_builder_hero_level_sum");
            case "BB_TROOP_MAX" -> gte("profile_builder_troop_max_count");
            case "BB_ALL_TROOPS_MAX" -> bool("profile_all_builder_troops_max");
            case "BB_ALL_HEROES_MAX" -> bool("profile_all_builder_heroes_max");
            case "BB_PROGRESS_PCT" -> gtePercent("profile_builder_offense_completion_pct");

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

            case "BASE_IMPORT_COMPLETIONS" -> gte("base_import_completions");
            case "BASE_BUILDING_LEVELS_GAINED" -> gte("tracked_home_building_levels");
            case "BASE_TRAP_LEVELS_GAINED" -> gte("tracked_home_trap_levels");
            case "BASE_WALL_LEVELS_GAINED" -> gte("tracked_home_wall_levels");
            case "BASE_BB_UPGRADES_COMPLETED" -> gte("base_bb_upgrades_completed");
            case "BASE_BB_WALL_LEVELS_GAINED" -> gte("tracked_builder_wall_levels");
            case "BASE_HELPER_PROGRESS" -> gte("tracked_helper_levels");
            case "COL_COSMETIC_GROWTH" -> gte("tracked_cosmetics_added");

            case "CWL_SEASONS" -> gte("cwl_seasons_played");
            case "CWL_ROUNDS" -> gte("cwl_wars_played");
            case "CWL_ATTACKS" -> gte("cwl_attacks");
            case "CWL_STARS" -> gte("cwl_stars");
            case "CWL_TRIPLES" -> gte("cwl_three_stars");
            case "CWL_SAME_TH_TRIPLES" -> gte("cwl_same_th_triples");
            case "CWL_UPHIT_TRIPLES" -> gte("cwl_uphit_three_stars");
            case "CWL_FULL_SEASON" -> gte("cwl_full_seasons_7");
            case "CWL_PERFECT_21" -> gte("cwl_perfect_seasons");
            case "CWL_NO_MISS_STREAK" -> gte("cwl_no_miss_season_streak");
            case "CWL_AVG_STARS" -> gte("cwl_average_stars_20", 100L);
            case "CWL_TRIPLE_RATE" -> gte("cwl_triple_rate_20", 10_000L);
            case "CWL_95_PLUS" -> gte("cwl_95_attacks");
            case "CWL_TOP_FINISH" -> gte("cwl_top3_finishes");
            case "CWL_COMEBACK" -> bool("cwl_comeback");
            case "CWL_CLEAN_SEASON" -> bool("cwl_clean_seasons");
            case "CWL_MULTI_CLAN" -> gte("cwl_clans");

            case "RAID_WEEKENDS" -> gte("raid_weekends");
            case "RAID_ATTACKS" -> gte("raid_attacks");
            case "RAID_LOOT" -> gte("raid_loot");
            case "RAID_WEEKEND_LOOT" -> gte("raid_weekend_loot");
            case "RAID_FULL_ATTACKS" -> gte("raid_full_weekends");
            case "RAID_BONUS" -> gte("raid_bonus_weekends");
            case "RAID_TOP_LOOTER_COUNT" -> gte("raid_top_looter_weekends");
            case "RAID_FULL_STREAK" -> gte("raid_full_streak");
            case "RAID_EFFICIENCY" -> gte("raid_efficiency");
            case "RAID_TOP_LOOTER" -> bool("raid_top_looter");
            case "RAID_100_WEEKENDS_FULL" -> gteObject("raid_full_weekends", "gte");

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
            case "CL_RAID_LOOT" -> gte("clan_raid_loot");
            case "CL_RAID_ATTACKS" -> gte("clan_raid_attacks");
            case "CL_RAID_PARTICIPATION" -> gtePercent("clan_raid_participation_pct");
            case "CL_RAIDS_COMPLETED" -> gte("clan_raids_completed");
            case "CL_DISTRICTS_DESTROYED" -> gte("clan_districts_destroyed");

            case "WAR_ATTACKS" -> gte("war_attacks");
            case "WAR_STARS" -> gte("war_stars");
            case "WAR_TRIPLES" -> gte("war_three_stars");
            case "WAR_SAME_TH_TRIPLES" -> gte("war_same_th_triples");
            case "WAR_UPHIT_TRIPLES" -> gte("war_uphit_three_stars");
            case "WAR_PLUS2_TRIPLES" -> gte("war_plus_two_triples");
            case "WAR_95_PLUS" -> gte("war_95_attacks");
            case "WAR_99_FAIL" -> gte("war_99_fail");
            case "WAR_ZERO_STAR_AVOID" -> gte("war_zero_star_avoid");
            case "WAR_TWO_PLUS_STREAK" -> gte("war_two_plus_streak");
            case "WAR_TRIPLE_STREAK" -> gte("war_triple_streak");
            case "WAR_AVG_STARS_25" -> gte("war_average_stars", 100L);
            case "WAR_TRIPLE_RATE_50" -> gte("war_triple_rate", 10_000L);
            case "WAR_DESTRUCTION_AVG" -> gte("war_average_destruction", 100L);
            case "WAR_FAST_TRIPLE" -> lte("war_fastest_triple_seconds");
            case "WAR_FRESH_TRIPLES" -> gte("war_fresh_triples");
            case "WAR_FIRST_HIT" -> gte("war_first_hit");
            case "WAR_MAP_UP" -> gte("war_map_up");
            case "WAR_NO_MISS" -> gte("war_no_miss_streak");
            case "WAR_FULL_WARS" -> gte("war_full_wars");
            case "WAR_PARTICIPATION" -> gte("war_wars");
            case "WAR_PERFECT_WAR_PLAYER" -> bool("war_perfect_wars_player");
            case "WAR_PERFECT_WARS_PLAYER" -> gte("war_perfect_wars_player");
            case "WAR_ALL_TH_MATCHUPS" -> gteObject("war_all_th_matchups", "distinct_min");
            case "WAR_TRIPLE_ALL_MATCHUPS" -> gteObject("war_triple_all_matchups", "distinct_min");
            case "WAR_RECENT_FORM" -> gte("war_recent_form", 10_000L);
            case "WAR_IMPROVING_FORM" -> gteObject("war_improving_form", "delta_gte", 10_000L);

            case "DEF_EVENTS" -> gte("def_events");
            case "DEF_HOLDS" -> gte("def_holds");
            case "DEF_ZERO_STAR" -> gte("def_zero_star");
            case "DEF_ONE_STAR" -> gte("def_one_star");
            case "DEF_UPHIT_HOLD" -> gte("def_uphit_hold");
            case "DEF_MULTI_HOLD" -> gte("def_multi_hold");
            case "DEF_HOLD_STREAK" -> gte("def_hold_streak");
            case "DEF_AVG_STARS" -> lte("def_avg_stars", 100L);
            case "DEF_AVG_DESTRUCTION" -> lte("def_avg_destruction", 100L);
            case "DEF_BOUNCE_BACK" -> gteObject("def_bounce_back", "after_triple_holds");

            case "SOC_CLANS_VISITED" -> gte("social_clans_visited");
            case "SOC_RETURNS" -> gte("social_returns");

            default -> unsupported(familyId);
        };
    }

    private static Binding gte(String metric) { return new Binding(metric, Comparison.GTE, 1L); }
    private static Binding gte(String metric, long targetScale) {
        return new Binding(metric, Comparison.GTE, targetScale);
    }
    private static Binding gteObject(String metric, String field) {
        return gteObject(metric, field, 1L);
    }
    private static Binding gteObject(String metric, String field, long targetScale) {
        return new Binding(metric, Comparison.GTE, targetScale, field);
    }
    private static Binding gtePercent(String metric) { return new Binding(metric, Comparison.GTE, 100L); }
    private static Binding lte(String metric) { return new Binding(metric, Comparison.LTE, 1L); }
    private static Binding lte(String metric, long targetScale) {
        return new Binding(metric, Comparison.LTE, targetScale);
    }
    private static Binding bool(String metric) { return new Binding(metric, Comparison.BOOLEAN, 1L); }
    private static Binding unsupported(String familyId) {
        return new Binding("spec:" + familyId, Comparison.UNSUPPORTED, 1L);
    }
}

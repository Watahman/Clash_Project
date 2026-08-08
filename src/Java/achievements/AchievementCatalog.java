package Java.achievements;

import java.util.ArrayList;
import java.util.List;

public final class AchievementCatalog {
    private static final long[] XP = {50, 100, 200, 400};
    private static final String[] RARITIES = {"common", "rare", "epic", "legendary"};
    private static final List<AchievementDefinition> DEFINITIONS = build();

    private AchievementCatalog() {}

    public static List<AchievementDefinition> definitions() {
        return DEFINITIONS;
    }

    private static List<AchievementDefinition> build() {
        List<AchievementDefinition> items = new ArrayList<>();

        family(items, "base_architect", "Base Architect", "Combined Home Village building levels", "base", "home_building_level_sum", 200, 500, 800, 1100);
        family(items, "village_builder", "Village Builder", "Buildings placed in the Home Village", "base", "home_building_count", 25, 50, 75, 90);
        family(items, "wall_grinder", "Wall Grinder", "Combined Home Village wall levels", "base", "home_wall_level_sum", 750, 2000, 4000, 6000);
        family(items, "wall_collector", "Wall Collector", "Walls detected in the Home Village", "base", "home_wall_count", 50, 150, 250, 325);
        family(items, "trap_specialist", "Trap Specialist", "Combined Home Village trap levels", "base", "home_trap_level_sum", 50, 150, 300, 500);
        family(items, "gear_engineer", "Gear Engineer", "Gear-ups detected on the base", "base", "gear_up_count", 1, 2, 3);
        family(items, "weaponized_hall", "Weaponized Hall", "Town Hall weapon level", "base", "townhall_weapon_level", 1, 2, 3, 4);
        family(items, "upgrade_queue", "Upgrade Queue", "Simultaneous active upgrade timers", "progress", "active_upgrade_count", 1, 3, 5, 7);

        family(items, "hero_council", "Hero Council", "Home Village heroes unlocked", "army", "home_hero_distinct_count", 2, 4, 5, 6);
        family(items, "hero_power", "Hero Power", "Combined Home Village hero levels", "army", "home_hero_level_sum", 100, 250, 375, 475);
        family(items, "army_collector", "Army Collector", "Different Home Village troops unlocked", "army", "home_unit_distinct_count", 10, 20, 25, 30);
        family(items, "army_scholar", "Army Scholar", "Combined Home Village troop levels", "army", "home_unit_level_sum", 75, 150, 225, 300);
        family(items, "spell_scholar", "Spell Scholar", "Combined spell levels", "army", "spell_level_sum", 30, 60, 90, 120);
        family(items, "siege_engineer", "Siege Engineer", "Combined siege machine levels", "army", "siege_level_sum", 10, 25, 40, 48);
        family(items, "pet_keeper", "Pet Keeper", "Pets unlocked", "army", "pet_distinct_count", 2, 6, 9, 12);
        family(items, "pet_trainer", "Pet Trainer", "Combined pet levels", "army", "pet_level_sum", 25, 60, 105, 145);
        family(items, "equipment_collector", "Equipment Collector", "Hero equipment items unlocked", "equipment", "equipment_distinct_count", 10, 20, 30, 40);
        family(items, "equipment_mastery", "Equipment Mastery", "Combined hero equipment levels", "equipment", "equipment_level_sum", 150, 350, 600, 850);
        family(items, "helper_crew", "Helper Crew", "Village helpers unlocked", "progress", "helper_distinct_count", 1, 2, 3, 4);
        family(items, "helper_mastery", "Helper Mastery", "Combined helper levels", "progress", "helper_level_sum", 5, 12, 20, 27);

        family(items, "decorator", "Decorator", "Home Village decorations collected", "collection", "decoration_distinct_count", 10, 20, 30, 40);
        family(items, "obstacle_keeper", "Obstacle Keeper", "Different Home Village obstacles preserved", "collection", "obstacle_distinct_count", 5, 10, 15, 20);
        family(items, "skin_collector", "Skin Collector", "Hero skins collected", "collection", "skin_count", 5, 10, 15, 25);
        family(items, "scenery_collector", "Scenery Collector", "Home Village sceneries collected", "collection", "scenery_count", 1, 3, 5, 10);
        family(items, "house_designer", "House Designer", "Capital House parts collected", "collection", "house_part_count", 10, 20, 30, 40);
        family(items, "collector_supreme", "Collector Supreme", "Cosmetic and obstacle collection size", "collection", "cosmetic_collection_count", 50, 100, 150, 250);

        family(items, "builder_architect", "Builder Architect", "Combined Builder Base building levels", "builder_base", "builder_building_level_sum", 300, 600, 900, 1200);
        family(items, "builder_wall_grinder", "Builder Wall Grinder", "Combined Builder Base wall levels", "builder_base", "builder_wall_level_sum", 300, 750, 1250, 1750);
        family(items, "builder_trap_specialist", "Builder Trap Specialist", "Combined Builder Base trap levels", "builder_base", "builder_trap_level_sum", 20, 50, 80, 120);
        family(items, "builder_hero_power", "Builder Hero Power", "Combined Builder Base hero levels", "builder_base", "builder_hero_level_sum", 10, 30, 50, 70);
        family(items, "builder_army_power", "Builder Army Power", "Combined Builder Base troop levels", "builder_base", "builder_unit_level_sum", 60, 120, 180, 235);

        family(items, "module_engineer", "Module Engineer", "Defense modules installed", "base", "defense_module_count", 1, 3, 6, 9);
        family(items, "module_mastery", "Module Mastery", "Combined defense module levels", "base", "defense_module_level_sum", 10, 30, 60, 90);
        family(items, "complete_export", "Complete Export", "Recognized sections present in the copied base-data", "system", "snapshot_section_count", 10, 16, 20, 22);

        family(items, "snapshot_historian", "Snapshot Historian", "Base-data snapshots saved in ClashPanel", "history", "snapshot_import_count", 2, 5, 12, 25);
        family(items, "long_term_tracker", "Long-term Tracker", "Days between the first and latest tracked snapshot", "history", "tracked_days", 7, 30, 90, 180);
        family(items, "building_momentum", "Building Momentum", "Home Village building levels gained while tracked", "history", "tracked_home_building_levels", 5, 25, 75, 150);
        family(items, "wall_marathon", "Wall Marathon", "Home Village wall levels gained while tracked", "history", "tracked_home_wall_levels", 25, 100, 300, 750);
        family(items, "hero_training_arc", "Hero Training Arc", "Home Village hero levels gained while tracked", "history", "tracked_home_hero_levels", 1, 5, 15, 30);
        family(items, "equipment_evolution", "Equipment Evolution", "Hero equipment levels gained while tracked", "history", "tracked_equipment_levels", 5, 25, 75, 150);
        family(items, "army_evolution", "Army Evolution", "Troop, spell, siege and pet levels gained while tracked", "history", "tracked_army_levels", 5, 25, 75, 150);
        family(items, "builder_momentum", "Builder Base Momentum", "Builder Base building levels gained while tracked", "history", "tracked_builder_building_levels", 5, 25, 75, 150);
        family(items, "collection_growth", "Collection Growth", "Cosmetics and obstacles added while tracked", "history", "tracked_cosmetics_added", 1, 5, 15, 30);
        family(items, "active_project_log", "Active Project Log", "Snapshots captured while at least one upgrade was active", "history", "tracked_active_upgrade_observations", 2, 5, 12, 25);
        family(items, "productive_checkins", "Productive Check-ins", "Snapshot intervals with measurable progress", "history", "tracked_progress_intervals", 2, 5, 12, 25);
        family(items, "progress_burst", "Progress Burst", "Largest combined positive level gain between two snapshots", "history", "tracked_largest_progress_jump", 5, 15, 30, 60);

        family(items, "battle_tracker", "Battle Tracker", "Multiplayer attacks recorded by Advanced Stats", "battle", "tracked_attack_count", 10, 50, 250, 1000);
        family(items, "star_collector", "Star Collector", "Stars earned in attacks recorded by Advanced Stats", "battle", "tracked_star_count", 25, 150, 750, 3000);
        family(items, "three_star_specialist", "Three-Star Specialist", "Three-star attacks recorded by Advanced Stats", "battle", "tracked_three_star_count", 3, 25, 100, 500);

        AchievementCatalogExpansion.append(items);
        return List.copyOf(items);
    }

    private static void family(
            List<AchievementDefinition> items,
            String familyKey,
            String title,
            String description,
            String category,
            String metric,
            long... targets
    ) {
        for (int index = 0; index < targets.length; index++) {
            int tier = index + 1;
            long target = targets[index];
            int rewardIndex = targets.length == 3 && index == 2 ? 3 : index;
            items.add(new AchievementDefinition(
                    familyKey + "_" + tier,
                    familyKey,
                    title + " " + roman(tier),
                    description + ": " + target,
                    category,
                    RARITIES[rewardIndex],
                    metric,
                    target,
                    tier,
                    (int) XP[rewardIndex]
            ));
        }
    }

    private static String roman(int tier) {
        return switch (tier) {
            case 1 -> "I";
            case 2 -> "II";
            case 3 -> "III";
            default -> "IV";
        };
    }
}

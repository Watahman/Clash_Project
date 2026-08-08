package Java.achievements;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Broad achievement catalog restored from the pre-implementation design intent.
 * A family is one genuinely distinct achievement concept; thresholds inside a
 * family are tiers and never inflate the unique-achievement count.
 */
public final class AchievementCatalogExpansion {
    private static final int EXPECTED_ADDITIONAL_FAMILIES = 331;
    private static final int[] XP = {50, 100, 200, 400};
    private static final String[] RARITY = {"common", "rare", "epic", "legendary"};

    private static final String[] HOME_TROOPS = {
            "Barbarian", "Archer", "Giant", "Goblin", "Wall Breaker", "Balloon", "Wizard", "Healer",
            "Dragon", "P.E.K.K.A", "Baby Dragon", "Miner", "Electro Dragon", "Yeti", "Dragon Rider",
            "Electro Titan", "Root Rider", "Thrower", "Meteor Golem", "Minion", "Hog Rider", "Valkyrie",
            "Golem", "Witch", "Lava Hound", "Bowler", "Ice Golem", "Headhunter", "Apprentice Warden",
            "Druid", "Furnace", "Ruin Witch"
    };
    private static final String[] SUPER_TROOPS = {
            "Super Barbarian", "Super Archer", "Super Giant", "Sneaky Goblin", "Super Wall Breaker",
            "Rocket Balloon", "Super Wizard", "Super Dragon", "Inferno Dragon", "Super Miner", "Super Yeti",
            "Super Minion", "Super Hog Rider", "Super Valkyrie", "Super Witch", "Ice Hound", "Super Bowler"
    };
    private static final String[] HOME_HEROES = {
            "Barbarian King", "Archer Queen", "Minion Prince", "Grand Warden", "Royal Champion", "Dragon Duke"
    };
    private static final String[] BUILDER_HEROES = {"Battle Machine", "Battle Copter"};
    private static final String[] SPELLS = {
            "Lightning Spell", "Healing Spell", "Rage Spell", "Jump Spell", "Freeze Spell", "Clone Spell",
            "Invisibility Spell", "Recall Spell", "Revive Spell", "Totem Spell", "Poison Spell", "Earthquake Spell",
            "Haste Spell", "Skeleton Spell", "Bat Spell", "Overgrowth Spell", "Ice Block Spell", "Angry Spell"
    };
    private static final String[] SIEGE_MACHINES = {
            "Wall Wrecker", "Battle Blimp", "Stone Slammer", "Siege Barracks", "Log Launcher", "Flame Flinger",
            "Battle Drill", "Troop Launcher", "Sky Wagon"
    };
    private static final String[] PETS = {
            "L.A.S.S.I", "Electro Owl", "Mighty Yak", "Unicorn", "Frosty", "Diggy", "Poison Lizard", "Phoenix",
            "Spirit Fox", "Angry Jelly", "Sneezy", "Greedy Raven"
    };
    private static final String[] HERO_EQUIPMENT = {
            "Barbarian Puppet", "Rage Vial", "Earthquake Boots", "Vampstache", "Giant Gauntlet", "Spiky Ball",
            "Snake Bracelet", "Stick Horse", "Archer Puppet", "Invisibility Vial", "Giant Arrow", "Healer Puppet",
            "Frozen Arrow", "Magic Mirror", "Action Figure", "Monolith Arrow", "Henchmen Puppet", "Dark Orb",
            "Metal Pants", "Noble Iron", "Dark Crown", "Meteor Staff", "Eternal Tome", "Life Gem", "Rage Gem",
            "Healing Tome", "Fireball", "Lavaloon Puppet", "Heroic Torch", "Royal Gem", "Seeking Shield",
            "Hog Rider Puppet", "Haste Vial", "Rocket Spear", "Electro Boots", "Frost Flake", "Fire Heart",
            "Flame Blower", "Stun Blaster", "Electro Fangs", "Rocket Backpack"
    };
    private static final String[] BUILDER_TROOPS = {
            "Raged Barbarian", "Sneaky Archer", "Boxer Giant", "Beta Minion", "Bomber", "Baby Dragon",
            "Cannon Cart", "Night Witch", "Drop Ship", "Power P.E.K.K.A", "Hog Glider", "Electrofire Wizard"
    };
    private static final String[] NATIVE_ACHIEVEMENTS = {
            "Keep Your Account Safe!", "Bigger & Better", "Discover New Troops", "Bigger Coffers", "Gold Grab",
            "Elixir Escapade", "Heroic Heist", "Well Seasoned", "Nice and Tidy", "Empire Builder", "Clan War Wealth",
            "Friend in Need", "Sharing is caring", "Siege Sharer", "War Hero", "War League Legend", "Games Champion",
            "Unbreakable", "Sweet Victory!", "Conqueror", "League All-Star", "League Follower", "League Enthusiast",
            "League Superfan", "League Fanatic", "League Master", "Humiliator", "Not So Easy This Time", "Union Buster",
            "Bust This!", "Wall Buster", "Mortar Mauler", "X-Bow Exterminator", "Firefighter", "Anti-Artillery",
            "Shattered and Scattered", "Counterspell", "Monolith Masher", "Multi-Archer Tower Terminator",
            "Ricochet Cannon Crusher", "Firespitter Finisher", "Multi-Gear Tower Trampler", "Crafter’s Nightmare",
            "Get those Goblins!", "Supercharger", "Crafting Connoisseur", "Get those other Goblins!",
            "Get even more Goblins!", "Dragon Slayer", "Ungrateful Child", "Superb Work", "Master Engineering",
            "Hidden Treasures", "High Gear", "Next Generation Model", "Un-Build It", "Champion Builder",
            "Aggressive Capitalism", "Most Valuable Clanmate"
    };
    private static final String[] BASE_SECTIONS = {
            "helpers", "buildings", "traps", "decos", "obstacles", "units", "siege_machines", "heroes", "spells",
            "pets", "equipment", "house_parts", "skins", "sceneries", "buildings2", "traps2", "decos2",
            "obstacles2", "units2", "heroes2", "skins2", "sceneries2"
    };

    private AchievementCatalogExpansion() {}

    public static void append(List<AchievementDefinition> items) {
        Set<String> before = familyKeys(items);
        appendBroadAchievements(items);       // 80
        appendMasteryAchievements(items);     // 149
        appendNativeAchievements(items);      // 59
        appendBaseSectionAchievements(items); // 22
        appendDerivedBaseAchievements(items); // 21

        Set<String> after = familyKeys(items);
        after.removeAll(before);
        if (after.size() != EXPECTED_ADDITIONAL_FAMILIES) {
            throw new IllegalStateException("Achievement catalog expansion drifted: expected "
                    + EXPECTED_ADDITIONAL_FAMILIES + " unique additions but built " + after.size());
        }
    }

    private static void appendBroadAchievements(List<AchievementDefinition> items) {
        family(items, "trophy_climber", "Trophy Climber", "Reach multiplayer trophies", "multiplayer", "profile_trophies", 500, 1500, 3000, 5000);
        family(items, "personal_best", "Personal Best", "Reach a best multiplayer trophy record", "multiplayer", "profile_best_trophies", 1000, 2500, 4000, 5000);
        family(items, "attack_winner", "Attack Winner", "Win multiplayer attacks in the current season", "multiplayer", "profile_attack_wins", 5, 25, 100, 250);
        family(items, "defense_survivor", "Defense Survivor", "Win multiplayer defenses in the current season", "multiplayer", "profile_defense_wins", 1, 5, 20, 50);
        family(items, "village_experience", "Village Experience", "Reach player experience levels", "multiplayer", "profile_exp_level", 25, 75, 150, 250);
        family(items, "builder_trophy_climber", "Builder Trophy Climber", "Reach Builder Base trophies", "multiplayer", "profile_builder_trophies", 500, 1500, 3000, 4500);
        family(items, "builder_personal_best", "Builder Personal Best", "Reach a best Builder Base trophy record", "multiplayer", "profile_best_builder_trophies", 1000, 2500, 4000, 5000);

        // Regular war has at most two attacks per member.
        family(items, "war_star_hunter", "War Star Hunter", "Earn lifetime war stars", "war", "profile_war_stars", 50, 250, 1000, 2500);
        family(items, "war_attack_duty", "War Attack Duty", "Use attacks in one observed regular war", "war", "war_current_attacks", 1, 2);
        family(items, "war_star_burst", "War Star Burst", "Earn stars in one observed regular war", "war", "war_current_stars", 2, 4, 6);
        family(items, "war_destruction_burst", "War Destruction Burst", "Earn combined destruction in one observed regular war", "war", "war_current_destruction", 75, 150, 200);
        family(items, "war_triple_machine", "Triple Machine", "Three-star attacks in one observed regular war", "war", "war_current_three_stars", 1, 2);
        family(items, "war_two_star_specialist", "Two-Star Specialist", "Two-star attacks in one observed regular war", "war", "war_current_two_stars", 1, 2);
        family(items, "war_underdog_slayer", "Underdog Slayer", "Three-star higher Town Halls in one observed regular war", "war", "war_current_uphit_three_stars", 1, 2);
        family(items, "war_first_blood", "First Blood", "Be observed participating in a regular clan war", "war", "war_current_participation", 1);
        family(items, "war_planner_duty", "War Planner Duty", "Receive saved regular-war assignments in ClashPanel", "war", "war_assignment_count", 1, 10, 50, 200);

        family(items, "cwl_veteran", "CWL Veteran", "CWL seasons found for this player in available clan history", "cwl", "cwl_seasons_played", 1, 3, 12, 24);
        family(items, "cwl_war_regular", "CWL War Regular", "CWL wars played in available history", "cwl", "cwl_wars_played", 3, 14, 70, 140);
        family(items, "cwl_reliable_attacker", "Reliable Attacker", "CWL attacks recorded in available history", "cwl", "cwl_attacks", 3, 14, 70, 140);
        family(items, "cwl_star_collector", "CWL Star Collector", "CWL stars earned in available history", "cwl", "cwl_stars", 10, 50, 200, 500);
        family(items, "cwl_triple_specialist", "CWL Triple Specialist", "Three-star CWL attacks in available history", "cwl", "cwl_three_stars", 1, 10, 50, 150);
        family(items, "cwl_two_star_specialist", "CWL Two-Star Specialist", "Two-star CWL attacks in available history", "cwl", "cwl_two_stars", 5, 25, 75);
        family(items, "cwl_perfect_attacker", "CWL Perfect Attacker", "100% three-star CWL attacks in available history", "cwl", "cwl_perfect_attacks", 1, 10, 50);
        family(items, "cwl_underdog_slayer", "CWL Underdog Slayer", "Three-star higher Town Halls in CWL", "cwl", "cwl_uphit_three_stars", 1, 5, 20);
        family(items, "perfect_cwl_season", "Perfect CWL Season", "CWL seasons with a perfect recorded attack line", "cwl", "cwl_perfect_seasons", 1, 3);
        family(items, "cwl_winning_clan", "Winning CWL Clan", "Clan CWL war wins while this player appears in the season", "cwl", "cwl_clan_wins", 10, 25, 40);
        family(items, "cwl_podium_regular", "CWL Podium Regular", "Top-three CWL finishes in available history", "cwl", "cwl_top3_finishes", 1, 3, 5);

        family(items, "season_donor", "Season Donor", "Donate troops in the current multiplayer season", "donations", "profile_donations", 100, 1000, 5000, 15000);
        family(items, "season_receiver", "Season Receiver", "Receive donated troops in the current multiplayer season", "donations", "profile_donations_received", 100, 1000, 5000, 15000);
        family(items, "balanced_supporter", "Balanced Supporter", "Maintain a strong donation-to-received ratio this season", "donations", "profile_donation_ratio_percent", 100, 250, 500, 1000);
        family(items, "support_traffic", "Support Traffic", "Total donated and received troop capacity this season", "donations", "profile_total_support_current", 500, 5000, 20000, 50000);

        family(items, "clan_level_companion", "Clan Level Companion", "Be in a clan that has reached this clan level", "clan", "profile_clan_level", 5, 10, 15, 20);
        family(items, "clan_rank", "Clan Rank", "Reach a higher role in the current clan", "clan", "profile_role_rank", 1, 2, 3, 4);
        family(items, "capital_contributor", "Capital Contributor", "Contribute Capital Gold", "clan", "profile_capital_contributions", 10000, 100000, 1000000, 5000000);
        family(items, "clan_member_now", "Clan Member", "Be a member of a clan", "clan", "profile_in_clan", 1);
        family(items, "family_member", "Family Member", "Join Clan Family workspaces in ClashPanel", "clan", "family_group_memberships", 1, 2, 4);

        family(items, "planner_architect", "Planner Architect", "Create CWL plans in ClashPanel", "clashpanel", "clashpanel_plans_owned", 1, 3, 10, 25);
        family(items, "planning_partner", "Planning Partner", "Participate in shared plans", "clashpanel", "clashpanel_plans_joined", 1, 3, 10, 30);
        family(items, "family_founder", "Family Founder", "Create Clan Family workspaces", "clashpanel", "clashpanel_groups_owned", 1, 2, 5, 10);
        family(items, "family_regular", "Family Regular", "Join Clan Family workspaces", "clashpanel", "clashpanel_group_memberships", 1, 2, 4, 8);
        family(items, "poll_host", "Poll Host", "Create Clan Family polls", "clashpanel", "clashpanel_polls_created", 1, 5, 20, 50);
        family(items, "poll_participant", "Poll Participant", "Answer Clan Family polls", "clashpanel", "clashpanel_polls_answered", 1, 5, 25, 100);
        family(items, "assignment_planner", "Assignment Planner", "Save regular-war assignments", "clashpanel", "war_assignment_count", 1, 10, 50, 200);
        family(items, "social_circle", "Social Circle", "Have accepted ClashPanel friends", "clashpanel", "clashpanel_friends_count", 1, 5, 15);
        family(items, "multi_account_manager", "Multi-Account Manager", "Link verified Clash accounts", "clashpanel", "clashpanel_account_count", 2, 3, 5);

        family(items, "family_workspace_member", "Family Workspace Member", "Clan Family memberships", "clan_family", "family_group_memberships", 1, 2, 4);
        family(items, "family_workspace_owner", "Family Workspace Owner", "Clan Family workspaces owned", "clan_family", "family_groups_owned", 1, 2, 5);
        family(items, "family_clan_curator", "Family Clan Curator", "Clans linked by you to Clan Family workspaces", "clan_family", "family_clans_linked", 1, 3, 8, 20);
        family(items, "family_poll_host", "Family Poll Host", "Family polls created", "clan_family", "family_polls_created", 1, 5, 20, 50);
        family(items, "family_poll_voice", "Family Poll Voice", "Family polls answered", "clan_family", "family_polls_answered", 1, 5, 25, 100);
        family(items, "family_reminder_captain", "Reminder Captain", "Poll reminder deliveries sent", "clan_family", "family_reminders_sent", 1, 10, 50);
        family(items, "family_leadership", "Family Leadership", "Highest Clan Family role rank reached", "clan_family", "family_role_rank", 1, 2, 3, 4);

        family(items, "battle_hardened", "Battle Hardened", "Combined multiplayer attack and defense wins this season", "rare_fun", "fun_attack_defense_total", 25, 100, 300);
        family(items, "give_and_take", "Give and Take", "Balanced donated/received troop capacity this season", "rare_fun", "fun_support_balance", 100, 1000, 10000);
        family(items, "two_worlds", "Two Worlds", "Raise both Home and Builder Base trophy records", "rare_fun", "fun_dual_trophy_score", 1000, 2500, 4000);
        family(items, "social_butterfly", "Social Butterfly", "Build a broad ClashPanel social footprint", "rare_fun", "fun_social_score", 5, 25, 100);
        family(items, "planning_machine", "Planning Machine", "Build a strong ClashPanel planning footprint", "rare_fun", "fun_planner_score", 5, 25, 100);
        family(items, "cwl_cleaner", "CWL Cleaner", "Record perfect CWL attacks", "rare_fun", "fun_cwl_cleaner", 1, 10, 50);
        family(items, "war_machine", "War Machine", "Stack lifetime war stars", "rare_fun", "fun_war_machine", 250, 1000, 2500);
        family(items, "account_army", "Account Army", "Manage multiple verified Clash accounts", "rare_fun", "fun_account_army", 2, 4, 6);
        family(items, "family_champion", "Family Champion", "Build a strong Clan Family footprint", "rare_fun", "fun_family_builder", 3, 10, 30);
        family(items, "hall_of_fame", "Hall of Fame", "Collect stars on native Clash achievements", "rare_fun", "fun_achievement_hunter", 30, 75, 120);

        family(items, "town_hall_journey", "Town Hall Journey", "Reach Town Hall levels", "progress", "profile_town_hall", 7, 10, 13, 16);
        family(items, "builder_hall_journey", "Builder Hall Journey", "Reach Builder Hall levels", "progress", "profile_builder_hall", 4, 6, 8, 10);
        family(items, "live_hero_roster", "Hero Roster", "Home Village heroes visible on the live profile", "progress", "profile_hero_count", 2, 4, 5, 6);
        family(items, "live_hero_power", "Live Hero Power", "Combined live-profile Home Village hero levels", "progress", "profile_hero_level_sum", 100, 250, 375, 475);
        family(items, "live_troop_roster", "Troop Roster", "Home Village troops visible on the live profile", "progress", "profile_troop_count", 10, 20, 25, 30);
        family(items, "live_spell_roster", "Spell Roster", "Spells visible on the live profile", "progress", "profile_spell_count", 5, 10, 15, 18);
        family(items, "live_equipment_roster", "Equipment Roster", "Hero equipment visible on the live profile", "progress", "profile_equipment_count", 5, 15, 30, 40);
        family(items, "native_achievement_stars", "Native Achievement Stars", "Stars earned on Clash of Clans built-in achievements", "progress", "profile_native_achievement_stars", 25, 75, 125, 175);

        family(items, "tracked_attack_veteran", "Tracked Attack Veteran", "Attacks recorded by Advanced Stats", "battle", "tracked_attack_count", 25, 100, 500, 2500);
        family(items, "tracked_star_veteran", "Tracked Star Veteran", "Stars recorded by Advanced Stats", "battle", "tracked_star_count", 75, 300, 1500, 7500);
        family(items, "tracked_triple_veteran", "Tracked Triple Veteran", "Three-star attacks recorded by Advanced Stats", "battle", "tracked_three_star_count", 10, 50, 250, 1000);
        family(items, "tracked_two_star_veteran", "Tracked Two-Star Veteran", "Two-star attacks recorded by Advanced Stats", "battle", "tracked_two_star_count", 10, 100, 500, 2500);
        family(items, "tracked_one_star_veteran", "Tracked One-Star Veteran", "One-star attacks recorded by Advanced Stats", "battle", "tracked_one_star_count", 10, 100, 500);
        family(items, "tracked_zero_star_survivor", "Zero-Star Survivor", "Zero-star attacks recorded by Advanced Stats", "battle", "tracked_zero_star_count", 1, 10, 25);
        family(items, "tracked_gold_raider", "Gold Raider", "Gold looted in attacks recorded by Advanced Stats", "battle", "tracked_gold_looted", 10000000, 100000000, 1000000000L);
        family(items, "tracked_elixir_raider", "Elixir Raider", "Elixir looted in attacks recorded by Advanced Stats", "battle", "tracked_elixir_looted", 10000000, 100000000, 1000000000L);
        family(items, "tracked_dark_raider", "Dark Elixir Raider", "Dark Elixir looted in attacks recorded by Advanced Stats", "battle", "tracked_dark_elixir_looted", 100000, 1000000, 10000000);
        family(items, "tracked_active_days_badge", "Active Days", "Days with at least one attack recorded by Advanced Stats", "battle", "tracked_active_days", 7, 30, 90, 365);
    }

    private static void appendMasteryAchievements(List<AchievementDefinition> items) {
        for (String name : HOME_TROOPS) mastery(items, "home_troop", name, "army", "mastery_home_" + slug(name));
        for (String name : SUPER_TROOPS) mastery(items, "super_troop", name, "army", "mastery_home_" + slug(name));
        for (String name : HOME_HEROES) mastery(items, "home_hero", name, "army", "mastery_home_" + slug(name));
        for (String name : BUILDER_HEROES) mastery(items, "builder_hero", name, "builder_base", "mastery_builder_" + slug(name));
        for (String name : SPELLS) mastery(items, "spell", name, "army", "mastery_spell_" + slug(name));
        for (String name : SIEGE_MACHINES) mastery(items, "siege", name, "army", "mastery_home_" + slug(name));
        for (String name : PETS) mastery(items, "pet", name, "army", "mastery_home_" + slug(name));
        for (String name : HERO_EQUIPMENT) mastery(items, "equipment", name, "equipment", "mastery_equipment_" + slug(name));
        for (String name : BUILDER_TROOPS) mastery(items, "builder_troop", name, "builder_base", "mastery_builder_" + slug(name));
    }

    private static void appendNativeAchievements(List<AchievementDefinition> items) {
        for (String name : NATIVE_ACHIEVEMENTS) {
            family(items, "native_" + slug(name), name, "Complete the built-in Clash of Clans achievement", "native", "native_stars_" + slug(name), 1, 2, 3);
        }
    }

    private static void appendBaseSectionAchievements(List<AchievementDefinition> items) {
        for (String section : BASE_SECTIONS) {
            String readable = section.replace("2", " Builder Base").replace('_', ' ');
            family(items, "archive_" + section, titleCase(readable) + " Archive", "Include this section in an imported base-data snapshot", "system", "snapshot_section_" + section, 1);
        }
    }

    private static void appendDerivedBaseAchievements(List<AchievementDefinition> items) {
        family(items, "trap_network", "Trap Network", "Total Home Village traps detected", "base", "home_trap_count", 10, 25, 50, 75);
        family(items, "trap_arsenal", "Trap Arsenal", "Different Home Village trap types detected", "base", "home_trap_distinct_count", 3, 6, 9, 12);
        family(items, "army_depth", "Army Depth", "Home Village troop instances represented in base data", "army", "home_unit_count", 10, 20, 30, 40);
        family(items, "spellbook", "Spellbook", "Different spells represented in base data", "army", "spell_distinct_count", 5, 10, 15, 18);
        family(items, "siege_fleet", "Siege Fleet", "Different siege machines represented in base data", "army", "siege_distinct_count", 2, 4, 7, 9);
        family(items, "builder_settlement", "Builder Settlement", "Builder Base buildings detected", "builder_base", "builder_building_count", 10, 20, 30, 40);
        family(items, "builder_blueprints", "Builder Blueprints", "Different Builder Base building types detected", "builder_base", "builder_building_distinct_count", 5, 10, 15, 20);
        family(items, "builder_trap_network", "Builder Trap Network", "Builder Base traps detected", "builder_base", "builder_trap_count", 5, 10, 20, 30);
        family(items, "builder_trap_arsenal", "Builder Trap Arsenal", "Different Builder Base trap types detected", "builder_base", "builder_trap_distinct_count", 2, 4, 6, 8);
        family(items, "builder_army_depth", "Builder Army Depth", "Builder Base troop instances represented", "builder_base", "builder_unit_count", 3, 6, 9, 12);
        family(items, "builder_troop_variety", "Builder Troop Variety", "Different Builder Base troop types represented", "builder_base", "builder_unit_distinct_count", 3, 6, 9, 12);
        family(items, "builder_hero_roster", "Builder Hero Roster", "Builder Base heroes represented", "builder_base", "builder_hero_count", 1, 2);
        family(items, "builder_hero_council", "Builder Hero Council", "Different Builder Base heroes unlocked", "builder_base", "builder_hero_distinct_count", 1, 2);
        family(items, "decoration_hoard", "Decoration Hoard", "Home Village decorations present", "collection", "decoration_count", 10, 25, 50, 100);
        family(items, "obstacle_grove", "Obstacle Grove", "Home Village obstacles preserved", "collection", "obstacle_count", 5, 15, 30, 60);
        family(items, "builder_decorator", "Builder Decorator", "Builder Base decorations present", "collection", "builder_decoration_count", 5, 15, 30, 60);
        family(items, "builder_obstacle_keeper", "Builder Obstacle Keeper", "Builder Base obstacles preserved", "collection", "builder_obstacle_count", 5, 10, 20, 40);
        family(items, "builder_skin_collector", "Builder Skin Collector", "Builder Base hero skins collected", "collection", "builder_skin_count", 1, 3, 6, 10);
        family(items, "builder_scenery_collector", "Builder Scenery Collector", "Builder Base sceneries collected", "collection", "builder_scenery_count", 1, 2, 4, 8);
        family(items, "village_progress_score", "Village Progress Score", "Combined Home Village building, wall and trap levels", "progress", "home_progress_score", 1000, 3000, 5000, 7500);
        family(items, "builder_progress_score", "Builder Progress Score", "Combined Builder Base building, wall, trap, troop and hero levels", "builder_base", "builder_progress_score", 500, 1000, 1750, 2500);
    }

    private static void mastery(List<AchievementDefinition> items, String prefix, String name, String category, String metric) {
        family(items, "mastery_" + prefix + "_" + slug(name), name + " Mastery", "Upgrade " + name + " toward its current maximum level", category, metric, 25, 50, 75, 100);
    }

    private static void family(List<AchievementDefinition> items, String familyKey, String title, String description, String category, String metric, long... targets) {
        if (targets.length < 1 || targets.length > 4) throw new IllegalArgumentException("Achievement families must contain between 1 and 4 tiers: " + familyKey);
        for (int index = 0; index < targets.length; index++) {
            items.add(new AchievementDefinition(
                    familyKey + "_" + (index + 1), familyKey,
                    title + (targets.length == 1 ? "" : " " + roman(index + 1)),
                    description + ": " + targets[index], category, RARITY[index], metric,
                    targets[index], index + 1, XP[index]
            ));
        }
    }

    private static Set<String> familyKeys(List<AchievementDefinition> items) {
        Set<String> keys = new HashSet<>();
        for (AchievementDefinition definition : items) keys.add(definition.familyKey());
        return keys;
    }

    static String slug(String value) {
        return String.valueOf(value).toLowerCase(Locale.ROOT).replace("&", " and ")
                .replaceAll("[^a-z0-9]+", "_").replaceAll("^_+|_+$", "");
    }

    private static String titleCase(String value) {
        StringBuilder result = new StringBuilder();
        for (String part : value.trim().split("\\s+")) {
            if (part.isBlank()) continue;
            if (!result.isEmpty()) result.append(' ');
            result.append(Character.toUpperCase(part.charAt(0))).append(part.substring(1));
        }
        return result.toString();
    }

    private static String roman(int tier) {
        return switch (tier) { case 1 -> "I"; case 2 -> "II"; case 3 -> "III"; default -> "IV"; };
    }
}

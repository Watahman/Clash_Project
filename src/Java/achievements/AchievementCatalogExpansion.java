package Java.achievements;

import java.util.List;

/**
 * Restores the broad ClashPanel achievement scope that existed before the first
 * implementation was intentionally narrowed to the base-data/Advanced-Stats core.
 *
 * These are real user-visible achievements (families), not extra tiers bolted on
 * to the original 49 families. The expansion is deliberately data-source based:
 * live Clash profile, current/observed war, CWL history, ClashPanel usage,
 * Clan Family usage and Advanced Stats.
 */
public final class AchievementCatalogExpansion {
    private static final int EXPECTED_ADDITIONAL_FAMILIES = 331;
    private static final int[] XP = {40, 60, 90, 130, 180, 240, 310, 390, 480, 600};
    private static final String[] RARITY = {
            "common", "common", "common", "rare", "rare",
            "epic", "epic", "legendary", "legendary", "legendary"
    };
    private static final String[] STAGES = {
            "Scout", "Rookie", "Proven", "Veteran", "Elite",
            "Master", "Champion", "Titan", "Legend", "Mythic"
    };

    private AchievementCatalogExpansion() {}

    public static void append(List<AchievementDefinition> items) {
        int before = items.size();

        // Multiplayer & profile progression — 35
        series(items, "trophy_climber", "Trophy Climber", "Reach multiplayer trophies", "multiplayer", "profile_trophies",
                500, 1200, 2000, 3200, 5000);
        series(items, "personal_best", "Personal Best", "Reach a best multiplayer trophy record", "multiplayer", "profile_best_trophies",
                1000, 2000, 3000, 4000, 5000);
        series(items, "attack_winner", "Attack Winner", "Win multiplayer attacks in the current season", "multiplayer", "profile_attack_wins",
                5, 25, 75, 150, 300);
        series(items, "defense_survivor", "Defense Survivor", "Win multiplayer defenses in the current season", "multiplayer", "profile_defense_wins",
                1, 5, 15, 30, 60);
        series(items, "village_experience", "Village Experience", "Reach player experience levels", "multiplayer", "profile_exp_level",
                25, 50, 100, 150, 200);
        series(items, "builder_trophy_climber", "Builder Trophy Climber", "Reach Builder Base trophies", "multiplayer", "profile_builder_trophies",
                500, 1200, 2000, 3000, 4000);
        series(items, "builder_personal_best", "Builder Personal Best", "Reach a best Builder Base trophy record", "multiplayer", "profile_best_builder_trophies",
                1000, 2000, 3000, 4000, 5000);

        // War performance & participation — 45
        series(items, "war_star_hunter", "War Star Hunter", "Earn lifetime war stars", "war", "profile_war_stars",
                10, 50, 100, 250, 500, 750, 1000, 1500, 2500, 4000);
        series(items, "war_attack_duty", "War Attack Duty", "Use attacks in one observed regular war", "war", "war_current_attacks",
                1, 2, 3, 4);
        series(items, "war_star_burst", "War Star Burst", "Earn stars in one observed regular war", "war", "war_current_stars",
                2, 4, 6, 8);
        series(items, "war_destruction_burst", "War Destruction Burst", "Earn combined destruction in one observed regular war", "war", "war_current_destruction",
                75, 150, 200, 300);
        series(items, "war_triple_machine", "Triple Machine", "Three-star attacks in one observed regular war", "war", "war_current_three_stars",
                1, 2, 3, 4);
        series(items, "war_two_star_specialist", "Two-Star Specialist", "Two-star attacks in one observed regular war", "war", "war_current_two_stars",
                1, 2, 3);
        series(items, "war_underdog_slayer", "Underdog Slayer", "Three-star higher Town Halls in one observed regular war", "war", "war_current_uphit_three_stars",
                1, 2, 3);
        single(items, "war_first_blood", "First Blood", "Be observed participating in a regular clan war", "war", "war_current_participation", 1, "common", 60);
        series(items, "war_planner_duty", "War Planner Duty", "Receive saved regular-war assignments in ClashPanel", "war", "war_assignment_count",
                1, 10, 50, 200);
        series(items, "native_war_hero_badge", "War Hero", "Progress the in-game War Hero achievement", "war", "native_war_hero",
                10, 100, 500, 1000);
        series(items, "native_unbreakable_badge", "Unbreakable", "Progress the in-game Unbreakable achievement", "war", "native_unbreakable",
                10, 50, 100, 500);

        // CWL excellence — 40
        series(items, "cwl_veteran", "CWL Veteran", "CWL seasons found for this player in available clan history", "cwl", "cwl_seasons_played",
                1, 3, 6, 12, 24);
        series(items, "cwl_war_regular", "CWL War Regular", "CWL wars played in available history", "cwl", "cwl_wars_played",
                3, 14, 35, 70, 140);
        series(items, "cwl_reliable_attacker", "Reliable Attacker", "CWL attacks recorded in available history", "cwl", "cwl_attacks",
                3, 14, 35, 70, 140);
        series(items, "cwl_star_collector", "CWL Star Collector", "CWL stars earned in available history", "cwl", "cwl_stars",
                10, 50, 125, 250, 500);
        series(items, "cwl_triple_specialist", "CWL Triple Specialist", "Three-star CWL attacks in available history", "cwl", "cwl_three_stars",
                1, 10, 30, 75, 150);
        series(items, "cwl_two_star_specialist", "CWL Two-Star Specialist", "Two-star CWL attacks in available history", "cwl", "cwl_two_stars",
                5, 25, 75);
        series(items, "cwl_perfect_attacker", "CWL Perfect Attacker", "100% three-star CWL attacks in available history", "cwl", "cwl_perfect_attacks",
                1, 10, 50);
        series(items, "cwl_underdog_slayer", "CWL Underdog Slayer", "Three-star higher Town Halls in CWL", "cwl", "cwl_uphit_three_stars",
                1, 5, 20);
        series(items, "perfect_cwl_season", "Perfect CWL Season", "CWL seasons with a perfect recorded attack line", "cwl", "cwl_perfect_seasons",
                1, 3);
        series(items, "cwl_winning_clan", "Winning CWL Clan", "Clan CWL war wins while this player appears in the season", "cwl", "cwl_clan_wins",
                10, 40);
        series(items, "cwl_podium_regular", "CWL Podium Regular", "Top-three CWL finishes in available history", "cwl", "cwl_top3_finishes",
                1, 5);

        // Donations & support — 24
        series(items, "season_donor", "Season Donor", "Donate troops in the current multiplayer season", "donations", "profile_donations",
                100, 1000, 5000, 15000);
        series(items, "season_receiver", "Season Receiver", "Receive donated troops in the current multiplayer season", "donations", "profile_donations_received",
                100, 1000, 5000, 15000);
        series(items, "friend_in_need", "Friend in Need", "Progress the in-game Friend in Need achievement", "donations", "native_friend_in_need",
                1000, 10000, 100000, 500000);
        series(items, "sharing_is_caring", "Sharing Is Caring", "Progress the in-game Sharing is caring achievement", "donations", "native_sharing_is_caring",
                100, 1000, 5000, 10000);
        series(items, "balanced_supporter", "Balanced Supporter", "Maintain a strong donation-to-received ratio this season", "donations", "profile_donation_ratio_percent",
                100, 250, 500, 1000);
        series(items, "support_traffic", "Support Traffic", "Total donated and received troop capacity this season", "donations", "profile_total_support_current",
                500, 5000, 20000, 50000);

        // Clan & loyalty/context — 30
        series(items, "clan_level_companion", "Clan Level Companion", "Be in a clan that has reached this clan level", "clan", "profile_clan_level",
                5, 10, 15, 20);
        series(items, "clan_rank", "Clan Rank", "Reach a higher role in the current clan", "clan", "profile_role_rank",
                1, 2, 3, 4);
        series(items, "capital_contributor", "Capital Contributor", "Contribute Capital Gold", "clan", "profile_capital_contributions",
                10000, 100000, 500000, 1000000, 5000000);
        series(items, "games_champion", "Games Champion", "Progress the in-game Games Champion achievement", "clan", "native_games_champion",
                1000, 5000, 20000, 50000, 100000);
        series(items, "clan_treasurer", "Clan Treasurer", "Progress the in-game Treasurer achievement", "clan", "native_treasurer",
                100000, 1000000, 10000000, 100000000);
        series(items, "valuable_clanmate", "Most Valuable Clanmate", "Progress the in-game Most Valuable Clanmate achievement", "clan", "native_most_valuable_clanmate",
                1000, 10000, 50000, 100000);
        single(items, "clan_member_now", "Clan Member", "Be a member of a clan", "clan", "profile_in_clan", 1, "common", 40);
        series(items, "family_member", "Family Member", "Join Clan Family workspaces in ClashPanel", "clan", "family_group_memberships",
                1, 2, 4);

        // ClashPanel mastery — 35
        series(items, "planner_architect", "Planner Architect", "Create CWL plans in ClashPanel", "clashpanel", "clashpanel_plans_owned",
                1, 3, 10, 25, 75);
        series(items, "planning_partner", "Planning Partner", "Participate in shared plans", "clashpanel", "clashpanel_plans_joined",
                1, 3, 10, 30);
        series(items, "family_founder", "Family Founder", "Create Clan Family workspaces", "clashpanel", "clashpanel_groups_owned",
                1, 2, 5, 10);
        series(items, "family_regular", "Family Regular", "Join Clan Family workspaces", "clashpanel", "clashpanel_group_memberships",
                1, 2, 4, 8);
        series(items, "poll_host", "Poll Host", "Create Clan Family polls", "clashpanel", "clashpanel_polls_created",
                1, 5, 20, 50);
        series(items, "poll_participant", "Poll Participant", "Answer Clan Family polls", "clashpanel", "clashpanel_polls_answered",
                1, 5, 25, 100);
        series(items, "assignment_planner", "Assignment Planner", "Save regular-war assignments", "clashpanel", "war_assignment_count",
                1, 10, 50, 200);
        series(items, "social_circle", "Social Circle", "Have accepted ClashPanel friends", "clashpanel", "clashpanel_friends_count",
                1, 5, 15);
        series(items, "multi_account_manager", "Multi-Account Manager", "Link verified Clash accounts", "clashpanel", "clashpanel_account_count",
                2, 3, 5);

        // Clan Family — 25
        series(items, "family_workspace_member", "Family Workspace Member", "Clan Family memberships", "clan_family", "family_group_memberships",
                1, 2, 4);
        series(items, "family_workspace_owner", "Family Workspace Owner", "Clan Family workspaces owned", "clan_family", "family_groups_owned",
                1, 2, 5);
        series(items, "family_clan_curator", "Family Clan Curator", "Clans linked by you to Clan Family workspaces", "clan_family", "family_clans_linked",
                1, 3, 8, 20);
        series(items, "family_poll_host", "Family Poll Host", "Family polls created", "clan_family", "family_polls_created",
                1, 5, 20, 50);
        series(items, "family_poll_voice", "Family Poll Voice", "Family polls answered", "clan_family", "family_polls_answered",
                1, 5, 25, 100);
        series(items, "family_reminder_captain", "Reminder Captain", "Poll reminder deliveries sent", "clan_family", "family_reminders_sent",
                1, 10, 50);
        series(items, "family_leadership", "Family Leadership", "Highest Clan Family role rank reached", "clan_family", "family_role_rank",
                1, 2, 3, 4);

        // Rare / funny / signature — 30
        series(items, "battle_hardened", "Battle Hardened", "Combined multiplayer attack and defense wins this season", "rare_fun", "fun_attack_defense_total",
                25, 100, 300);
        series(items, "give_and_take", "Give and Take", "Balanced donated/received troop capacity this season", "rare_fun", "fun_support_balance",
                100, 1000, 10000);
        series(items, "two_worlds", "Two Worlds", "Raise both Home and Builder Base trophy records", "rare_fun", "fun_dual_trophy_score",
                1000, 2500, 4000);
        series(items, "social_butterfly", "Social Butterfly", "Build a broad ClashPanel social footprint", "rare_fun", "fun_social_score",
                5, 25, 100);
        series(items, "planning_machine", "Planning Machine", "Build a strong ClashPanel planning footprint", "rare_fun", "fun_planner_score",
                5, 25, 100);
        series(items, "cwl_cleaner", "CWL Cleaner", "Record perfect CWL attacks", "rare_fun", "fun_cwl_cleaner",
                1, 10, 50);
        series(items, "war_machine", "War Machine", "Stack lifetime war stars", "rare_fun", "fun_war_machine",
                250, 1000, 2500);
        series(items, "account_army", "Account Army", "Manage multiple verified Clash accounts", "rare_fun", "fun_account_army",
                2, 4, 6);
        series(items, "family_champion", "Family Champion", "Build a strong Clan Family footprint", "rare_fun", "fun_family_builder",
                3, 10, 30);
        series(items, "hall_of_fame", "Hall of Fame", "Collect stars on native Clash achievements", "rare_fun", "fun_achievement_hunter",
                30, 75, 120);

        // Live profile progression without a base-data import — 32
        series(items, "town_hall_journey", "Town Hall Journey", "Reach Town Hall levels", "progress", "profile_town_hall",
                7, 10, 13, 16);
        series(items, "builder_hall_journey", "Builder Hall Journey", "Reach Builder Hall levels", "progress", "profile_builder_hall",
                4, 6, 8, 10);
        series(items, "live_hero_roster", "Hero Roster", "Home Village heroes visible on the live profile", "progress", "profile_hero_count",
                2, 4, 5, 6);
        series(items, "live_hero_power", "Live Hero Power", "Combined live-profile Home Village hero levels", "progress", "profile_hero_level_sum",
                100, 250, 375, 475);
        series(items, "live_troop_roster", "Troop Roster", "Home Village troops visible on the live profile", "progress", "profile_troop_count",
                10, 20, 25, 30);
        series(items, "live_spell_roster", "Spell Roster", "Spells visible on the live profile", "progress", "profile_spell_count",
                5, 10, 15, 20);
        series(items, "live_equipment_roster", "Equipment Roster", "Hero equipment visible on the live profile", "progress", "profile_equipment_count",
                5, 15, 25, 35);
        series(items, "native_achievement_stars", "Native Achievement Stars", "Stars earned on Clash of Clans' built-in achievements", "progress", "profile_native_achievement_stars",
                25, 50, 100, 150);

        // Advanced Stats long-term battle tracking — 35
        series(items, "tracked_attack_veteran", "Tracked Attack Veteran", "Attacks recorded by Advanced Stats", "battle", "tracked_attack_count",
                25, 100, 500, 2500, 10000);
        series(items, "tracked_star_veteran", "Tracked Star Veteran", "Stars recorded by Advanced Stats", "battle", "tracked_star_count",
                75, 300, 1500, 7500, 30000);
        series(items, "tracked_triple_veteran", "Tracked Triple Veteran", "Three-star attacks recorded by Advanced Stats", "battle", "tracked_three_star_count",
                10, 50, 250, 1000, 5000);
        series(items, "tracked_two_star_veteran", "Tracked Two-Star Veteran", "Two-star attacks recorded by Advanced Stats", "battle", "tracked_two_star_count",
                10, 100, 500, 2500);
        series(items, "tracked_one_star_veteran", "Tracked One-Star Veteran", "One-star attacks recorded by Advanced Stats", "battle", "tracked_one_star_count",
                10, 100, 500);
        series(items, "tracked_zero_star_survivor", "Zero-Star Survivor", "Zero-star attacks recorded by Advanced Stats", "battle", "tracked_zero_star_count",
                1, 25);
        series(items, "tracked_gold_raider", "Gold Raider", "Gold looted in attacks recorded by Advanced Stats", "battle", "tracked_gold_looted",
                10000000, 100000000, 1000000000);
        series(items, "tracked_elixir_raider", "Elixir Raider", "Elixir looted in attacks recorded by Advanced Stats", "battle", "tracked_elixir_looted",
                10000000, 100000000, 1000000000);
        series(items, "tracked_dark_raider", "Dark Elixir Raider", "Dark Elixir looted in attacks recorded by Advanced Stats", "battle", "tracked_dark_elixir_looted",
                100000, 1000000);
        series(items, "tracked_active_days_badge", "Active Days", "Days with at least one attack recorded by Advanced Stats", "battle", "tracked_active_days",
                7, 30, 180);

        int added = items.size() - before;
        if (added != EXPECTED_ADDITIONAL_FAMILIES) {
            throw new IllegalStateException("Achievement catalog expansion drifted: expected "
                    + EXPECTED_ADDITIONAL_FAMILIES + " additions but built " + added);
        }
    }

    private static void series(
            List<AchievementDefinition> items,
            String keyPrefix,
            String title,
            String description,
            String category,
            String metric,
            long... targets
    ) {
        for (int i = 0; i < targets.length; i++) {
            int stage = Math.min(i, STAGES.length - 1);
            String key = keyPrefix + "_badge_" + (i + 1);
            items.add(new AchievementDefinition(
                    key,
                    key,
                    title + " — " + STAGES[stage],
                    description + ": " + targets[i],
                    category,
                    RARITY[Math.min(stage, RARITY.length - 1)],
                    metric,
                    targets[i],
                    1,
                    XP[Math.min(stage, XP.length - 1)]
            ));
        }
    }

    private static void single(
            List<AchievementDefinition> items,
            String key,
            String title,
            String description,
            String category,
            String metric,
            long target,
            String rarity,
            int xp
    ) {
        items.add(new AchievementDefinition(
                key,
                key,
                title,
                description + ": " + target,
                category,
                rarity,
                metric,
                target,
                1,
                xp
        ));
    }
}

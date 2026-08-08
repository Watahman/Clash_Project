package Java.achievements;

import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AchievementEvaluatorTest {
    @Test
    void unlocksOnlyReachedTiers() {
        AchievementEvaluator evaluator = new AchievementEvaluator();
        var result = evaluator.evaluate(Map.of("home_wall_count", 200L));

        var wallTiers = result.stream()
                .filter(item -> item.definition().familyKey().equals("wall_collector"))
                .toList();

        assertEquals(4, wallTiers.size());
        assertTrue(wallTiers.get(0).unlocked());
        assertTrue(wallTiers.get(1).unlocked());
        assertFalse(wallTiers.get(2).unlocked());
        assertFalse(wallTiers.get(3).unlocked());
    }

    @Test
    void exposesEntireCatalogAtZeroProgress() {
        AchievementEvaluator evaluator = new AchievementEvaluator();
        var result = evaluator.evaluate(Map.of());

        assertEquals(1346, result.size());
        assertEquals(AchievementCatalog.definitions().size(), result.size());
        assertTrue(result.stream().allMatch(item -> item.progress() == 0));
        assertTrue(result.stream().noneMatch(AchievementProgress::unlocked));
    }

    @Test
    void restoresBroadUniqueAchievementScopeWithoutCountingTiersAsAchievements() {
        Set<String> familyKeys = AchievementCatalog.definitions().stream()
                .map(AchievementDefinition::familyKey)
                .collect(Collectors.toSet());

        assertEquals(380, familyKeys.size());
        assertEquals(1346, AchievementCatalog.definitions().size());

        assertTrue(familyKeys.contains("battle_tracker"));
        assertTrue(familyKeys.contains("perfect_cwl_season"));
        assertTrue(familyKeys.contains("war_triple_machine"));
        assertTrue(familyKeys.contains("cwl_reliable_attacker"));
        assertTrue(familyKeys.contains("family_champion"));
        assertTrue(familyKeys.contains("hall_of_fame"));
        assertTrue(familyKeys.contains("planner_architect"));
        assertTrue(familyKeys.contains("season_donor"));
        assertTrue(familyKeys.contains("tracked_gold_raider"));
        assertTrue(familyKeys.contains("mastery_home_troop_archer"));
        assertTrue(familyKeys.contains("mastery_home_hero_dragon_duke"));
        assertTrue(familyKeys.contains("mastery_equipment_fireball"));
        assertTrue(familyKeys.contains("native_war_hero"));
        assertTrue(familyKeys.contains("native_league_follower"));
        assertTrue(familyKeys.contains("archive_buildings"));
    }

    @Test
    void individualMasteriesRemainOneAchievementWithRealTiers() {
        var archer = AchievementCatalog.definitions().stream()
                .filter(definition -> definition.familyKey().equals("mastery_home_troop_archer"))
                .toList();
        assertEquals(4, archer.size());
        assertEquals(25, archer.get(0).target());
        assertEquals(50, archer.get(1).target());
        assertEquals(75, archer.get(2).target());
        assertEquals(100, archer.get(3).target());
    }

    @Test
    void regularWarTargetsNeverAssumeMoreThanTwoAttacks() {
        assertEquals(2, finalTarget("war_attack_duty"));
        assertEquals(6, finalTarget("war_star_burst"));
        assertEquals(200, finalTarget("war_destruction_burst"));
        assertEquals(2, finalTarget("war_triple_machine"));
        assertEquals(2, finalTarget("war_two_star_specialist"));
        assertEquals(2, finalTarget("war_underdog_slayer"));
    }

    @Test
    void classifiesExpandedAchievementsByTheirRealDataSource() {
        assertEquals(AchievementSources.LIVE_PROFILE, AchievementSources.forMetric("profile_war_stars"));
        assertEquals(AchievementSources.LIVE_PROFILE, AchievementSources.forMetric("mastery_home_archer"));
        assertEquals(AchievementSources.LIVE_PROFILE, AchievementSources.forMetric("native_stars_war_hero"));
        assertEquals(AchievementSources.WAR, AchievementSources.forMetric("war_current_three_stars"));
        assertEquals(AchievementSources.CWL, AchievementSources.forMetric("cwl_perfect_seasons"));
        assertEquals(AchievementSources.CLASHPANEL, AchievementSources.forMetric("clashpanel_plans_owned"));
        assertEquals(AchievementSources.CLAN_FAMILY, AchievementSources.forMetric("family_polls_answered"));
        assertEquals(AchievementSources.ADVANCED_STATS, AchievementSources.forMetric("tracked_gold_looted"));
        assertEquals(AchievementSources.MIXED, AchievementSources.forMetric("fun_social_score"));
        assertEquals(AchievementSources.BASE_DATA, AchievementSources.forMetric("home_wall_count"));
        assertEquals(AchievementSources.BASE_HISTORY, AchievementSources.forMetric("tracked_days"));
    }

    @Test
    void keepsFiniteGameProgressionTargetsReachableAndMeaningful() {
        Map<String, Long> expectedFinalTargets = Map.ofEntries(
                Map.entry("village_builder", 90L),
                Map.entry("gear_engineer", 3L),
                Map.entry("hero_power", 475L),
                Map.entry("army_scholar", 300L),
                Map.entry("siege_engineer", 48L),
                Map.entry("pet_keeper", 12L),
                Map.entry("pet_trainer", 145L),
                Map.entry("equipment_mastery", 850L),
                Map.entry("helper_mastery", 27L),
                Map.entry("builder_wall_grinder", 1750L),
                Map.entry("builder_hero_power", 70L),
                Map.entry("builder_army_power", 235L),
                Map.entry("module_engineer", 9L),
                Map.entry("module_mastery", 90L)
        );

        for (var entry : expectedFinalTargets.entrySet()) {
            assertEquals(entry.getValue().longValue(), finalTarget(entry.getKey()), entry.getKey());
        }

        var gearTiers = AchievementCatalog.definitions().stream()
                .filter(definition -> definition.familyKey().equals("gear_engineer"))
                .toList();
        assertEquals(3, gearTiers.size());
        assertEquals("legendary", gearTiers.getLast().rarity());
        assertEquals(400, gearTiers.getLast().xp());
    }

    private static long finalTarget(String familyKey) {
        var tiers = AchievementCatalog.definitions().stream()
                .filter(definition -> definition.familyKey().equals(familyKey))
                .toList();
        assertFalse(tiers.isEmpty(), familyKey);
        return tiers.getLast().target();
    }
}

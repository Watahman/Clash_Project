package Java.achievements;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AchievementEvaluatorTest {
    @Test
    void loadsExactV2CatalogCounts() {
        Set<String> familyKeys = AchievementCatalog.definitions().stream()
                .map(AchievementDefinition::familyKey)
                .collect(Collectors.toSet());

        assertEquals(340, AchievementSpecV2Catalog.sourceFamilyCount());
        assertEquals(1331, AchievementSpecV2Catalog.sourceFixedTierCount());
        assertEquals(340, familyKeys.size());
        assertEquals(1331, AchievementCatalog.definitions().size());
        assertEquals("player", AchievementSpecV2Catalog.metadata("PLY_TH_1").scope());
        assertEquals("clan", AchievementSpecV2Catalog.metadata("CL_LEVEL_1").scope());

        for (String required : List.of(
                "PLY_TH", "OFF_HERO_SUM", "WAR_ATTACKS", "CWL_SEASONS",
                "RAID_WEEKENDS", "APP_BASE_IMPORT_FIRST", "DYN_OFFICIAL_ACHIEVEMENT"
        )) assertTrue(familyKeys.contains(required), required);
    }

    @Test
    void townHallTrailblazerMatchesOriginalSevenTiers() {
        var tiers = family("PLY_TH");
        assertEquals(7, tiers.size());
        assertEquals(List.of(5L, 8L, 10L, 12L, 14L, 16L, 18L),
                tiers.stream().map(AchievementDefinition::target).toList());
        assertEquals(List.of("common", "uncommon", "rare", "epic", "legendary", "mythic", "mythic"),
                tiers.stream().map(AchievementDefinition::rarity).toList());
        assertEquals(List.of(50, 100, 200, 400, 800, 1500, 1500),
                tiers.stream().map(AchievementDefinition::xp).toList());
    }

    @Test
    void directMetricsUnlockOnlyReachedV2Tiers() {
        AchievementEvaluator evaluator = new AchievementEvaluator();
        var tiers = evaluator.evaluate(Map.of("profile_town_hall", 13L)).stream()
                .filter(item -> item.definition().familyKey().equals("PLY_TH"))
                .toList();

        assertEquals(7, tiers.size());
        assertTrue(tiers.get(0).measurable());
        assertTrue(tiers.get(0).unlocked());
        assertTrue(tiers.get(3).unlocked());
        assertFalse(tiers.get(4).unlocked());
    }

    @Test
    void completionistFractionsUsePercentageMetricTargets() {
        var definitions = family("PLY_ACH_PROGRESS");
        assertEquals(List.of(25L, 50L, 75L, 90L, 100L),
                definitions.stream().map(AchievementDefinition::target).toList());

        AchievementEvaluator evaluator = new AchievementEvaluator();
        assertEquals(0, unlockedCount(evaluator, 24L));
        assertEquals(1, unlockedCount(evaluator, 25L));
        assertEquals(2, unlockedCount(evaluator, 50L));
        assertEquals(4, unlockedCount(evaluator, 90L));
        assertEquals(5, unlockedCount(evaluator, 100L));
    }

    @Test
    void missingOrUnsupportedEvidenceStaysUnknownInsteadOfZero() {
        AchievementEvaluator evaluator = new AchievementEvaluator();
        var warAttack = evaluator.evaluate(Map.of()).stream()
                .filter(item -> item.definition().familyKey().equals("WAR_ATTACKS"))
                .findFirst()
                .orElseThrow();

        assertFalse(warAttack.measurable());
        assertEquals(0, warAttack.progress());
        assertFalse(warAttack.unlocked());

        JsonObject json = evaluator.toJson(List.of(warAttack)).get(0).getAsJsonObject();
        assertFalse(json.get("progress_known").getAsBoolean());
        assertEquals("player", json.get("scope").getAsString());
    }

    @Test
    void raidCountersAndPeaksUseNormalizedHistoryMetrics() {
        AchievementEvaluator evaluator = new AchievementEvaluator();
        var progress = evaluator.evaluate(Map.of(
                "raid_weekends", 5L,
                "raid_attacks", 50L,
                "raid_loot", 100_000L,
                "raid_weekend_loot", 25_000L,
                "raid_full_weekends", 5L,
                "raid_bonus_weekends", 5L,
                "raid_top_looter_weekends", 3L
        ));

        for (String family : List.of(
                "RAID_WEEKENDS", "RAID_ATTACKS", "RAID_LOOT",
                "RAID_WEEKEND_LOOT", "RAID_FULL_ATTACKS", "RAID_BONUS",
                "RAID_TOP_LOOTER_COUNT"
        )) {
            assertEquals(2, progress.stream()
                    .filter(item -> item.definition().familyKey().equals(family))
                    .filter(AchievementProgress::unlocked)
                    .count(), family);
        }
    }

    @Test
    void lowerLegendRankIsBetterAndRequiresPositiveEvidence() {
        AchievementEvaluator evaluator = new AchievementEvaluator();
        var ranked = evaluator.evaluate(Map.of(
                "legend_best_season_rank", 999L,
                "ranking_best_global_rank", 999L,
                "legend_best_season_trophies", 5_500L,
                "legend_ranked_seasons", 6L
        ));

        assertEquals(3, unlockedInFamily(ranked, "LEG_EOS_RANK"));
        assertEquals(3, unlockedInFamily(ranked, "TR_GLOBAL_RANK"));
        assertEquals(3, unlockedInFamily(ranked, "LEG_EOS_TROPHIES"));
        assertEquals(3, unlockedInFamily(ranked, "TR_RANKED_SEASONS"));
        assertEquals(0, unlockedInFamily(
                evaluator.evaluate(Map.of("legend_best_season_rank", 0L)),
                "LEG_EOS_RANK"
        ));
    }

    @Test
    void secretCombinationFamiliesStayRoutedToMixedEvidence() {
        AchievementDefinition secret = family("SEC_LUCKY_SEVEN").getFirst();
        assertEquals(AchievementSources.MIXED, AchievementSources.forDefinition(secret));
    }

    @Test
    void reliableClanMetricsUnlockSharedFamiliesAndMissingEvidenceStaysUnknown() {
        AchievementEvaluator evaluator = new AchievementEvaluator();
        var measured = evaluator.evaluate(Map.of(
                "clan_level", 20L,
                "clan_members", 40L,
                "clan_war_wins", 500L,
                "clan_war_win_streak", 10L,
                "clan_capital_points", 2_500L,
                "clan_donations", 100_000L,
                "clan_donor_participation_pct", 75L,
                "clan_balanced_roster", 1L
        ));
        for (String family : List.of(
                "CL_LEVEL", "CL_MEMBERS", "CL_WAR_WINS", "CL_WIN_STREAK",
                "CL_CAPITAL_POINTS", "CL_DONATIONS", "CL_DONOR_PARTICIPATION",
                "CL_BALANCED_ROSTER"
        )) {
            var rows = measured.stream().filter(item -> item.definition().familyKey().equals(family)).toList();
            assertTrue(rows.stream().anyMatch(AchievementProgress::unlocked), family);
            assertTrue(rows.stream().allMatch(item -> "clan".equals(
                    AchievementSpecV2Catalog.metadata(item.definition().key()).scope()
            )), family);
            assertTrue(evaluator.evaluate(Map.of()).stream()
                    .filter(item -> item.definition().familyKey().equals(family))
                    .noneMatch(AchievementProgress::measurable), family);
        }
    }

    @Test
    void mixedNumericAndCatalogDependentTiersDoNotFalseUnlock() {
        AchievementEvaluator evaluator = new AchievementEvaluator();
        var gear = evaluator.evaluate(Map.of("gear_up_count", 3L)).stream()
                .filter(item -> item.definition().familyKey().equals("BASE_HOME_GEARUPS"))
                .toList();

        assertEquals(4, gear.size());
        assertTrue(gear.get(0).measurable());
        assertTrue(gear.get(2).measurable());
        assertTrue(gear.get(2).unlocked());
        assertFalse(gear.get(3).measurable());
        assertFalse(gear.get(3).unlocked());
    }

    @Test
    void dynamicOfficialAchievementUsesSpecV2Shape() {
        AchievementEvaluator evaluator = new AchievementEvaluator();
        JsonObject official = new JsonObject();
        official.addProperty("name", "War Hero");
        official.addProperty("village", "home");
        official.addProperty("value", 1000);
        official.addProperty("target", 1000);
        official.addProperty("stars", 3);
        official.addProperty("info", "Earn stars for your clan in Clan War battles");
        official.addProperty("completionInfo", "Earn 1000 stars for your clan in Clan War battles");
        JsonArray input = new JsonArray();
        input.add(official);

        JsonObject badge = evaluator.dynamicOfficialAchievements(input, true).get(0).getAsJsonObject();
        assertTrue(badge.get("achievement_key").getAsString().startsWith("OFFICIAL_"));
        assertEquals(25, badge.get("achievement_key").getAsString().length());
        assertEquals("War Hero", badge.get("title").getAsString());
        assertEquals("uncommon", badge.get("rarity").getAsString());
        assertEquals(100, badge.get("xp").getAsInt());
        assertEquals(1000, badge.get("progress").getAsLong());
        assertEquals(1000, badge.get("target").getAsLong());
        assertTrue(badge.get("unlocked").getAsBoolean());
    }

    private static List<AchievementDefinition> family(String familyKey) {
        return AchievementCatalog.definitions().stream()
                .filter(definition -> definition.familyKey().equals(familyKey))
                .toList();
    }

    private static long unlockedCount(AchievementEvaluator evaluator, long completionPercentage) {
        return evaluator.evaluate(Map.of("profile_achievement_completion_pct", completionPercentage)).stream()
                .filter(item -> item.definition().familyKey().equals("PLY_ACH_PROGRESS"))
                .filter(AchievementProgress::unlocked)
                .count();
    }

    private static long unlockedInFamily(List<AchievementProgress> progress, String familyKey) {
        return progress.stream()
                .filter(item -> item.definition().familyKey().equals(familyKey))
                .filter(AchievementProgress::unlocked)
                .count();
    }
}

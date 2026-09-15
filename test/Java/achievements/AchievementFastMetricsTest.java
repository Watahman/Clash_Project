package Java.achievements;

import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class AchievementFastMetricsTest {
    @Test
    void derivesPetLevelSumOnlyWhenEveryReturnedPetHasALevel() {
        var profile = JsonParser.parseString("""
                {
                  "pets": [
                    {"name":"L.A.S.S.I.","level":10},
                    {"name":"Electro Owl","level":8}
                  ]
                }
                """).getAsJsonObject();

        Map<String, Long> metrics = AchievementFastMetrics.profileMetrics(profile);

        assertEquals(18L, metrics.get("profile_pet_level_sum"));
    }

    @Test
    void leavesPetLevelUnknownWhenPetEvidenceIsMissingOrPartial() {
        var missing = JsonParser.parseString("{}").getAsJsonObject();
        var empty = JsonParser.parseString("{\"pets\":[]}").getAsJsonObject();
        var partial = JsonParser.parseString("""
                {"pets": [{"name":"L.A.S.S.I."}]}
                """).getAsJsonObject();

        assertFalse(AchievementFastMetrics.profileMetrics(missing).containsKey("profile_pet_level_sum"));
        assertFalse(AchievementFastMetrics.profileMetrics(empty).containsKey("profile_pet_level_sum"));
        assertFalse(AchievementFastMetrics.profileMetrics(partial).containsKey("profile_pet_level_sum"));
    }

    @Test
    void derivesMaxCountsAndAllMaxFlagsFromCompleteVillageArrays() {
        var profile = JsonParser.parseString("""
                {
                  "heroes": [
                    {"name":"Archer Queen","village":"home","level":80,"maxLevel":80},
                    {"name":"Barbarian King","village":"home","level":79,"maxLevel":80},
                    {"name":"Grand Warden","village":"home","level":78,"maxLevel":80},
                    {"name":"Battle Machine","village":"builderBase","level":40,"maxLevel":40},
                    {"name":"Battle Copter","village":"builderBase","level":39,"maxLevel":40}
                  ],
                  "troops": [
                    {"name":"Barbarian","village":"home","level":12,"maxLevel":12},
                    {"name":"Archer","village":"home","level":11,"maxLevel":12},
                    {"name":"Wall Wrecker","village":"home","level":5,"maxLevel":5},
                    {"name":"Cannon Cart","village":"builderBase","level":18,"maxLevel":18}
                  ],
                  "spells": [
                    {"name":"Lightning Spell","village":"home","level":9,"maxLevel":9},
                    {"name":"Freeze Spell","village":"home","level":6,"maxLevel":7}
                  ],
                  "pets": [
                    {"name":"L.A.S.S.I","village":"home","level":10,"maxLevel":10},
                    {"name":"Diggy","village":"home","level":8,"maxLevel":10}
                  ],
                  "heroEquipment": [
                    {"name":"Giant Gauntlet","level":10,"maxLevel":10}
                  ]
                }
                """).getAsJsonObject();

        Map<String, Long> metrics = AchievementFastMetrics.profileMetrics(profile);

        assertEquals(1L, metrics.get("profile_home_hero_max_count"));
        assertEquals(0L, metrics.get("profile_all_home_heroes_max"));
        assertEquals(1L, metrics.get("profile_builder_hero_max_count"));
        assertEquals(0L, metrics.get("profile_all_builder_heroes_max"));
        assertEquals(1L, metrics.get("profile_home_troop_max_count"));
        assertEquals(0L, metrics.get("profile_all_home_troops_max"));
        assertEquals(1L, metrics.get("profile_builder_troop_max_count"));
        assertEquals(1L, metrics.get("profile_all_builder_troops_max"));
        assertEquals(1L, metrics.get("profile_siege_max_count"));
        assertEquals(1L, metrics.get("profile_all_siege_max"));
        assertEquals(1L, metrics.get("profile_home_spell_max_count"));
        assertEquals(0L, metrics.get("profile_all_home_spells_max"));
        assertEquals(1L, metrics.get("profile_pet_max_count"));
        assertEquals(0L, metrics.get("profile_all_pets_max"));
        assertEquals(1L, metrics.get("profile_equipment_max_count"));
        assertEquals(1L, metrics.get("profile_all_returned_equipment_max"));
        assertEquals(98L, metrics.get("profile_home_hero_completion_pct"));
        assertEquals(98L, metrics.get("profile_builder_hero_completion_pct"));
        assertEquals(95L, metrics.get("profile_home_troop_completion_pct"));
        assertEquals(100L, metrics.get("profile_builder_troop_completion_pct"));
        assertEquals(100L, metrics.get("profile_siege_completion_pct"));
        assertEquals(93L, metrics.get("profile_home_spell_completion_pct"));
        assertEquals(90L, metrics.get("profile_pet_completion_pct"));
        assertEquals(100L, metrics.get("profile_equipment_completion_pct"));
        assertEquals(97L, metrics.get("profile_offense_completion_pct"));
        assertEquals(98L, metrics.get("profile_builder_offense_completion_pct"));
        assertEquals(1L, metrics.get("profile_balanced_heroes"));
        assertEquals(1L, metrics.get("profile_balanced_army"));
    }

    @Test
    void omitsProgressionMetricsWhenAnArrayContainsUnknownOrIncompleteEvidence() {
        var profile = JsonParser.parseString("""
                {
                  "heroes": [
                    {"name":"Archer Queen","village":"home","level":80}
                  ],
                  "troops": [
                    {"name":"Future Troop","village":"home","level":1,"maxLevel":1},
                    {"name":"Barbarian","village":"home","level":12}
                  ],
                  "spells": [
                    {"name":"Lightning Spell","village":"home","level":9}
                  ],
                  "pets": [
                    {"name":"L.A.S.S.I","village":"home","level":10}
                  ]
                }
                """).getAsJsonObject();

        Map<String, Long> metrics = AchievementFastMetrics.profileMetrics(profile);

        assertFalse(metrics.containsKey("profile_home_hero_max_count"));
        assertFalse(metrics.containsKey("profile_home_troop_max_count"));
        assertFalse(metrics.containsKey("profile_siege_max_count"));
        assertFalse(metrics.containsKey("profile_home_spell_max_count"));
        assertFalse(metrics.containsKey("profile_pet_max_count"));
        assertFalse(metrics.containsKey("profile_equipment_max_count"));
        assertFalse(metrics.containsKey("profile_offense_completion_pct"));
        assertFalse(metrics.containsKey("profile_balanced_army"));
    }

    @Test
    void keepsKnownTroopProgressWhenAnUnclassifiedHomeUnitIsReturned() {
        var profile = JsonParser.parseString("""
                {
                  "troops": [
                    {"name":"Barbarian","village":"home","level":12,"maxLevel":12},
                    {"name":"Future Unit","village":"home","level":1,"maxLevel":1}
                  ]
                }
                """).getAsJsonObject();

        Map<String, Long> metrics = AchievementFastMetrics.profileMetrics(profile);

        assertEquals(1L, metrics.get("profile_home_troop_max_count"));
        assertFalse(metrics.containsKey("profile_all_home_troops_max"));
        assertFalse(metrics.containsKey("profile_home_troop_completion_pct"));
        assertFalse(metrics.containsKey("profile_siege_max_count"));
    }
}

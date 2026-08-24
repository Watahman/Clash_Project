package Java.advancedstats;

import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ArmyShareCodeParserTest {
    private final ArmyShareCodeParser parser = new ArmyShareCodeParser();

    @Test
    void parsesTroopsSpellsClanCastleAndHeroLoadout() throws Exception {
        var army = parser.parse("u10x0-2x5s3x2i1x110d1x5h0p3e10_1");
        Map<String, AdvancedStatsModels.UnitUsage> byKey = army.units().stream()
                .collect(Collectors.toMap(
                        unit -> unit.category().name() + ":" + unit.unitKey(),
                        Function.identity()
                ));

        assertEquals(10, byKey.get("TROOP:troop_4000000").quantity());
        assertEquals("Barbarian", byKey.get("TROOP:troop_4000000").unitName());
        assertEquals(2, byKey.get("TROOP:troop_4000005").quantity());
        assertEquals(3, byKey.get("SPELL:spell_26000002").quantity());
        assertEquals("Root Rider", byKey.get("CLAN_CASTLE_TROOP:troop_4000110").unitName());
        assertEquals("Freeze Spell", byKey.get("CLAN_CASTLE_SPELL:spell_26000005").unitName());
        assertEquals("Barbarian King", byKey.get("HERO:hero_2000000").unitName());
        assertEquals("Unicorn", byKey.get("PET:pet_60000003").unitName());
        assertEquals("Giant Gauntlet", byKey.get("EQUIPMENT:equipment_30000010").unitName());
        assertEquals("Rage Vial", byKey.get("EQUIPMENT:equipment_30000001").unitName());
        assertTrue(army.armyDataAvailable());
        assertEquals(64, army.normalizedArmyHash().length());
    }

    @Test
    void recognizesSiegeMachinesSeparatelyFromTroops() throws Exception {
        var army = parser.parse("u1x51-1x91-1x188-8x110");

        assertTrue(army.units().stream().anyMatch(unit ->
                unit.category() == AdvancedStatsUnitCategory.SIEGE
                        && unit.unitName().equals("Wall Wrecker")));
        assertTrue(army.units().stream().anyMatch(unit ->
                unit.category() == AdvancedStatsUnitCategory.SIEGE
                        && unit.unitName().equals("Flame Flinger")));
        assertTrue(army.units().stream().anyMatch(unit ->
                unit.category() == AdvancedStatsUnitCategory.SIEGE
                        && unit.unitName().equals("Sky Wagon")));
        assertTrue(army.units().stream().anyMatch(unit ->
                unit.category() == AdvancedStatsUnitCategory.TROOP
                        && unit.unitName().equals("Root Rider")));
    }

    @Test
    void classifiesCurrentSuperTroopsWithoutMixingThemIntoRegularTroops() throws Exception {
        var army = parser.parse("u5x26-4x27-3x98-2x147");

        assertTrue(army.units().stream().anyMatch(unit ->
                unit.category() == AdvancedStatsUnitCategory.SUPER_TROOP
                        && unit.unitName().equals("Super Barbarian")));
        assertTrue(army.units().stream().anyMatch(unit ->
                unit.category() == AdvancedStatsUnitCategory.SUPER_TROOP
                        && unit.unitName().equals("Super Archer")));
        assertTrue(army.units().stream().anyMatch(unit ->
                unit.category() == AdvancedStatsUnitCategory.SUPER_TROOP
                        && unit.unitName().equals("Super Hog Rider")));
        assertTrue(army.units().stream().anyMatch(unit ->
                unit.category() == AdvancedStatsUnitCategory.SUPER_TROOP
                        && unit.unitName().equals("Super Yeti")));
    }

    @Test
    void resolvesNewCurrentTroopAndSpellMetadata() throws Exception {
        var army = parser.parse("u2x109s1x123");

        assertTrue(army.units().stream().anyMatch(unit -> unit.unitName().equals("Ruin Witch")));
        assertTrue(army.units().stream().anyMatch(unit -> unit.unitName().equals("Angry Spell")));
    }

    @Test
    void clanCastleSuperTroopKeepsClanCastleCategoryButResolvedName() throws Exception {
        var army = parser.parse("i2x27");

        assertTrue(army.units().stream().anyMatch(unit ->
                unit.category() == AdvancedStatsUnitCategory.CLAN_CASTLE_TROOP
                        && unit.unitName().equals("Super Archer")));
    }

    @Test
    void fullShareLinkAndRawPayloadNormalizeIdentically() throws Exception {
        var raw = parser.parse("u10x0-2x5s3x2");
        var link = parser.parse(
                "https://link.clashofclans.com/en?action=CopyArmy&army=u10x0-2x5s3x2"
        );

        assertEquals(raw.normalizedArmyJson(), link.normalizedArmyJson());
        assertEquals(raw.normalizedArmyHash(), link.normalizedArmyHash());
    }

    @Test
    void fullLinkWithoutArmyParameterIsRejected() {
        assertThrows(
                ArmyShareCodeParser.ArmyParseException.class,
                () -> parser.parse("https://link.clashofclans.com/en?action=CopyArmy")
        );
    }

    @Test
    void orderingDoesNotChangeNormalizedArmyHash() throws Exception {
        var first = parser.parse("u10x0-2x5s3x2");
        var second = parser.parse("s3x2u2x5-10x0");

        assertEquals(first.normalizedArmyHash(), second.normalizedArmyHash());
    }

    @Test
    void quantityChangesArmyHash() throws Exception {
        var first = parser.parse("u10x0s3x2");
        var second = parser.parse("u11x0s3x2");

        assertNotEquals(first.normalizedArmyHash(), second.normalizedArmyHash());
    }

    @Test
    void unknownIdsAreRetainedInsteadOfCrashing() throws Exception {
        var army = parser.parse("u1x999s1x999");

        assertTrue(army.units().stream().anyMatch(unit ->
                unit.unitKey().equals("unknown_4000999")
                        && unit.category() == AdvancedStatsUnitCategory.TROOP));
        assertTrue(army.units().stream().anyMatch(unit ->
                unit.unitKey().equals("unknown_26000999")
                        && unit.category() == AdvancedStatsUnitCategory.SPELL));
    }

    @Test
    void malformedPayloadFailsInsteadOfPartiallyCounting() {
        var error = assertThrows(
                ArmyShareCodeParser.ArmyParseException.class,
                () -> parser.parse("u10x0-bads3x2")
        );
        assertFalse(error.getMessage().isBlank());
    }
}

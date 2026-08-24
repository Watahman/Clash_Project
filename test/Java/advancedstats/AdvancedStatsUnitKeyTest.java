package Java.advancedstats;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class AdvancedStatsUnitKeyTest {
    @Test
    void superTroopUsesSameUnitKeyInArmyAndClanCastle() throws Exception {
        ArmyShareCodeParser parser = new ArmyShareCodeParser();

        var home = parser.parse("u2x27").units().getFirst();
        var clanCastle = parser.parse("i2x27").units().getFirst();

        assertEquals("troop_4000027", home.unitKey());
        assertEquals(home.unitKey(), clanCastle.unitKey());
        assertEquals(AdvancedStatsUnitCategory.SUPER_TROOP, home.category());
        assertEquals(AdvancedStatsUnitCategory.CLAN_CASTLE_TROOP, clanCastle.category());
    }
}

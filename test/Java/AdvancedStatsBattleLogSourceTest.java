package Java;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AdvancedStatsBattleLogSourceTest {
    @Test
    void buildsEncodedBattleLogPathFromNormalizedTag() {
        assertEquals(
                "/players/%232PYLQ/battlelog",
                AdvancedStatsBattleLogSource.battleLogPath("2pylq")
        );
    }

    @Test
    void rejectsInvalidPlayerTagBeforeAnyNetworkCall() {
        assertThrows(
                IllegalArgumentException.class,
                () -> AdvancedStatsBattleLogSource.battleLogPath("not-a-tag")
        );
    }
}

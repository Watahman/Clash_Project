package Java.advancedstats;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdvancedStatsScopeSelectionTest {
    @Test
    void mapsUserSelectionsToStoredScopes() {
        assertEquals(List.of(AdvancedStatsScope.NORMAL),
                AdvancedStatsScopeSelection.parse("regular").scopes());
        assertEquals(List.of(AdvancedStatsScope.NORMAL),
                AdvancedStatsScopeSelection.parse("normal").scopes());
        assertEquals(List.of(AdvancedStatsScope.WAR, AdvancedStatsScope.RANKED),
                AdvancedStatsScopeSelection.parse("competitive").scopes());
        assertEquals(List.of(AdvancedStatsScope.NORMAL, AdvancedStatsScope.WAR, AdvancedStatsScope.RANKED),
                AdvancedStatsScopeSelection.parse("all").scopes());
    }

    @Test
    void blankSelectionIsTheBackwardCompatibleUnscopedRead() {
        AdvancedStatsScopeSelection selection = AdvancedStatsScopeSelection.parse(null);

        assertTrue(selection.isAll());
        assertFalse(selection.supplied());
    }

    @Test
    void rejectsUnknownSelectionInsteadOfTreatingItAsNormal() {
        assertThrows(IllegalArgumentException.class,
                () -> AdvancedStatsScopeSelection.parse("unknown"));
    }
}

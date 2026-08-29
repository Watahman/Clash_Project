package Java.advancedstats;

import Java.advancedstats.AdvancedStatsHistoryModels.AttackObservation;
import Java.advancedstats.AdvancedStatsHistoryModels.UnitObservation;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdvancedStatsCompactEventFingerprintTest {
    private static final Instant EVENT_AT = Instant.parse("2026-08-14T20:00:00Z");

    @Test
    void fingerprintIsStableWhenProviderChangesUnitOrdering() {
        AttackObservation first = observation(List.of(
                new UnitObservation("wizard", "Wizard", AdvancedStatsUnitCategory.TROOP, 2, 10),
                new UnitObservation("barbarian", "Barbarian", AdvancedStatsUnitCategory.TROOP, 10, 12)));
        AttackObservation reordered = observation(List.of(
                new UnitObservation("barbarian", "Barbarian", AdvancedStatsUnitCategory.TROOP, 10, 12),
                new UnitObservation("wizard", "Wizard", AdvancedStatsUnitCategory.TROOP, 2, 10)));

        assertEquals(AdvancedStatsCompactEventFingerprint.forObservation(first),
                AdvancedStatsCompactEventFingerprint.forObservation(reordered));
        assertEquals(64, AdvancedStatsCompactEventFingerprint.forObservation(first).length());
    }

    @Test
    void unavailableArmyDoesNotProducePersistableArmyPayload() {
        AdvancedStatsCompactEventFingerprint.NormalizedArmy army =
                AdvancedStatsCompactEventFingerprint.normalizedArmy(observation(List.of()));

        assertFalse(army.available());
        assertTrue(army.hash().isBlank());
        assertTrue(army.json().isBlank());
    }

    @Test
    void fingerprintIgnoresProviderEventKeysAndDisplayNames() {
        AttackObservation first = new AttackObservation("v2:provider-id", AdvancedStatsScope.NORMAL, EVENT_AT,
                true, "normal", "#9GCUV", 16, 16, 3, 100d,
                List.of(new UnitObservation("unit-1", "V2 display", AdvancedStatsUnitCategory.TROOP, 5, 10)),
                1, 2, 3);
        AttackObservation fallback = new AttackObservation("legacy:provider-id", AdvancedStatsScope.NORMAL, EVENT_AT,
                true, "multiplayer", "#9GCUV", 17, 15, 3, 100.0,
                List.of(new UnitObservation("unit-1", "Official display", AdvancedStatsUnitCategory.TROOP, 5, 12)),
                1, 2, 3);

        assertEquals(AdvancedStatsCompactEventFingerprint.forObservation(first),
                AdvancedStatsCompactEventFingerprint.forObservation(fallback));
    }

    @Test
    void normalFingerprintIgnoresRollingObservationTime() {
        AttackObservation firstPoll = observationAt(EVENT_AT, "official:first");
        AttackObservation laterPoll = observationAt(EVENT_AT.plusSeconds(900), "official:second");

        assertEquals(AdvancedStatsCompactEventFingerprint.forObservation(firstPoll),
                AdvancedStatsCompactEventFingerprint.forObservation(laterPoll));
    }

    @Test
    void normalFingerprintStillSeparatesDifferentBattles() {
        AttackObservation first = observationAt(EVENT_AT, "official:first");
        AttackObservation differentOpponent = new AttackObservation("official:second", AdvancedStatsScope.NORMAL,
                EVENT_AT.plusSeconds(900), true, "multiplayer", "#OTHER", 16, 16, 3, 100d,
                first.units(), 1, 2, 3);

        assertNotEquals(AdvancedStatsCompactEventFingerprint.forObservation(first),
                AdvancedStatsCompactEventFingerprint.forObservation(differentOpponent));
    }

    @Test
    void fingerprintUsesCanonicalWarIdentityAcrossProviderSideLabels() {
        AttackObservation v2 = new AttackObservation("war:war-1:attacks:7", AdvancedStatsScope.WAR,
                EVENT_AT, true, "war", "", 16, 16, 3, 100d, List.of(), 0, 0, 0);
        AttackObservation legacy = new AttackObservation("war:war-1:attack:00000007", AdvancedStatsScope.WAR,
                EVENT_AT, true, "war", "", 16, 16, 3, 100d, List.of(), 0, 0, 0);
        AttackObservation nextOrder = new AttackObservation("war:war-1:attack:00000008", AdvancedStatsScope.WAR,
                EVENT_AT, true, "war", "", 16, 16, 3, 100d, List.of(), 0, 0, 0);

        assertEquals(AdvancedStatsCompactEventFingerprint.forObservation(v2),
                AdvancedStatsCompactEventFingerprint.forObservation(legacy));
        assertNotEquals(
                AdvancedStatsCompactEventFingerprint.forObservation(v2),
                AdvancedStatsCompactEventFingerprint.forObservation(nextOrder));
    }

    private static AttackObservation observation(List<UnitObservation> units) {
        return new AttackObservation("provider-event", AdvancedStatsScope.NORMAL, EVENT_AT, true,
                "normal", "#9GCUV", 16, 16, 3, 100d, units, 1, 2, 3);
    }

    private static AttackObservation observationAt(Instant occurredAt, String eventKey) {
        return new AttackObservation(eventKey, AdvancedStatsScope.NORMAL, occurredAt, true,
                "multiplayer", "#9GCUV", 16, 16, 3, 100d,
                List.of(new UnitObservation("unit-1", "Unit", AdvancedStatsUnitCategory.TROOP, 5, 10)),
                1, 2, 3);
    }
}

package Java.advancedstats;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdvancedStatsBattleProcessorTest {
    private static final UUID TRACKING_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID USER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID BATTLE_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");
    private static final Instant STARTED = Instant.parse("2026-08-07T10:00:00Z");
    private static final Instant OBSERVED = Instant.parse("2026-08-07T13:00:00Z");

    @Test
    void processedAttackPersistsExactlyOnceThroughStoreBoundary() throws Exception {
        FakeStore store = new FakeStore();
        AdvancedStatsBattleProcessor processor = processor(store);

        var result = processor.process(tracking(), battle(true, "u8x110s2x2"), true);

        assertEquals(AdvancedStatsBattleProcessor.Outcome.INSERTED, result.outcome());
        assertEquals(BATTLE_ID, result.battleId());
        assertEquals(1, store.saveCalls);
        assertEquals(0, store.parserErrorCalls);
        assertTrue(store.bootstrapImport);
        assertTrue(store.lastArmy.armyDataAvailable());
        assertEquals(AdvancedStatsBattleProcessor.PARSER_VERSION, store.parserVersion);
    }

    @Test
    void duplicateStoreResultNeverProducesSecondInsertOutcome() throws Exception {
        FakeStore store = new FakeStore();
        store.duplicate = true;
        AdvancedStatsBattleProcessor processor = processor(store);

        var result = processor.process(tracking(), battle(true, "u8x110s2x2"), false);

        assertEquals(AdvancedStatsBattleProcessor.Outcome.DUPLICATE, result.outcome());
        assertEquals(1, store.saveCalls);
        assertNull(result.battleId());
    }

    @Test
    void malformedArmyIsRecordedAsParserErrorWithoutAggregateSave() throws Exception {
        FakeStore store = new FakeStore();
        AdvancedStatsBattleProcessor processor = processor(store);

        var result = processor.process(tracking(), battle(true, "u8x110-bad"), false);

        assertEquals(AdvancedStatsBattleProcessor.Outcome.PARSER_ERROR, result.outcome());
        assertEquals(0, store.saveCalls);
        assertEquals(1, store.parserErrorCalls);
        assertFalse(result.fingerprint().isBlank());
    }

    @Test
    void missingArmyCodeStillStoresPerformanceWithoutArmyCounters() throws Exception {
        FakeStore store = new FakeStore();
        AdvancedStatsBattleProcessor processor = processor(store);

        var result = processor.process(tracking(), battle(true, ""), false);

        assertEquals(AdvancedStatsBattleProcessor.Outcome.INSERTED, result.outcome());
        assertFalse(store.lastArmy.armyDataAvailable());
        assertTrue(store.lastArmy.units().isEmpty());
    }

    @Test
    void defenseNeverTouchesPersistence() throws Exception {
        FakeStore store = new FakeStore();
        AdvancedStatsBattleProcessor processor = processor(store);

        var result = processor.process(tracking(), battle(false, "u8x110s2x2"), false);

        assertEquals(AdvancedStatsBattleProcessor.Outcome.IGNORED_DEFENSE, result.outcome());
        assertEquals(0, store.saveCalls);
        assertEquals(0, store.parserErrorCalls);
    }

    @Test
    void playerMismatchIsRejectedBeforePersistence() {
        FakeStore store = new FakeStore();
        AdvancedStatsBattleProcessor processor = processor(store);
        var wrongPlayer = new AdvancedStatsModels.BattleCandidate(
                "#9GCUV",
                null,
                OBSERVED,
                true,
                "multiplayer",
                "#8GCUV",
                "Opponent",
                18,
                18,
                3,
                100.0,
                "u8x110",
                0,
                0,
                0
        );

        assertThrows(
                IllegalArgumentException.class,
                () -> processor.process(tracking(), wrongPlayer, false)
        );
        assertEquals(0, store.saveCalls);
    }

    private AdvancedStatsBattleProcessor processor(FakeStore store) {
        return new AdvancedStatsBattleProcessor(store, new ArmyShareCodeParser());
    }

    private AdvancedStatsModels.TrackingState tracking() {
        return new AdvancedStatsModels.TrackingState(
                TRACKING_ID,
                USER_ID,
                "#2PYLQ",
                "Player",
                18,
                AdvancedStatsTrackingStatus.ACTIVE,
                STARTED,
                STARTED,
                OBSERVED.minusSeconds(600),
                OBSERVED.minusSeconds(600),
                OBSERVED.plusSeconds(600),
                0,
                null,
                STARTED,
                12
        );
    }

    private AdvancedStatsModels.BattleCandidate battle(boolean attack, String armyShareCode) {
        return new AdvancedStatsModels.BattleCandidate(
                "#2PYLQ",
                null,
                OBSERVED,
                attack,
                "multiplayer",
                "#9GCUV",
                "Opponent",
                18,
                18,
                3,
                100.0,
                armyShareCode,
                500000,
                400000,
                5000
        );
    }

    private static final class FakeStore implements AdvancedStatsBattleProcessor.Store {
        private int saveCalls;
        private int parserErrorCalls;
        private boolean duplicate;
        private boolean bootstrapImport;
        private int parserVersion;
        private AdvancedStatsModels.ParsedArmy lastArmy;

        @Override
        public AdvancedStatsModels.SaveBattleResult saveProcessedBattle(
                UUID trackingId,
                AdvancedStatsModels.BattleCandidate battle,
                String fingerprint,
                AdvancedStatsModels.ParsedArmy army,
                boolean bootstrapImport,
                int parserVersion
        ) {
            saveCalls++;
            this.bootstrapImport = bootstrapImport;
            this.parserVersion = parserVersion;
            this.lastArmy = army;
            if (duplicate) return AdvancedStatsModels.SaveBattleResult.duplicate();
            return new AdvancedStatsModels.SaveBattleResult(true, BATTLE_ID);
        }

        @Override
        public boolean recordParserError(
                UUID trackingId,
                AdvancedStatsModels.BattleCandidate battle,
                String fingerprint,
                boolean bootstrapImport,
                int parserVersion
        ) {
            parserErrorCalls++;
            this.bootstrapImport = bootstrapImport;
            this.parserVersion = parserVersion;
            return true;
        }
    }
}

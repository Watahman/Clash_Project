package Java.advancedstats;

import Java.HttpException;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdvancedStatsScheduledCollectorTest {
    private static final Instant NOW = Instant.parse("2026-08-07T14:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID TRACKING_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @Test
    void activeTrackerWithNewBattlesGetsFastNextPollAndCompletesBootstrap() throws Exception {
        FakeStore store = new FakeStore(List.of(state(0, null)));
        AdvancedStatsScheduledCollector collector = collector(
                store,
                tag -> "{}",
                (tracking, raw, bootstrap) -> {
                    assertTrue(bootstrap);
                    return summary(3, 2, 1, 0);
                }
        );

        AdvancedStatsScheduledCollector.BatchSummary result = collector.runOnce();

        assertEquals(1, result.claimed());
        assertEquals(1, result.succeeded());
        assertEquals(2, result.insertedBattles());
        assertEquals(1, result.duplicateBattles());
        assertEquals(0, result.failed());
        assertEquals(NOW.plus(Duration.ofMinutes(15)), store.successNextPoll);
        assertTrue(store.bootstrapCompleted);
        assertFalse(store.workerId.isBlank());
    }

    @Test
    void idleSuccessfulTrackerUsesConservativeThirtyMinuteCadence() throws Exception {
        FakeStore store = new FakeStore(List.of(state(0, NOW.minus(Duration.ofDays(2)))));
        AdvancedStatsScheduledCollector collector = collector(
                store,
                tag -> "{}",
                (tracking, raw, bootstrap) -> {
                    assertFalse(bootstrap);
                    return summary(2, 0, 2, 0);
                }
        );

        collector.runOnce();

        assertEquals(NOW.plus(Duration.ofMinutes(30)), store.successNextPoll);
        assertFalse(store.bootstrapCompleted);
    }

    @Test
    void clashRateLimitUsesBackoffInsteadOfErroringTrackerImmediately() throws Exception {
        FakeStore store = new FakeStore(List.of(state(0, NOW.minus(Duration.ofDays(1)))));
        AdvancedStatsScheduledCollector collector = collector(
                store,
                tag -> { throw HttpException.upstream(429, "{}", "Clash API"); },
                (tracking, raw, bootstrap) -> summary(0, 0, 0, 0)
        );

        AdvancedStatsScheduledCollector.BatchSummary result = collector.runOnce();

        assertEquals(1, result.failed());
        assertEquals(1, result.rateLimited());
        assertEquals(AdvancedStatsScheduledCollector.FailureReason.RATE_LIMIT, store.failureReason);
        assertEquals(NOW.plus(Duration.ofMinutes(30)), store.failureNextPoll);
        assertEquals(3, store.degradedThreshold);
    }

    @Test
    void repeatedRateLimitsExponentiallyBackOffWithCap() throws Exception {
        FakeStore store = new FakeStore(List.of(state(2, NOW.minus(Duration.ofDays(1)))));
        AdvancedStatsScheduledCollector collector = collector(
                store,
                tag -> { throw HttpException.upstream(429, "{}", "Clash API"); },
                (tracking, raw, bootstrap) -> summary(0, 0, 0, 0)
        );

        collector.runOnce();

        // Third consecutive failure: 30m * 2^(3-1) = 120m.
        assertEquals(NOW.plus(Duration.ofMinutes(120)), store.failureNextPoll);
    }

    @Test
    void networkFailuresUseOutageBackoff() throws Exception {
        FakeStore store = new FakeStore(List.of(state(0, NOW.minus(Duration.ofDays(1)))));
        AdvancedStatsScheduledCollector collector = collector(
                store,
                tag -> { throw new IOException("network"); },
                (tracking, raw, bootstrap) -> summary(0, 0, 0, 0)
        );

        collector.runOnce();

        assertEquals(AdvancedStatsScheduledCollector.FailureReason.API_OUTAGE, store.failureReason);
        assertEquals(NOW.plus(Duration.ofMinutes(10)), store.failureNextPoll);
    }

    @Test
    void databaseFailuresAreNotMisreportedAsClashRateLimits() throws Exception {
        Exception databaseFailure = HttpException.upstream(429, "{}", "Databank");
        assertEquals(
                AdvancedStatsScheduledCollector.FailureReason.UNKNOWN,
                AdvancedStatsScheduledCollector.classifyFailure(databaseFailure)
        );
    }

    @Test
    void failureFinalizationErrorLeavesLeaseForExpiryAndIsObservable() throws Exception {
        FakeStore store = new FakeStore(List.of(state(0, NOW.minus(Duration.ofDays(1)))));
        store.failFinalization = true;
        AdvancedStatsScheduledCollector collector = collector(
                store,
                tag -> { throw new IOException("network"); },
                (tracking, raw, bootstrap) -> summary(0, 0, 0, 0)
        );

        AdvancedStatsScheduledCollector.BatchSummary result = collector.runOnce();

        assertEquals(1, result.failed());
        assertEquals(1, result.finalizeFailures());
    }

    @Test
    void emptyClaimIsAHealthyNoOp() throws Exception {
        FakeStore store = new FakeStore(List.of());
        AdvancedStatsScheduledCollector.BatchSummary result = collector(
                store,
                tag -> { throw new AssertionError("source must not be called"); },
                (tracking, raw, bootstrap) -> { throw new AssertionError("ingestion must not be called"); }
        ).runOnce();

        assertEquals(0, result.claimed());
        assertEquals(0, result.succeeded());
        assertEquals(0, result.failed());
    }

    @Test
    void backoffNeverExceedsConfiguredMaximum() {
        Duration delay = AdvancedStatsScheduledCollector.failureBackoff(
                AdvancedStatsScheduledCollector.FailureReason.RATE_LIMIT,
                20,
                settings()
        );
        assertEquals(Duration.ofHours(4), delay);
    }

    private AdvancedStatsScheduledCollector collector(
            FakeStore store,
            AdvancedStatsScheduledCollector.BattleLogSource source,
            AdvancedStatsScheduledCollector.Ingestion ingestion
    ) {
        return new AdvancedStatsScheduledCollector(store, source, ingestion, CLOCK, settings());
    }

    private AdvancedStatsScheduledCollector.Settings settings() {
        return AdvancedStatsScheduledCollector.Settings.defaults();
    }

    private AdvancedStatsBattleIngestionService.IngestionSummary summary(
            int observed,
            int inserted,
            int duplicates,
            int parserErrors
    ) {
        int attacks = inserted + duplicates + parserErrors;
        int ignoredDefenses = observed - attacks;
        return new AdvancedStatsBattleIngestionService.IngestionSummary(
                observed,
                attacks,
                inserted,
                duplicates,
                parserErrors,
                ignoredDefenses
        );
    }

    private AdvancedStatsModels.TrackingState state(int failures, Instant bootstrapCompletedAt) {
        return new AdvancedStatsModels.TrackingState(
                TRACKING_ID,
                USER_ID,
                "#2PYLQ",
                "Player",
                17,
                AdvancedStatsTrackingStatus.ACTIVE,
                NOW.minus(Duration.ofDays(10)),
                bootstrapCompletedAt,
                NOW.minus(Duration.ofMinutes(30)),
                NOW.minus(Duration.ofMinutes(30)),
                NOW,
                failures,
                null,
                NOW.minus(Duration.ofDays(10)),
                100
        );
    }

    private static final class FakeStore implements AdvancedStatsScheduledCollector.Store {
        private final List<AdvancedStatsModels.TrackingState> claim;
        private String workerId = "";
        private Instant successNextPoll;
        private Instant failureNextPoll;
        private boolean bootstrapCompleted;
        private AdvancedStatsScheduledCollector.FailureReason failureReason;
        private int degradedThreshold;
        private boolean failFinalization;

        private FakeStore(List<AdvancedStatsModels.TrackingState> claim) {
            this.claim = new ArrayList<>(claim);
        }

        @Override
        public List<AdvancedStatsModels.TrackingState> claimDue(
                String workerId,
                Instant now,
                int limit,
                int leaseSeconds
        ) {
            this.workerId = workerId;
            assertEquals(NOW, now);
            assertEquals(25, limit);
            assertEquals(600, leaseSeconds);
            return List.copyOf(claim);
        }

        @Override
        public void completeSuccess(
                UUID trackingId,
                String workerId,
                Instant now,
                Instant nextPollAt,
                boolean bootstrapCompleted
        ) {
            assertEquals(TRACKING_ID, trackingId);
            assertEquals(this.workerId, workerId);
            assertEquals(NOW, now);
            this.successNextPoll = nextPollAt;
            this.bootstrapCompleted = bootstrapCompleted;
        }

        @Override
        public void completeFailure(
                UUID trackingId,
                String workerId,
                Instant now,
                Instant nextPollAt,
                AdvancedStatsScheduledCollector.FailureReason reason,
                int degradedThreshold
        ) throws Exception {
            assertEquals(TRACKING_ID, trackingId);
            assertEquals(this.workerId, workerId);
            assertEquals(NOW, now);
            this.failureNextPoll = nextPollAt;
            this.failureReason = reason;
            this.degradedThreshold = degradedThreshold;
            if (failFinalization) throw new IOException("db unavailable");
        }
    }
}

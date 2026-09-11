package Java.advancedstats;

import Java.HttpException;
import Java.advancedstats.AdvancedStatsCollectionModels.BootstrapStatus;
import Java.advancedstats.AdvancedStatsCollectionModels.PageApplyResult;
import Java.advancedstats.AdvancedStatsCollectionModels.PageCommit;
import Java.advancedstats.AdvancedStatsCollectionModels.ScopeState;
import Java.advancedstats.AdvancedStatsHistoryModels.Checkpoint;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryPage;
import Java.advancedstats.AdvancedStatsHistoryModels.HistoryRequest;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.SocketTimeoutException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;

class AdvancedStatsCompactScheduledCollectorFailureTest {
    private static final Instant NOW = Instant.parse("2026-08-07T14:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID TRACKING_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @Test
    void compact429RemainsRateLimitedAfterScopeCollection() throws Exception {
        LeaseStore lease = new LeaseStore();

        AdvancedStatsCompactScheduledCollector.Summary summary = run(
                HttpException.upstream(429, "{}", "ClashKing V2"), lease);

        assertEquals(1, summary.failed());
        assertEquals(0, summary.succeeded());
        assertEquals(AdvancedStatsScheduledCollector.FailureReason.RATE_LIMIT, lease.failureReason);
    }

    @Test
    void compact503RemainsApiOutageAfterScopeCollection() throws Exception {
        LeaseStore lease = new LeaseStore();

        AdvancedStatsCompactScheduledCollector.Summary summary = run(
                HttpException.upstream(503, "{}", "ClashKing V2"), lease);

        assertEquals(1, summary.failed());
        assertEquals(AdvancedStatsScheduledCollector.FailureReason.API_OUTAGE, lease.failureReason);
    }

    @Test
    void compactTimeoutRemainsApiOutageAfterScopeCollection() throws Exception {
        LeaseStore lease = new LeaseStore();

        AdvancedStatsCompactScheduledCollector.Summary summary = run(
                new SocketTimeoutException("ClashKing V2 timed out"), lease);

        assertEquals(1, summary.failed());
        assertEquals(AdvancedStatsScheduledCollector.FailureReason.API_OUTAGE, lease.failureReason);
    }

    private AdvancedStatsCompactScheduledCollector.Summary run(Exception failure, LeaseStore lease)
            throws Exception {
        AdvancedStatsHistorySource source = new FailureSource(failure);
        CompactStore compactStore = new CompactStore();
        AdvancedStatsCompactScheduledCollector collector = new AdvancedStatsCompactScheduledCollector(
                lease,
                workerId -> source,
                workerId -> compactStore,
                CLOCK,
                AdvancedStatsCompactScheduledCollector.Settings.defaults());

        return collector.runOnce();
    }

    private static final class FailureSource implements AdvancedStatsHistorySource {
        private final Exception failure;

        private FailureSource(Exception failure) {
            this.failure = failure;
        }

        @Override
        public String sourceId() {
            return "clashking-v2-test";
        }

        @Override
        public AdvancedStatsSourceCapabilities capabilities() {
            List<AdvancedStatsCapability> declarations = new ArrayList<>();
            for (AdvancedStatsScope scope : AdvancedStatsScope.values()) {
                for (AdvancedStatsCapabilityOperation operation : AdvancedStatsCapabilityOperation.values()) {
                    declarations.add(new AdvancedStatsCapability(scope, operation,
                            AdvancedStatsCapabilityStatus.PARTIAL, sourceId(), "test coverage is partial"));
                }
            }
            return new AdvancedStatsSourceCapabilities(declarations);
        }

        @Override
        public HistoryPage fetch(HistoryRequest request) throws Exception {
            throw failure;
        }
    }

    private static final class CompactStore implements AdvancedStatsCollectionStore {
        private final Map<AdvancedStatsScope, ScopeState> states = new EnumMap<>(AdvancedStatsScope.class);
        private int failures;

        private CompactStore() {
            for (AdvancedStatsScope scope : AdvancedStatsScope.values()) {
                states.put(scope, new ScopeState(TRACKING_ID, "#2PYLQ", scope,
                        BootstrapStatus.COMPLETE, Checkpoint.initial(),
                        AdvancedStatsCapabilityStatus.PARTIAL, "", "clashking-v2-test",
                        0, NOW, NOW, ""));
            }
        }

        @Override
        public ScopeState load(UUID trackingId, AdvancedStatsScope scope) {
            return states.get(scope);
        }

        @Override
        public void markBootstrapStarted(UUID trackingId, AdvancedStatsScope scope, Instant startedAt) {
        }

        @Override
        public PageApplyResult applyPageAndAdvance(PageCommit commit) {
            throw new AssertionError("a failed source must not commit a page");
        }

        @Override
        public void markCapabilityUnavailable(UUID trackingId, AdvancedStatsScope scope,
                                              AdvancedStatsCapability capability, Instant observedAt) {
            throw new AssertionError("a transient source failure must not become unsupported");
        }

        @Override
        public void markFailure(UUID trackingId, AdvancedStatsScope scope, String message, Instant failedAt) {
            failures++;
        }
    }

    private static final class LeaseStore implements AdvancedStatsScheduledCollector.Store {
        private AdvancedStatsScheduledCollector.FailureReason failureReason;

        @Override
        public List<AdvancedStatsModels.TrackingState> claimDue(String workerId, Instant now,
                                                                 int limit, int leaseSeconds) {
            return List.of(new AdvancedStatsModels.TrackingState(
                    TRACKING_ID, USER_ID, "#2PYLQ", "Player", 17,
                    AdvancedStatsTrackingStatus.ACTIVE, NOW.minus(Duration.ofDays(10)), NOW.minus(Duration.ofDays(2)),
                    NOW.minus(Duration.ofMinutes(30)), NOW.minus(Duration.ofMinutes(30)), NOW,
                    0, null, NOW.minus(Duration.ofDays(10)), 100));
        }

        @Override
        public void completeSuccess(UUID trackingId, String workerId, Instant now, Instant nextPollAt,
                                    boolean bootstrapCompleted) {
            throw new AssertionError("failed compact scope must not complete successfully");
        }

        @Override
        public void completeFailure(UUID trackingId, String workerId, Instant now, Instant nextPollAt,
                                    AdvancedStatsScheduledCollector.FailureReason reason, int degradedThreshold) {
            failureReason = reason;
        }
    }
}

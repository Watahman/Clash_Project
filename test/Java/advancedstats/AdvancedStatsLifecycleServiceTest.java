package Java.advancedstats;

import Java.HttpException;
import Java.cache.CacheKeys;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdvancedStatsLifecycleServiceTest {
    private static final UUID USER_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID TRACKING_ID = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final String TAG = "#P0Y8LQ";
    private static final Instant STARTED = Instant.parse("2026-08-01T10:00:00Z");
    private static final Instant NOW = Instant.parse("2026-08-07T13:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    @Test
    void ownershipFailureStopsLifecycleBeforeStoreAccess() {
        FakeStore store = new FakeStore(state(AdvancedStatsTrackingStatus.ACTIVE, null));
        AdvancedStatsLifecycleService service = new AdvancedStatsLifecycleService(
                store,
                (userId, playerTag) -> {
                    throw new HttpException(403, "{\"code\":\"ADVANCED_STATS_ACCOUNT_NOT_LINKED\"}");
                },
                CLOCK
        );

        assertThrows(HttpException.class, () -> service.status(USER_ID, TAG));
        assertEquals(0, store.findCalls);
    }

    @Test
    void startDelegatesOnlyAfterOwnershipAndIsStoreIdempotent() throws Exception {
        FakeStore store = new FakeStore(state(AdvancedStatsTrackingStatus.INITIALIZING, null));
        AdvancedStatsLifecycleService service = service(store);

        AdvancedStatsModels.TrackingState first = service.start(USER_ID, TAG);
        AdvancedStatsModels.TrackingState second = service.start(USER_ID, TAG);

        assertEquals(AdvancedStatsTrackingStatus.INITIALIZING, first.status());
        assertEquals(first.id(), second.id());
        assertEquals(2, store.startCalls);
    }

    @Test
    void pauseIsIdempotentAndStartsPotentialGapOnce() throws Exception {
        FakeStore store = new FakeStore(state(AdvancedStatsTrackingStatus.ACTIVE, null));
        AdvancedStatsLifecycleService service = service(store);

        AdvancedStatsModels.TrackingState paused = service.pause(USER_ID, TAG);
        assertEquals(AdvancedStatsTrackingStatus.PAUSED, paused.status());
        assertEquals(NOW, paused.gapStartedAt());
        assertEquals(1, store.pauseCalls);

        AdvancedStatsModels.TrackingState repeated = service.pause(USER_ID, TAG);
        assertEquals(AdvancedStatsTrackingStatus.PAUSED, repeated.status());
        assertEquals(1, store.pauseCalls);
    }

    @Test
    void stoppedTrackerCannotBePaused() {
        FakeStore store = new FakeStore(state(AdvancedStatsTrackingStatus.STOPPED, NOW));
        AdvancedStatsLifecycleService service = service(store);

        HttpException error = assertThrows(HttpException.class, () -> service.pause(USER_ID, TAG));
        assertEquals(409, error.getStatusCode());
        assertEquals(0, store.pauseCalls);
    }

    @Test
    void resumeKeepsGapOpenUntilCollectorCanResolveIt() throws Exception {
        Instant gapStart = Instant.parse("2026-08-07T12:00:00Z");
        FakeStore store = new FakeStore(state(AdvancedStatsTrackingStatus.PAUSED, gapStart));
        AdvancedStatsLifecycleService service = service(store);

        AdvancedStatsModels.TrackingState resumed = service.resume(USER_ID, TAG);

        assertEquals(AdvancedStatsTrackingStatus.INITIALIZING, resumed.status());
        assertEquals(gapStart, resumed.gapStartedAt());
        assertEquals(NOW, resumed.nextPollAt());
        assertEquals(1, store.resumeCalls);
    }

    @Test
    void resumeIsIdempotentWhenAlreadyActiveOrInitializing() throws Exception {
        FakeStore activeStore = new FakeStore(state(AdvancedStatsTrackingStatus.ACTIVE, null));
        AdvancedStatsLifecycleService activeService = service(activeStore);
        assertEquals(AdvancedStatsTrackingStatus.ACTIVE, activeService.resume(USER_ID, TAG).status());
        assertEquals(0, activeStore.resumeCalls);

        FakeStore initializingStore = new FakeStore(state(AdvancedStatsTrackingStatus.INITIALIZING, null));
        AdvancedStatsLifecycleService initializingService = service(initializingStore);
        assertEquals(AdvancedStatsTrackingStatus.INITIALIZING, initializingService.resume(USER_ID, TAG).status());
        assertEquals(0, initializingStore.resumeCalls);
    }

    @Test
    void stopPreservesHistoryAndMarksTrackingDisabled() throws Exception {
        FakeStore store = new FakeStore(state(AdvancedStatsTrackingStatus.ACTIVE, null));
        AdvancedStatsLifecycleService service = service(store);

        Optional<AdvancedStatsModels.TrackingState> stopped = service.stop(USER_ID, TAG);

        assertTrue(stopped.isPresent());
        assertEquals(AdvancedStatsTrackingStatus.STOPPED, stopped.get().status());
        assertEquals(NOW, stopped.get().gapStartedAt());
        assertEquals(1, store.stopCalls);
        assertFalse(store.deleted);
    }

    @Test
    void stopAndDeleteAreIdempotentWhenNothingExists() throws Exception {
        FakeStore store = new FakeStore(null);
        AdvancedStatsLifecycleService service = service(store);

        assertTrue(service.stop(USER_ID, TAG).isEmpty());
        assertFalse(service.delete(USER_ID, TAG));
    }

    @Test
    void deleteRemovesTrackingThroughStore() throws Exception {
        FakeStore store = new FakeStore(state(AdvancedStatsTrackingStatus.STOPPED, NOW));
        AdvancedStatsLifecycleService service = service(store);

        assertTrue(service.delete(USER_ID, TAG));
        assertTrue(store.deleted);
        assertTrue(store.findTracking(USER_ID, TAG).isEmpty());
    }

    @Test
    void pauseRequiresExistingTracking() {
        FakeStore store = new FakeStore(null);
        AdvancedStatsLifecycleService service = service(store);

        HttpException error = assertThrows(HttpException.class, () -> service.pause(USER_ID, TAG));
        assertEquals(404, error.getStatusCode());
    }

    private AdvancedStatsLifecycleService service(FakeStore store) {
        return new AdvancedStatsLifecycleService(
                store,
                (userId, rawTag) -> CacheKeys.requireValidTag(rawTag),
                CLOCK
        );
    }

    private static AdvancedStatsModels.TrackingState state(
            AdvancedStatsTrackingStatus status,
            Instant gapStartedAt
    ) {
        return new AdvancedStatsModels.TrackingState(
                TRACKING_ID,
                USER_ID,
                TAG,
                "Player",
                17,
                status,
                STARTED,
                null,
                null,
                null,
                status == AdvancedStatsTrackingStatus.INITIALIZING ? NOW : null,
                0,
                gapStartedAt,
                null,
                0
        );
    }

    private static final class FakeStore implements AdvancedStatsLifecycleService.Store {
        private AdvancedStatsModels.TrackingState current;
        private int findCalls;
        private int startCalls;
        private int pauseCalls;
        private int resumeCalls;
        private int stopCalls;
        private boolean deleted;

        private FakeStore(AdvancedStatsModels.TrackingState current) {
            this.current = current;
        }

        @Override
        public Optional<AdvancedStatsModels.TrackingState> findTracking(UUID userId, String playerTag) {
            findCalls++;
            return Optional.ofNullable(current);
        }

        @Override
        public AdvancedStatsModels.TrackingState startTracking(UUID userId, String playerTag) {
            startCalls++;
            if (current == null) current = state(AdvancedStatsTrackingStatus.INITIALIZING, null);
            return current;
        }

        @Override
        public AdvancedStatsModels.TrackingState pauseTracking(UUID userId, String playerTag, Instant gapStartedAt) {
            pauseCalls++;
            current = withState(AdvancedStatsTrackingStatus.PAUSED, gapStartedAt, null);
            return current;
        }

        @Override
        public AdvancedStatsModels.TrackingState resumeTracking(UUID userId, String playerTag, Instant resumeRequestedAt) {
            resumeCalls++;
            Instant gap = current == null ? null : current.gapStartedAt();
            current = withState(AdvancedStatsTrackingStatus.INITIALIZING, gap, resumeRequestedAt);
            return current;
        }

        @Override
        public AdvancedStatsModels.TrackingState stopTracking(UUID userId, String playerTag, Instant gapStartedAt) {
            stopCalls++;
            current = withState(AdvancedStatsTrackingStatus.STOPPED, gapStartedAt, null);
            return current;
        }

        @Override
        public boolean deleteTracking(UUID userId, String playerTag) {
            if (current == null) return false;
            deleted = true;
            current = null;
            return true;
        }

        private AdvancedStatsModels.TrackingState withState(
                AdvancedStatsTrackingStatus status,
                Instant gap,
                Instant nextPoll
        ) {
            AdvancedStatsModels.TrackingState source = current == null
                    ? state(status, gap)
                    : current;
            return new AdvancedStatsModels.TrackingState(
                    source.id(),
                    source.userId(),
                    source.playerTag(),
                    source.playerName(),
                    source.townHallLevel(),
                    status,
                    source.trackingStartedAt(),
                    source.bootstrapCompletedAt(),
                    source.lastPollAt(),
                    source.lastSuccessfulPollAt(),
                    nextPoll,
                    0,
                    gap,
                    source.dataCompleteSince(),
                    source.battlesProcessed()
            );
        }
    }
}

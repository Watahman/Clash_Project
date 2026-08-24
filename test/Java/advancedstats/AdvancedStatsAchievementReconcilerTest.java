package Java.advancedstats;

import Java.achievements.AchievementEvaluator;
import com.google.gson.JsonArray;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;

class AdvancedStatsAchievementReconcilerTest {
    private static final UUID TRACKING_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID USER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @Test
    void doesNotPersistDeprecatedSyntheticBattleAchievements() throws Exception {
        FakeStore store = new FakeStore(new AdvancedStatsAchievementReconciler.MetricsSnapshot(
                1_786_118_400L,
                Map.of(
                        "tracked_attack_count", 250L,
                        "tracked_star_count", 600L,
                        "tracked_three_star_count", 75L
                )
        ));
        AdvancedStatsAchievementReconciler reconciler = new AdvancedStatsAchievementReconciler(
                store,
                new AchievementEvaluator()
        );

        reconciler.reconcile(tracking());

        assertEquals(0, store.reconcileCalls);
        assertEquals(0, store.progress.size());
    }

    @Test
    void skipsPersistenceBeforeAnyTrackedAttackExists() throws Exception {
        FakeStore store = new FakeStore(new AdvancedStatsAchievementReconciler.MetricsSnapshot(
                0,
                Map.of(
                        "tracked_attack_count", 0L,
                        "tracked_star_count", 0L,
                        "tracked_three_star_count", 0L
                )
        ));
        AdvancedStatsAchievementReconciler reconciler = new AdvancedStatsAchievementReconciler(
                store,
                new AchievementEvaluator()
        );

        reconciler.reconcile(tracking());

        assertEquals(0, store.reconcileCalls);
    }

    private AdvancedStatsModels.TrackingState tracking() {
        return new AdvancedStatsModels.TrackingState(
                TRACKING_ID,
                USER_ID,
                "#2PYLQ",
                "Player",
                18,
                AdvancedStatsTrackingStatus.ACTIVE,
                Instant.parse("2026-08-07T12:00:00Z"),
                Instant.parse("2026-08-07T12:01:00Z"),
                Instant.parse("2026-08-07T13:00:00Z"),
                Instant.parse("2026-08-07T13:00:00Z"),
                Instant.parse("2026-08-07T13:15:00Z"),
                0,
                null,
                Instant.parse("2026-08-07T12:00:00Z"),
                250
        );
    }

    private static final class FakeStore implements AdvancedStatsAchievementReconciler.Store {
        private final AdvancedStatsAchievementReconciler.MetricsSnapshot snapshot;
        private JsonArray progress = new JsonArray();
        private int reconcileCalls;

        private FakeStore(AdvancedStatsAchievementReconciler.MetricsSnapshot snapshot) {
            this.snapshot = snapshot;
        }

        @Override
        public AdvancedStatsAchievementReconciler.MetricsSnapshot readMetrics(UUID trackingId) {
            assertEquals(TRACKING_ID, trackingId);
            return snapshot;
        }

        @Override
        public void reconcile(UUID userId, String playerTag, long sourceTimestamp, JsonArray progress) {
            this.progress = progress == null ? new JsonArray() : progress.deepCopy();
            this.reconcileCalls++;
        }
    }
}

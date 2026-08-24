package Java.advancedstats;

import Java.SUPABASE_Client;
import Java.achievements.AchievementEvaluator;
import Java.achievements.AchievementProgress;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Reconciles usage-based Advanced Achievements from already persisted
 * Advanced Stats aggregates. It never fetches the Clash battle log itself.
 */
public final class AdvancedStatsAchievementReconciler {
    static final Set<String> SUPPORTED_METRICS = Set.of(
            "tracked_attack_count",
            "tracked_star_count",
            "tracked_three_star_count"
    );

    public record MetricsSnapshot(long sourceTimestamp, Map<String, Long> metrics) {
        public MetricsSnapshot {
            metrics = Map.copyOf(metrics == null ? Map.of() : metrics);
        }
    }

    interface Store {
        MetricsSnapshot readMetrics(UUID trackingId) throws Exception;

        void reconcile(
                UUID userId,
                String playerTag,
                long sourceTimestamp,
                JsonArray progress
        ) throws Exception;
    }

    private final Store store;
    private final AchievementEvaluator evaluator;

    public AdvancedStatsAchievementReconciler() {
        this(new SupabaseStore(), new AchievementEvaluator());
    }

    AdvancedStatsAchievementReconciler(Store store, AchievementEvaluator evaluator) {
        this.store = Objects.requireNonNull(store, "store");
        this.evaluator = Objects.requireNonNull(evaluator, "evaluator");
    }

    public void reconcile(AdvancedStatsModels.TrackingState tracking) throws Exception {
        Objects.requireNonNull(tracking, "tracking");
        MetricsSnapshot snapshot = store.readMetrics(tracking.id());
        long attacks = Math.max(0, snapshot.metrics().getOrDefault("tracked_attack_count", 0L));
        if (snapshot.sourceTimestamp() <= 0 || attacks == 0) return;

        List<AchievementProgress> progress = evaluator.evaluate(snapshot.metrics()).stream()
                .filter(item -> SUPPORTED_METRICS.contains(item.definition().metric()))
                .toList();

        // The original v2 achievement specification has no synthetic
        // Advanced-Stats-only Battle Tracker/Star Collector families. Keep the
        // collector data, but do not write invented achievement rows.
        if (progress.isEmpty()) return;

        store.reconcile(
                tracking.userId(),
                tracking.playerTag(),
                snapshot.sourceTimestamp(),
                evaluator.toJson(progress)
        );
    }

    static final class SupabaseStore implements Store {
        @Override
        public MetricsSnapshot readMetrics(UUID trackingId) throws Exception {
            if (trackingId == null) throw new IllegalArgumentException("trackingId is required");
            JsonObject request = new JsonObject();
            request.addProperty("p_tracking_id", trackingId.toString());
            String raw = SUPABASE_Client.rpc(
                    "read_advanced_stats_achievement_metrics_v1",
                    request.toString()
            );
            JsonElement parsed = JsonParser.parseString(raw == null || raw.isBlank() ? "null" : raw);
            if (!parsed.isJsonObject()) {
                throw new IllegalStateException("Advanced Stats achievement metrics RPC must return an object");
            }
            JsonObject payload = parsed.getAsJsonObject();
            long sourceTimestamp = longValue(payload.get("sourceTimestamp"));
            JsonObject metricObject = payload.has("metrics") && payload.get("metrics").isJsonObject()
                    ? payload.getAsJsonObject("metrics")
                    : new JsonObject();
            Map<String, Long> metrics = new LinkedHashMap<>();
            for (String key : SUPPORTED_METRICS) {
                metrics.put(key, Math.max(0, longValue(metricObject.get(key))));
            }
            return new MetricsSnapshot(sourceTimestamp, metrics);
        }

        @Override
        public void reconcile(
                UUID userId,
                String playerTag,
                long sourceTimestamp,
                JsonArray progress
        ) throws Exception {
            if (userId == null) throw new IllegalArgumentException("userId is required");
            if (playerTag == null || playerTag.isBlank()) throw new IllegalArgumentException("playerTag is required");
            JsonObject request = new JsonObject();
            request.addProperty("p_user_id", userId.toString());
            request.addProperty("p_player_tag", playerTag);
            request.addProperty("p_source_timestamp", sourceTimestamp);
            request.add("p_progress", progress == null ? new JsonArray() : progress);
            SUPABASE_Client.rpc(
                    "reconcile_advanced_stats_achievement_progress_v1",
                    request.toString()
            );
        }

        private static long longValue(JsonElement value) {
            if (value == null || value.isJsonNull()) return 0;
            try {
                return value.getAsLong();
            } catch (RuntimeException invalid) {
                return 0;
            }
        }
    }
}

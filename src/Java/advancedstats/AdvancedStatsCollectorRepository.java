package Java.advancedstats;

import Java.SUPABASE_Client;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Database boundary for scheduled Advanced Stats collection. */
public final class AdvancedStatsCollectorRepository implements AdvancedStatsScheduledCollector.Store {
    @Override
    public List<AdvancedStatsModels.TrackingState> claimDue(
            String workerId,
            Instant now,
            int limit,
            int leaseSeconds
    ) throws Exception {
        JsonObject body = new JsonObject();
        body.addProperty("p_worker_id", requireWorkerId(workerId));
        body.addProperty("p_now", now.toString());
        body.addProperty("p_limit", limit);
        body.addProperty("p_lease_seconds", leaseSeconds);

        JsonArray rows = parseArray(SUPABASE_Client.rpc(
                "claim_advanced_stats_trackers_v1",
                body.toString()
        ));

        List<AdvancedStatsModels.TrackingState> claimed = new ArrayList<>(rows.size());
        for (JsonElement row : rows) {
            claimed.add(toTrackingState(row.getAsJsonObject()));
        }
        return List.copyOf(claimed);
    }

    @Override
    public void completeSuccess(
            UUID trackingId,
            String workerId,
            Instant now,
            Instant nextPollAt,
            boolean bootstrapCompleted
    ) throws Exception {
        JsonObject body = new JsonObject();
        body.addProperty("p_tracking_id", trackingId.toString());
        body.addProperty("p_worker_id", requireWorkerId(workerId));
        body.addProperty("p_now", now.toString());
        body.addProperty("p_next_poll_at", nextPollAt.toString());
        body.addProperty("p_bootstrap_completed", bootstrapCompleted);
        SUPABASE_Client.rpc("complete_advanced_stats_poll_v1", body.toString());
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
        JsonObject body = new JsonObject();
        body.addProperty("p_tracking_id", trackingId.toString());
        body.addProperty("p_worker_id", requireWorkerId(workerId));
        body.addProperty("p_now", now.toString());
        body.addProperty("p_next_poll_at", nextPollAt.toString());
        body.addProperty("p_reason", reason.databaseValue());
        body.addProperty("p_degraded_threshold", degradedThreshold);
        SUPABASE_Client.rpc("fail_advanced_stats_poll_v1", body.toString());
    }

    private AdvancedStatsModels.TrackingState toTrackingState(JsonObject row) {
        return new AdvancedStatsModels.TrackingState(
                UUID.fromString(requiredString(row, "id")),
                UUID.fromString(requiredString(row, "user_id")),
                requiredString(row, "player_tag"),
                optionalString(row, "player_name"),
                optionalInteger(row, "town_hall_level"),
                AdvancedStatsTrackingStatus.fromDatabase(requiredString(row, "status")),
                requiredInstant(row, "tracking_started_at"),
                optionalInstant(row, "bootstrap_completed_at"),
                optionalInstant(row, "last_poll_at"),
                optionalInstant(row, "last_successful_poll_at"),
                optionalInstant(row, "next_poll_at"),
                optionalInteger(row, "consecutive_failures", 0),
                optionalInstant(row, "gap_started_at"),
                optionalInstant(row, "data_complete_since"),
                optionalLong(row, "battles_processed", 0L)
        );
    }

    private JsonArray parseArray(String json) {
        JsonElement parsed = JsonParser.parseString(json == null || json.isBlank() ? "[]" : json);
        if (!parsed.isJsonArray()) {
            throw new IllegalStateException("Advanced Stats collector claim response must be an array");
        }
        return parsed.getAsJsonArray();
    }

    private String requireWorkerId(String value) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isBlank() || normalized.length() > 160) {
            throw new IllegalArgumentException("workerId is required and must be <= 160 characters");
        }
        return normalized;
    }

    private String requiredString(JsonObject row, String field) {
        JsonElement value = row.get(field);
        if (value == null || value.isJsonNull()) {
            throw new IllegalStateException("Missing Advanced Stats collector field: " + field);
        }
        return value.getAsString();
    }

    private String optionalString(JsonObject row, String field) {
        JsonElement value = row.get(field);
        return value == null || value.isJsonNull() ? null : value.getAsString();
    }

    private Integer optionalInteger(JsonObject row, String field) {
        JsonElement value = row.get(field);
        return value == null || value.isJsonNull() ? null : value.getAsInt();
    }

    private int optionalInteger(JsonObject row, String field, int fallback) {
        Integer value = optionalInteger(row, field);
        return value == null ? fallback : value;
    }

    private long optionalLong(JsonObject row, String field, long fallback) {
        JsonElement value = row.get(field);
        return value == null || value.isJsonNull() ? fallback : value.getAsLong();
    }

    private Instant requiredInstant(JsonObject row, String field) {
        Instant value = optionalInstant(row, field);
        if (value == null) {
            throw new IllegalStateException("Missing Advanced Stats collector field: " + field);
        }
        return value;
    }

    private Instant optionalInstant(JsonObject row, String field) {
        String value = optionalString(row, field);
        if (value == null || value.isBlank()) return null;
        try {
            return Instant.parse(value);
        } catch (RuntimeException ignored) {
            return OffsetDateTime.parse(value).toInstant();
        }
    }
}

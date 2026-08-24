package Java.advancedstats;

import Java.SUPABASE_Client;
import Java.cache.CacheKeys;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonNull;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

/** Backend-only persistence boundary for the Advanced Stats tracker lifecycle. */
public final class AdvancedStatsRepository implements AdvancedStatsLifecycleService.Store {
    static final String TRACKING_TABLE = "advanced_stats_tracking";

    private static final String TRACKING_SELECT = String.join(",",
            "id", "user_id", "player_tag", "player_name", "town_hall_level", "status",
            "tracking_started_at", "bootstrap_completed_at", "last_poll_at",
            "last_successful_poll_at", "next_poll_at", "consecutive_failures",
            "gap_started_at", "data_complete_since", "battles_processed"
    );

    @Override
    public Optional<AdvancedStatsModels.TrackingState> findTracking(UUID userId, String rawPlayerTag)
            throws Exception {
        if (userId == null) throw new IllegalArgumentException("userId is required");
        String playerTag = CacheKeys.requireValidTag(rawPlayerTag);
        String query = "select=" + TRACKING_SELECT
                + "&user_id=" + SUPABASE_Client.eq(userId.toString())
                + "&player_tag=" + SUPABASE_Client.eq(playerTag)
                + "&limit=1";
        JsonArray rows = parseArray(SUPABASE_Client.getWithBody(TRACKING_TABLE, query));
        if (rows.isEmpty()) return Optional.empty();
        return Optional.of(toTrackingState(rows.get(0).getAsJsonObject()));
    }

    @Override
    public AdvancedStatsModels.TrackingState startTracking(UUID userId, String rawPlayerTag) throws Exception {
        if (userId == null) throw new IllegalArgumentException("userId is required");
        String playerTag = CacheKeys.requireValidTag(rawPlayerTag);
        JsonObject insert = new JsonObject();
        insert.addProperty("user_id", userId.toString());
        insert.addProperty("player_tag", playerTag);
        // Identity only: an idempotent start never resets an existing paused/stopped row.
        SUPABASE_Client.upsert(TRACKING_TABLE, "user_id,player_tag", insert.toString());
        return requireTracking(userId, playerTag);
    }

    @Override
    public AdvancedStatsModels.TrackingState pauseTracking(
            UUID userId, String rawPlayerTag, Instant gapStartedAt
    ) throws Exception {
        String playerTag = CacheKeys.requireValidTag(rawPlayerTag);
        Instant now = Instant.now();
        JsonObject patch = baseLifecyclePatch(AdvancedStatsTrackingStatus.PAUSED, now);
        patch.add("next_poll_at", JsonNull.INSTANCE);
        patch.addProperty("gap_started_at", gapStartedAt.toString());
        patch.addProperty("gap_reason", "USER_PAUSED");
        clearLease(patch);
        patchTracking(userId, playerTag, patch);
        return requireTracking(userId, playerTag);
    }

    @Override
    public AdvancedStatsModels.TrackingState resumeTracking(
            UUID userId, String rawPlayerTag, Instant resumeRequestedAt
    ) throws Exception {
        String playerTag = CacheKeys.requireValidTag(rawPlayerTag);
        JsonObject patch = baseLifecyclePatch(AdvancedStatsTrackingStatus.INITIALIZING, resumeRequestedAt);
        patch.addProperty("next_poll_at", resumeRequestedAt.toString());
        patch.addProperty("consecutive_failures", 0);
        clearLease(patch);
        // Preserve gap_started_at until collection proves that upstream history covered it.
        patchTracking(userId, playerTag, patch);
        return requireTracking(userId, playerTag);
    }

    @Override
    public AdvancedStatsModels.TrackingState stopTracking(
            UUID userId, String rawPlayerTag, Instant gapStartedAt
    ) throws Exception {
        String playerTag = CacheKeys.requireValidTag(rawPlayerTag);
        Instant now = Instant.now();
        JsonObject patch = baseLifecyclePatch(AdvancedStatsTrackingStatus.STOPPED, now);
        patch.add("next_poll_at", JsonNull.INSTANCE);
        patch.addProperty("gap_started_at", gapStartedAt.toString());
        patch.addProperty("gap_reason", "USER_PAUSED");
        clearLease(patch);
        patchTracking(userId, playerTag, patch);
        return requireTracking(userId, playerTag);
    }

    @Override
    public boolean deleteTracking(UUID userId, String rawPlayerTag) throws Exception {
        if (userId == null) throw new IllegalArgumentException("userId is required");
        String playerTag = CacheKeys.requireValidTag(rawPlayerTag);
        JsonObject body = new JsonObject();
        body.addProperty("p_user_id", userId.toString());
        body.addProperty("p_player_tag", playerTag);
        JsonObject result = parseObject(SUPABASE_Client.rpc(
                "delete_advanced_stats_tracking_v1",
                body.toString()
        ));
        return booleanValue(result, "deleted", false);
    }

    private AdvancedStatsModels.TrackingState requireTracking(UUID userId, String playerTag) throws Exception {
        return findTracking(userId, playerTag)
                .orElseThrow(() -> new IllegalStateException("Advanced Stats tracking row was not persisted"));
    }

    private void patchTracking(UUID userId, String playerTag, JsonObject patch) throws Exception {
        if (userId == null) throw new IllegalArgumentException("userId is required");
        String filter = "user_id=" + SUPABASE_Client.eq(userId.toString())
                + "&player_tag=" + SUPABASE_Client.eq(playerTag);
        SUPABASE_Client.patch(TRACKING_TABLE, filter, patch.toString());
    }

    private JsonObject baseLifecyclePatch(AdvancedStatsTrackingStatus status, Instant updatedAt) {
        JsonObject patch = new JsonObject();
        patch.addProperty("status", status.name());
        patch.addProperty("updated_at", updatedAt.toString());
        return patch;
    }

    private void clearLease(JsonObject patch) {
        patch.add("locked_until", JsonNull.INSTANCE);
        patch.add("locked_by", JsonNull.INSTANCE);
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
        JsonElement parsed = JsonParser.parseString(json == null ? "[]" : json);
        if (!parsed.isJsonArray()) throw new IllegalStateException("Advanced Stats database response must be an array");
        return parsed.getAsJsonArray();
    }

    private JsonObject parseObject(String json) {
        JsonElement parsed = JsonParser.parseString(json == null || json.isBlank() ? "{}" : json);
        if (!parsed.isJsonObject()) throw new IllegalStateException("Advanced Stats database response must be an object");
        return parsed.getAsJsonObject();
    }

    private String requiredString(JsonObject row, String field) {
        JsonElement value = row.get(field);
        if (value == null || value.isJsonNull()) {
            throw new IllegalStateException("Missing Advanced Stats database field: " + field);
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

    private boolean booleanValue(JsonObject row, String field, boolean fallback) {
        JsonElement value = row.get(field);
        return value == null || value.isJsonNull() ? fallback : value.getAsBoolean();
    }

    private Instant requiredInstant(JsonObject row, String field) {
        Instant value = optionalInstant(row, field);
        if (value == null) throw new IllegalStateException("Missing Advanced Stats database field: " + field);
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

package Java.advancedstats;

import Java.SUPABASE_Client;
import Java.cache.CacheKeys;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

/**
 * Backend-only persistence boundary for Advanced Stats.
 *
 * Phase 1 intentionally exposes only read/existence primitives. Lifecycle writes,
 * battle ingestion and aggregate mutations are added in later phases so storage
 * semantics cannot accidentally become public before ownership rules exist.
 */
public final class AdvancedStatsRepository {
    static final String TRACKING_TABLE = "advanced_stats_tracking";
    static final String BATTLES_TABLE = "advanced_stats_battles";
    static final String BATTLE_UNITS_TABLE = "advanced_stats_battle_units";
    static final String UNIT_TOTALS_TABLE = "advanced_stats_unit_totals";
    static final String ARMY_TOTALS_TABLE = "advanced_stats_army_totals";
    static final String DAILY_TABLE = "advanced_stats_daily";
    static final String GAPS_TABLE = "advanced_stats_tracking_gaps";

    private static final String TRACKING_SELECT = String.join(",",
            "id",
            "user_id",
            "player_tag",
            "player_name",
            "town_hall_level",
            "status",
            "tracking_started_at",
            "bootstrap_completed_at",
            "last_poll_at",
            "last_successful_poll_at",
            "next_poll_at",
            "consecutive_failures",
            "data_complete_since",
            "battles_processed"
    );

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

    public boolean battleFingerprintExists(UUID trackingId, String rawFingerprint) throws Exception {
        if (trackingId == null) throw new IllegalArgumentException("trackingId is required");
        String fingerprint = AdvancedStatsModels.requireSha256(rawFingerprint, "fingerprint");

        String query = "select=id"
                + "&tracking_id=" + SUPABASE_Client.eq(trackingId.toString())
                + "&battle_fingerprint=" + SUPABASE_Client.eq(fingerprint)
                + "&limit=1";

        return !parseArray(SUPABASE_Client.getWithBody(BATTLES_TABLE, query)).isEmpty();
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
                optionalInstant(row, "data_complete_since"),
                optionalLong(row, "battles_processed", 0L)
        );
    }

    private JsonArray parseArray(String json) {
        JsonElement parsed = JsonParser.parseString(json == null ? "[]" : json);
        if (!parsed.isJsonArray()) {
            throw new IllegalStateException("Advanced Stats database response must be an array");
        }
        return parsed.getAsJsonArray();
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

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

/** Backend-only persistence boundary for Advanced Stats. */
public final class AdvancedStatsRepository
        implements AdvancedStatsLifecycleService.Store, AdvancedStatsBattleProcessor.Store {
    static final String TRACKING_TABLE = "advanced_stats_tracking";
    static final String BATTLES_TABLE = "advanced_stats_battles";
    static final String BATTLE_UNITS_TABLE = "advanced_stats_battle_units";
    static final String UNIT_TOTALS_TABLE = "advanced_stats_unit_totals";
    static final String ARMY_TOTALS_TABLE = "advanced_stats_army_totals";
    static final String DAILY_TABLE = "advanced_stats_daily";
    static final String GAPS_TABLE = "advanced_stats_tracking_gaps";

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
        clearLease(patch);
        patchTracking(userId, playerTag, patch);
        return requireTracking(userId, playerTag);
    }

    @Override
    public boolean deleteTracking(UUID userId, String rawPlayerTag) throws Exception {
        if (userId == null) throw new IllegalArgumentException("userId is required");
        String playerTag = CacheKeys.requireValidTag(rawPlayerTag);
        boolean existed = findTracking(userId, playerTag).isPresent();
        if (!existed) return false;
        String filter = "user_id=" + SUPABASE_Client.eq(userId.toString())
                + "&player_tag=" + SUPABASE_Client.eq(playerTag);
        SUPABASE_Client.deleteColumn(TRACKING_TABLE, filter);
        return true;
    }

    @Override
    public AdvancedStatsModels.SaveBattleResult saveProcessedBattle(
            UUID trackingId,
            AdvancedStatsModels.BattleCandidate battle,
            String rawFingerprint,
            AdvancedStatsModels.ParsedArmy army,
            boolean bootstrapImport,
            int parserVersion
    ) throws Exception {
        if (trackingId == null) throw new IllegalArgumentException("trackingId is required");
        if (battle == null) throw new IllegalArgumentException("battle is required");
        if (army == null) throw new IllegalArgumentException("army is required");
        String fingerprint = AdvancedStatsModels.requireSha256(rawFingerprint, "fingerprint");

        JsonObject body = baseBattleRpcBody(trackingId, battle, fingerprint, bootstrapImport, parserVersion);
        body.addProperty("p_army_data_available", army.armyDataAvailable());
        body.add("p_units", unitsJson(army));
        if (army.armyDataAvailable()) {
            body.addProperty("p_army_hash", army.normalizedArmyHash());
            body.add("p_normalized_army_json", JsonParser.parseString(army.normalizedArmyJson()));
        } else {
            body.add("p_army_hash", JsonNull.INSTANCE);
            body.add("p_normalized_army_json", JsonNull.INSTANCE);
        }

        JsonObject result = parseObject(SUPABASE_Client.rpc("save_advanced_stats_battle_v2", body.toString()));
        if (!booleanValue(result, "inserted", false)) {
            return AdvancedStatsModels.SaveBattleResult.duplicate();
        }
        return new AdvancedStatsModels.SaveBattleResult(
                true,
                UUID.fromString(requiredString(result, "battleId"))
        );
    }

    @Override
    public boolean recordParserError(
            UUID trackingId,
            AdvancedStatsModels.BattleCandidate battle,
            String rawFingerprint,
            boolean bootstrapImport,
            int parserVersion
    ) throws Exception {
        if (trackingId == null) throw new IllegalArgumentException("trackingId is required");
        if (battle == null) throw new IllegalArgumentException("battle is required");
        String fingerprint = AdvancedStatsModels.requireSha256(rawFingerprint, "fingerprint");
        JsonObject body = baseBattleRpcBody(trackingId, battle, fingerprint, bootstrapImport, parserVersion);
        JsonObject result = parseObject(SUPABASE_Client.rpc(
                "record_advanced_stats_parser_error_v2",
                body.toString()
        ));
        return booleanValue(result, "inserted", false);
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

    private JsonObject baseBattleRpcBody(
            UUID trackingId,
            AdvancedStatsModels.BattleCandidate battle,
            String fingerprint,
            boolean bootstrapImport,
            int parserVersion
    ) {
        JsonObject body = new JsonObject();
        body.addProperty("p_tracking_id", trackingId.toString());
        body.addProperty("p_player_tag", battle.playerTag());
        body.addProperty("p_battle_fingerprint", fingerprint);
        addInstant(body, "p_battle_timestamp", battle.battleTimestamp());
        addInstant(body, "p_observed_at", battle.observedAt());
        body.addProperty("p_battle_type", battle.battleType());
        body.addProperty("p_opponent_player_tag", battle.opponentPlayerTag());
        body.addProperty("p_opponent_name", battle.opponentName());
        addInteger(body, "p_opponent_town_hall", battle.opponentTownHall());
        addInteger(body, "p_player_town_hall", battle.playerTownHall());
        addInteger(body, "p_stars", battle.stars());
        addDouble(body, "p_destruction_percentage", battle.destructionPercentage());
        body.addProperty("p_army_share_code", battle.armyShareCode());
        body.addProperty("p_loot_gold", battle.lootGold());
        body.addProperty("p_loot_elixir", battle.lootElixir());
        body.addProperty("p_loot_dark_elixir", battle.lootDarkElixir());
        body.addProperty("p_available_gold", battle.availableGold());
        body.addProperty("p_available_elixir", battle.availableElixir());
        body.addProperty("p_available_dark_elixir", battle.availableDarkElixir());
        body.addProperty("p_bootstrap_import", bootstrapImport);
        body.addProperty("p_parser_version", Math.max(1, parserVersion));
        return body;
    }

    private JsonArray unitsJson(AdvancedStatsModels.ParsedArmy army) {
        JsonArray units = new JsonArray();
        for (AdvancedStatsModels.UnitUsage unit : army.units()) {
            JsonObject item = new JsonObject();
            item.addProperty("unit_key", unit.unitKey());
            item.addProperty("unit_name", unit.unitName());
            item.addProperty("category", unit.category().name());
            item.addProperty("quantity", unit.quantity());
            if (unit.unitLevel() == null) item.add("unit_level", JsonNull.INSTANCE);
            else item.addProperty("unit_level", unit.unitLevel());
            units.add(item);
        }
        return units;
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

    private void addInstant(JsonObject object, String field, Instant value) {
        if (value == null) object.add(field, JsonNull.INSTANCE);
        else object.addProperty(field, value.toString());
    }

    private void addInteger(JsonObject object, String field, Integer value) {
        if (value == null) object.add(field, JsonNull.INSTANCE);
        else object.addProperty(field, value);
    }

    private void addDouble(JsonObject object, String field, Double value) {
        if (value == null) object.add(field, JsonNull.INSTANCE);
        else object.addProperty(field, value);
    }
}

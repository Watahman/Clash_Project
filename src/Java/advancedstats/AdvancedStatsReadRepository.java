package Java.advancedstats;

import Java.SUPABASE_Client;
import com.google.gson.JsonElement;
import com.google.gson.JsonNull;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/** Backend-only read repository for graph/UI-ready Advanced Stats data. */
public final class AdvancedStatsReadRepository
        implements AdvancedStatsReadService.ScopedStore, AdvancedStatsCompactReadAggregator.ScopeReader {
    private final AdvancedStatsRepository trackingRepository;
    private final AdvancedStatsCompactReadAggregator compactAggregator;

    public AdvancedStatsReadRepository() {
        this(new AdvancedStatsRepository());
    }

    AdvancedStatsReadRepository(AdvancedStatsRepository trackingRepository) {
        this.trackingRepository = trackingRepository;
        this.compactAggregator = new AdvancedStatsCompactReadAggregator(this);
    }

    @Override
    public Optional<AdvancedStatsModels.TrackingState> findTracking(UUID userId, String playerTag) throws Exception {
        return trackingRepository.findTracking(userId, playerTag);
    }

    @Override
    public JsonObject overview(UUID trackingId, Instant from) throws Exception {
        JsonObject body = trackingBody(trackingId);
        addInstant(body, "p_from", from);
        return objectRpc("read_advanced_stats_overview_v1", body);
    }

    @Override
    public JsonObject overview(UUID trackingId, AdvancedStatsScope scope, Instant from) throws Exception {
        JsonObject body = scopedTrackingBody(trackingId, scope);
        addInstant(body, "p_from", from);
        body.add("p_season_key", JsonNull.INSTANCE);
        return AdvancedStatsPublicSourceMetadata.sanitizeOverview(
                objectRpcWithFallback("read_advanced_stats_compact_overview_v2",
                        "read_advanced_stats_compact_overview_v1", body));
    }

    @Override
    public JsonObject compactOverview(UUID trackingId, Instant from) throws Exception {
        try {
            return AdvancedStatsPublicSourceMetadata.sanitizeOverview(
                    compactAggregator.overview(trackingId, from));
        } catch (Exception compactFailure) {
            return overview(trackingId, from);
        }
    }

    @Override
    public JsonElement units(UUID trackingId, Instant from, AdvancedStatsUnitCategory category) throws Exception {
        JsonObject body = trackingBody(trackingId);
        addInstant(body, "p_from", from);
        if (category == null) body.add("p_category", JsonNull.INSTANCE);
        else body.addProperty("p_category", category.name());
        return elementRpc("read_advanced_stats_units_v1", body);
    }

    @Override
    public JsonElement units(UUID trackingId, AdvancedStatsScope scope, Instant from,
                             AdvancedStatsUnitCategory category) throws Exception {
        JsonObject body = scopedTrackingBody(trackingId, scope);
        addInstant(body, "p_from", from);
        if (category == null) body.add("p_category", JsonNull.INSTANCE);
        else body.addProperty("p_category", category.name());
        body.add("p_season_key", JsonNull.INSTANCE);
        return elementRpcWithFallback("read_advanced_stats_compact_units_v2",
                "read_advanced_stats_compact_units_v1", body);
    }

    @Override
    public JsonElement compactUnits(UUID trackingId, Instant from, AdvancedStatsUnitCategory category)
            throws Exception {
        try {
            return compactAggregator.units(trackingId, from, category);
        } catch (Exception compactFailure) {
            return units(trackingId, from, category);
        }
    }

    @Override
    public JsonElement armies(UUID trackingId, Instant from, int limit) throws Exception {
        JsonObject body = trackingBody(trackingId);
        addInstant(body, "p_from", from);
        body.addProperty("p_limit", limit);
        return elementRpc("read_advanced_stats_armies_v1", body);
    }

    @Override
    public JsonElement armies(UUID trackingId, AdvancedStatsScope scope, Instant from, int limit) throws Exception {
        JsonObject body = scopedTrackingBody(trackingId, scope);
        addInstant(body, "p_from", from);
        body.addProperty("p_limit", limit);
        body.add("p_season_key", JsonNull.INSTANCE);
        return elementRpcWithFallback("read_advanced_stats_compact_armies_v2",
                "read_advanced_stats_compact_armies_v1", body);
    }

    @Override
    public JsonElement compactArmies(UUID trackingId, Instant from, int limit) throws Exception {
        try {
            return compactAggregator.armies(trackingId, from, limit);
        } catch (Exception compactFailure) {
            return armies(trackingId, from, limit);
        }
    }

    @Override
    public JsonObject battles(
            UUID trackingId,
            Instant from,
            int limit,
            Instant cursorAt,
            UUID cursorId
    ) throws Exception {
        JsonObject body = trackingBody(trackingId);
        addInstant(body, "p_from", from);
        body.addProperty("p_limit", limit);
        addInstant(body, "p_cursor_at", cursorAt);
        if (cursorId == null) body.add("p_cursor_id", JsonNull.INSTANCE);
        else body.addProperty("p_cursor_id", cursorId.toString());
        return objectRpc("read_advanced_stats_battles_v1", body);
    }

    @Override
    public JsonObject battles(UUID trackingId, AdvancedStatsScope scope, Instant from, int limit) {
        JsonObject page = new JsonObject();
        page.add("items", new com.google.gson.JsonArray());
        page.addProperty("hasMore", false);
        page.addProperty("unsupported", true);
        page.addProperty("reason", "raw_attack_history_not_retained");
        return page;
    }

    @Override
    public JsonElement trends(UUID trackingId, Instant from) throws Exception {
        JsonObject body = trackingBody(trackingId);
        addInstant(body, "p_from", from);
        return elementRpc("read_advanced_stats_trends_v1", body);
    }

    @Override
    public JsonElement trends(UUID trackingId, AdvancedStatsScope scope, Instant from) throws Exception {
        JsonObject body = scopedTrackingBody(trackingId, scope);
        addInstant(body, "p_from", from);
        body.add("p_season_key", JsonNull.INSTANCE);
        return elementRpcWithFallback("read_advanced_stats_compact_trends_v2",
                "read_advanced_stats_compact_trends_v1", body);
    }

    @Override
    public JsonElement compactTrends(UUID trackingId, Instant from) throws Exception {
        try {
            return compactAggregator.trends(trackingId, from);
        } catch (Exception compactFailure) {
            return trends(trackingId, from);
        }
    }

    private JsonObject trackingBody(UUID trackingId) {
        if (trackingId == null) throw new IllegalArgumentException("trackingId is required");
        JsonObject body = new JsonObject();
        body.addProperty("p_tracking_id", trackingId.toString());
        return body;
    }

    private JsonObject scopedTrackingBody(UUID trackingId, AdvancedStatsScope scope) {
        JsonObject body = trackingBody(trackingId);
        if (scope == null) throw new IllegalArgumentException("scope is required");
        body.addProperty("p_scope", scope.apiValue());
        return body;
    }

    private JsonObject objectRpc(String function, JsonObject body) throws Exception {
        JsonElement value = elementRpc(function, body);
        if (!value.isJsonObject()) {
            throw new IllegalStateException("Advanced Stats read RPC must return an object: " + function);
        }
        return value.getAsJsonObject();
    }

    private JsonObject objectRpcWithFallback(String primary, String fallback, JsonObject body) throws Exception {
        JsonElement value = elementRpcWithFallback(primary, fallback, body);
        if (!value.isJsonObject()) {
            throw new IllegalStateException("Advanced Stats read RPC must return an object: " + primary);
        }
        return value.getAsJsonObject();
    }

    private JsonElement elementRpcWithFallback(String primary, String fallback, JsonObject body) throws Exception {
        try {
            return elementRpc(primary, body);
        } catch (Exception primaryFailure) {
            try {
                return elementRpc(fallback, legacyScopedBody(body));
            } catch (Exception fallbackFailure) {
                fallbackFailure.addSuppressed(primaryFailure);
                throw fallbackFailure;
            }
        }
    }

    private JsonObject legacyScopedBody(JsonObject body) {
        JsonObject legacy = body.deepCopy();
        legacy.remove("p_season_key");
        return legacy;
    }

    private JsonElement elementRpc(String function, JsonObject body) throws Exception {
        String raw = SUPABASE_Client.rpc(function, body.toString());
        JsonElement parsed = JsonParser.parseString(raw == null || raw.isBlank() ? "null" : raw);
        if (parsed == null || parsed.isJsonNull()) return JsonNull.INSTANCE;
        return parsed;
    }

    private void addInstant(JsonObject target, String field, Instant value) {
        if (value == null) target.add(field, JsonNull.INSTANCE);
        else target.addProperty(field, value.toString());
    }
}

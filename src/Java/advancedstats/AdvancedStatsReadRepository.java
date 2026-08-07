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
public final class AdvancedStatsReadRepository implements AdvancedStatsReadService.Store {
    private final AdvancedStatsRepository trackingRepository;

    public AdvancedStatsReadRepository() {
        this(new AdvancedStatsRepository());
    }

    AdvancedStatsReadRepository(AdvancedStatsRepository trackingRepository) {
        this.trackingRepository = trackingRepository;
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
    public JsonElement units(UUID trackingId, Instant from, AdvancedStatsUnitCategory category) throws Exception {
        JsonObject body = trackingBody(trackingId);
        addInstant(body, "p_from", from);
        if (category == null) body.add("p_category", JsonNull.INSTANCE);
        else body.addProperty("p_category", category.name());
        return elementRpc("read_advanced_stats_units_v1", body);
    }

    @Override
    public JsonElement armies(UUID trackingId, Instant from, int limit) throws Exception {
        JsonObject body = trackingBody(trackingId);
        addInstant(body, "p_from", from);
        body.addProperty("p_limit", limit);
        return elementRpc("read_advanced_stats_armies_v1", body);
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
    public JsonElement trends(UUID trackingId, Instant from) throws Exception {
        JsonObject body = trackingBody(trackingId);
        addInstant(body, "p_from", from);
        return elementRpc("read_advanced_stats_trends_v1", body);
    }

    private JsonObject trackingBody(UUID trackingId) {
        if (trackingId == null) throw new IllegalArgumentException("trackingId is required");
        JsonObject body = new JsonObject();
        body.addProperty("p_tracking_id", trackingId.toString());
        return body;
    }

    private JsonObject objectRpc(String function, JsonObject body) throws Exception {
        JsonElement value = elementRpc(function, body);
        if (!value.isJsonObject()) {
            throw new IllegalStateException("Advanced Stats read RPC must return an object: " + function);
        }
        return value.getAsJsonObject();
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

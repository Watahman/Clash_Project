package Java.advancedstats;

import Java.HttpException;
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
    @FunctionalInterface
    interface RpcClient {
        String call(String function, String body) throws Exception;
    }

    private final AdvancedStatsRepository trackingRepository;
    private final AdvancedStatsCompactReadAggregator compactAggregator;
    private final RpcClient rpcClient;

    public AdvancedStatsReadRepository() {
        this(new AdvancedStatsRepository());
    }

    AdvancedStatsReadRepository(AdvancedStatsRepository trackingRepository) {
        this(trackingRepository, SUPABASE_Client::rpc);
    }

    AdvancedStatsReadRepository(AdvancedStatsRepository trackingRepository, RpcClient rpcClient) {
        this.trackingRepository = trackingRepository;
        this.rpcClient = rpcClient;
        this.compactAggregator = new AdvancedStatsCompactReadAggregator(this);
    }

    @Override
    public Optional<AdvancedStatsModels.TrackingState> findTracking(UUID userId, String playerTag) throws Exception {
        return trackingRepository.findTracking(userId, playerTag);
    }

    @Override
    public JsonObject overview(UUID trackingId, Instant from) throws Exception {
        return AdvancedStatsPublicSourceMetadata.sanitizeOverview(
                compactAggregator.overview(trackingId, from));
    }

    @Override
    public JsonObject overview(UUID trackingId, AdvancedStatsScope scope, Instant from) throws Exception {
        JsonObject body = scopedTrackingBody(trackingId, scope);
        addInstant(body, "p_from", from);
        body.add("p_season_key", JsonNull.INSTANCE);
        JsonObject value = objectRpcWithFallback("read_advanced_stats_compact_overview_v2",
                "read_advanced_stats_compact_overview_v1", body);
        return AdvancedStatsPublicSourceMetadata.sanitizeOverview(normalizeOverview(value));
    }

    @Override
    public JsonObject compactOverview(UUID trackingId, Instant from) throws Exception {
        return overview(trackingId, from);
    }

    @Override
    public JsonElement units(UUID trackingId, Instant from, AdvancedStatsUnitCategory category) throws Exception {
        return compactAggregator.units(trackingId, from, category);
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
        return units(trackingId, from, category);
    }

    @Override
    public JsonElement armies(UUID trackingId, Instant from, int limit) throws Exception {
        return compactAggregator.armies(trackingId, from, limit);
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
        return armies(trackingId, from, limit);
    }

    @Override
    public JsonObject battles(
            UUID trackingId,
            Instant from,
            int limit,
            Instant cursorAt,
            UUID cursorId
    ) throws Exception {
        return unsupportedBattleHistory();
    }

    @Override
    public JsonObject battles(UUID trackingId, AdvancedStatsScope scope, Instant from, int limit) {
        return unsupportedBattleHistory();
    }

    private JsonObject unsupportedBattleHistory() {
        JsonObject page = new JsonObject();
        page.add("items", new com.google.gson.JsonArray());
        page.addProperty("hasMore", false);
        page.addProperty("unsupported", true);
        page.addProperty("reason", "raw_attack_history_not_retained");
        return page;
    }

    @Override
    public JsonElement trends(UUID trackingId, Instant from) throws Exception {
        return compactAggregator.trends(trackingId, from);
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
        return trends(trackingId, from);
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
            if (!isUnavailableFunction(primaryFailure)) throw primaryFailure;
            try {
                return elementRpc(fallback, legacyScopedBody(body));
            } catch (Exception fallbackFailure) {
                fallbackFailure.addSuppressed(primaryFailure);
                throw fallbackFailure;
            }
        }
    }

    private boolean isUnavailableFunction(Exception failure) {
        if (!(failure instanceof HttpException http)
                || (http.getStatusCode() != 400 && http.getStatusCode() != 404)) return false;
        String body = http.getResponseBody() == null
                ? "" : http.getResponseBody().toLowerCase(java.util.Locale.ROOT);
        return body.contains("pgrst202")
                || (body.contains("function")
                && (body.contains("does not exist") || body.contains("not found")
                || body.contains("could not find")));
    }

    private JsonObject legacyScopedBody(JsonObject body) {
        JsonObject legacy = body.deepCopy();
        legacy.remove("p_season_key");
        return legacy;
    }

    private JsonElement elementRpc(String function, JsonObject body) throws Exception {
        String raw = rpcClient.call(function, body.toString());
        JsonElement parsed = JsonParser.parseString(raw == null || raw.isBlank() ? "null" : raw);
        if (parsed == null || parsed.isJsonNull()) return JsonNull.INSTANCE;
        return parsed;
    }

    private JsonObject normalizeOverview(JsonObject source) {
        JsonObject result = source == null ? new JsonObject() : source.deepCopy();
        JsonObject summary = result.has("summary") && result.get("summary").isJsonObject()
                ? result.getAsJsonObject("summary") : null;
        if (summary == null) return result;
        copyAliasWhenMissing(summary, "lootAttackCount", "lootKnownAttackCount");
        copyAliasWhenMissing(summary, "averageGoldLooted", "goldLootAverage");
        copyAliasWhenMissing(summary, "averageElixirLooted", "elixirLootAverage");
        copyAliasWhenMissing(summary, "averageDarkElixirLooted", "darkElixirLootAverage");
        copyAliasWhenMissing(summary, "bestGoldLooted", "goldLootBest");
        copyAliasWhenMissing(summary, "bestElixirLooted", "elixirLootBest");
        copyAliasWhenMissing(summary, "bestDarkElixirLooted", "darkElixirLootBest");
        Long lootCount = optionalLong(summary, "lootAttackCount");
        if (lootCount == null || lootCount < 0) {
            unknownLoot(summary, true);
            return result;
        }
        if (lootCount == 0) {
            unknownLoot(summary, false);
            return result;
        }
        addCanonicalLootFields(summary);
        return result;
    }

    private void unknownLoot(JsonObject summary, boolean unknownCount) {
        if (unknownCount) addNull(summary, "lootAttackCount");
        for (String field : lootFields()) addNull(summary, field);
    }

    private void addCanonicalLootFields(JsonObject summary) {
        for (String field : lootFields()) addNullWhenMissing(summary, field);
    }

    private String[] lootFields() {
        return new String[]{
                "goldLooted", "elixirLooted", "darkElixirLooted",
                "averageGoldLooted", "averageElixirLooted", "averageDarkElixirLooted",
                "bestGoldLooted", "bestElixirLooted", "bestDarkElixirLooted"
        };
    }

    private Long optionalLong(JsonObject source, String field) {
        if (!source.has(field) || source.get(field).isJsonNull()) return null;
        try {
            return source.get(field).getAsLong();
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private void addNullWhenMissing(JsonObject target, String field) {
        if (!target.has(field)) addNull(target, field);
    }

    private void copyAliasWhenMissing(JsonObject target, String canonical, String alias) {
        if (!target.has(canonical) && target.has(alias)) target.add(canonical, target.get(alias).deepCopy());
    }

    private void addNull(JsonObject target, String field) {
        target.add(field, JsonNull.INSTANCE);
    }

    private void addInstant(JsonObject target, String field, Instant value) {
        if (value == null) target.add(field, JsonNull.INSTANCE);
        else target.addProperty(field, value.toString());
    }
}

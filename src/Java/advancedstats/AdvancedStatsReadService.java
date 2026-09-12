package Java.advancedstats;

import Java.HttpException;
import com.google.gson.JsonElement;
import com.google.gson.JsonNull;
import com.google.gson.JsonObject;

import java.time.Clock;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/** Ownership-safe orchestration for Advanced Stats read APIs. */
public final class AdvancedStatsReadService {
    public interface Store {
        Optional<AdvancedStatsModels.TrackingState> findTracking(UUID userId, String playerTag) throws Exception;
        JsonObject overview(UUID trackingId, Instant from) throws Exception;
        JsonElement units(UUID trackingId, Instant from, AdvancedStatsUnitCategory category) throws Exception;
        JsonElement armies(UUID trackingId, Instant from, int limit) throws Exception;
        JsonObject battles(UUID trackingId, Instant from, int limit, Instant cursorAt, UUID cursorId) throws Exception;
        JsonElement trends(UUID trackingId, Instant from) throws Exception;
        default JsonObject lifetime(UUID trackingId) throws Exception {
            throw new UnsupportedOperationException("Advanced Stats lifetime reads are not configured");
        }

        default JsonObject compactOverview(UUID trackingId, Instant from) throws Exception { return overview(trackingId, from); }
        default JsonElement compactUnits(UUID trackingId, Instant from, AdvancedStatsUnitCategory category) throws Exception { return units(trackingId, from, category); }
        default JsonElement compactArmies(UUID trackingId, Instant from, int limit) throws Exception { return armies(trackingId, from, limit); }
        default JsonElement compactTrends(UUID trackingId, Instant from) throws Exception { return trends(trackingId, from); }
    }

    /** Scope-aware compact reads. Legacy Store implementations remain source-compatible. */
    public interface ScopedStore extends Store {
        JsonObject overview(UUID trackingId, AdvancedStatsScope scope, Instant from) throws Exception;
        JsonElement units(UUID trackingId, AdvancedStatsScope scope, Instant from,
                          AdvancedStatsUnitCategory category) throws Exception;
        JsonElement armies(UUID trackingId, AdvancedStatsScope scope, Instant from, int limit) throws Exception;
        JsonObject battles(UUID trackingId, AdvancedStatsScope scope, Instant from, int limit) throws Exception;
        JsonElement trends(UUID trackingId, AdvancedStatsScope scope, Instant from) throws Exception;

        default JsonObject overview(UUID trackingId, AdvancedStatsScopeSelection selection, Instant from)
                throws Exception {
            return AdvancedStatsScopeReadSupport.overview(this, trackingId, selection, from);
        }

        default JsonElement units(UUID trackingId, AdvancedStatsScopeSelection selection, Instant from,
                                  AdvancedStatsUnitCategory category) throws Exception {
            return AdvancedStatsScopeReadSupport.units(this, trackingId, selection, from, category);
        }

        default JsonElement armies(UUID trackingId, AdvancedStatsScopeSelection selection, Instant from,
                                   int limit) throws Exception {
            return AdvancedStatsScopeReadSupport.armies(this, trackingId, selection, from, limit);
        }

        default JsonElement trends(UUID trackingId, AdvancedStatsScopeSelection selection, Instant from)
                throws Exception {
            return AdvancedStatsScopeReadSupport.trends(this, trackingId, selection, from);
        }
    }

    record Cursor(Instant at, UUID id) {}
    private record Context(String playerTag, AdvancedStatsModels.TrackingState tracking) {}

    private final Store store;
    private final AdvancedStatsLifecycleService.Ownership ownership;
    private final Clock clock;

    public AdvancedStatsReadService() {
        this(new AdvancedStatsReadRepository(), new AdvancedStatsAccountOwnership(), Clock.systemUTC());
    }

    AdvancedStatsReadService(
            Store store,
            AdvancedStatsLifecycleService.Ownership ownership,
            Clock clock
    ) {
        this.store = store;
        this.ownership = ownership;
        this.clock = clock;
    }

    public JsonObject overview(UUID userId, String rawPlayerTag, String rawPeriod) throws Exception {
        return overview(userId, rawPlayerTag, rawPeriod, null);
    }

    public JsonObject overview(UUID userId, String rawPlayerTag, String rawPeriod, String rawScope) throws Exception {
        AdvancedStatsPeriod period = AdvancedStatsPeriod.parse(rawPeriod);
        AdvancedStatsScopeSelection selection = parseScope(rawScope);
        Context context = requireContext(userId, rawPlayerTag);
        Instant from = period.from(clock.instant());
        JsonObject response = envelope(context, period, from);
        response.add("data", AdvancedStatsScopeReadSupport.overview(
                store, context.tracking().id(), selection, from));
        addScope(response, selection);
        return response;
    }

    public JsonObject units(
            UUID userId,
            String rawPlayerTag,
            String rawPeriod,
            String rawCategory
    ) throws Exception {
        return units(userId, rawPlayerTag, rawPeriod, rawCategory, null);
    }

    public JsonObject units(
            UUID userId,
            String rawPlayerTag,
            String rawPeriod,
            String rawCategory,
            String rawScope
    ) throws Exception {
        AdvancedStatsPeriod period = AdvancedStatsPeriod.parse(rawPeriod);
        AdvancedStatsUnitCategory category = parseCategory(rawCategory);
        AdvancedStatsScopeSelection selection = parseScope(rawScope);
        Context context = requireContext(userId, rawPlayerTag);
        Instant from = period.from(clock.instant());
        JsonObject response = envelope(context, period, from);
        if (category == null) response.add("category", JsonNull.INSTANCE);
        else response.addProperty("category", category.name());
        response.add("items", AdvancedStatsScopeReadSupport.units(
                store, context.tracking().id(), selection, from, category));
        addScope(response, selection);
        return response;
    }

    public JsonObject armies(
            UUID userId,
            String rawPlayerTag,
            String rawPeriod,
            int requestedLimit
    ) throws Exception {
        return armies(userId, rawPlayerTag, rawPeriod, requestedLimit, null);
    }

    public JsonObject armies(
            UUID userId,
            String rawPlayerTag,
            String rawPeriod,
            int requestedLimit,
            String rawScope
    ) throws Exception {
        AdvancedStatsPeriod period = AdvancedStatsPeriod.parse(rawPeriod);
        int limit = AdvancedStatsReadResponseSupport.boundedLimit(requestedLimit, 20, 100);
        AdvancedStatsScopeSelection selection = parseScope(rawScope);
        Context context = requireContext(userId, rawPlayerTag);
        Instant from = period.from(clock.instant());
        JsonObject response = envelope(context, period, from);
        response.addProperty("limit", limit);
        response.add("items", AdvancedStatsScopeReadSupport.armies(
                store, context.tracking().id(), selection, from, limit));
        addScope(response, selection);
        return response;
    }

    public JsonObject battles(
            UUID userId,
            String rawPlayerTag,
            String rawPeriod,
            int requestedLimit,
            String rawCursor
    ) throws Exception {
        return battles(userId, rawPlayerTag, rawPeriod, requestedLimit, rawCursor, null);
    }

    public JsonObject battles(
            UUID userId,
            String rawPlayerTag,
            String rawPeriod,
            int requestedLimit,
            String rawCursor,
            String rawScope
    ) throws Exception {
        AdvancedStatsPeriod period = AdvancedStatsPeriod.parse(rawPeriod);
        int limit = AdvancedStatsReadResponseSupport.boundedLimit(requestedLimit, 25, 100);
        AdvancedStatsScopeSelection selection = parseScope(rawScope);
        Cursor cursor = AdvancedStatsReadResponseSupport.decodeCursor(rawCursor);
        Context context = requireContext(userId, rawPlayerTag);
        Instant from = period.from(clock.instant());

        JsonObject page = !selection.supplied() || selection.isAll() ? store.battles(
                context.tracking().id(), from, limit,
                cursor == null ? null : cursor.at(), cursor == null ? null : cursor.id())
                : selection.isSingleScope()
                ? scopedStore().battles(context.tracking().id(), selection.singleScope(), from, limit)
                : throwUnsupportedSelection();

        JsonObject response = envelope(context, period, from);
        response.addProperty("limit", limit);
        response.add("items", AdvancedStatsReadResponseSupport.copyOrNull(page, "items"));
        boolean hasMore = page.has("hasMore") && !page.get("hasMore").isJsonNull()
                && page.get("hasMore").getAsBoolean();
        response.addProperty("hasMore", hasMore);

        if (hasMore && AdvancedStatsReadResponseSupport.hasText(page, "nextCursorAt")
                && AdvancedStatsReadResponseSupport.hasText(page, "nextCursorId")) {
            Cursor next = new Cursor(
                    Instant.parse(page.get("nextCursorAt").getAsString()),
                    UUID.fromString(page.get("nextCursorId").getAsString())
            );
            response.addProperty("nextCursor", AdvancedStatsReadResponseSupport.encodeCursor(next));
        } else {
            response.add("nextCursor", JsonNull.INSTANCE);
        }
        if (page.has("unsupported") && page.get("unsupported").getAsBoolean()) {
            response.addProperty("unsupported", true);
            if (AdvancedStatsReadResponseSupport.hasText(page, "reason")) {
                response.addProperty("reason", page.get("reason").getAsString());
            }
        }
        addScope(response, selection);
        return response;
    }

    public JsonObject trends(UUID userId, String rawPlayerTag, String rawPeriod) throws Exception {
        return trends(userId, rawPlayerTag, rawPeriod, null);
    }

    public JsonObject trends(UUID userId, String rawPlayerTag, String rawPeriod, String rawScope) throws Exception {
        AdvancedStatsPeriod period = AdvancedStatsPeriod.parse(rawPeriod);
        AdvancedStatsScopeSelection selection = parseScope(rawScope);
        Context context = requireContext(userId, rawPlayerTag);
        Instant from = period.from(clock.instant());
        JsonObject response = envelope(context, period, from);
        response.add("points", AdvancedStatsScopeReadSupport.trends(
                store, context.tracking().id(), selection, from));
        addScope(response, selection);
        return response;
    }

    public JsonObject lifetime(UUID userId, String rawPlayerTag) throws Exception {
        Context context = requireContext(userId, rawPlayerTag);
        JsonObject response = envelope(context, AdvancedStatsPeriod.ALL, null);
        response.add("data", store.lifetime(context.tracking().id()));
        return response;
    }

    private ScopedStore scopedStore() throws HttpException {
        return AdvancedStatsScopeReadSupport.requireScoped(store);
    }

    private Context requireContext(UUID userId, String rawPlayerTag) throws Exception {
        String playerTag = ownership.requireLinkedAccount(userId, rawPlayerTag);
        AdvancedStatsModels.TrackingState tracking = store.findTracking(userId, playerTag)
                .orElseThrow(() -> new HttpException(
                        404,
                        "{\"error\":\"Advanced Stats tracking is niet ingeschakeld\",\"code\":\"ADVANCED_STATS_NOT_ENABLED\"}"
                ));
        return new Context(playerTag, tracking);
    }

    private JsonObject envelope(Context context, AdvancedStatsPeriod period, Instant from) {
        JsonObject response = new JsonObject();
        response.addProperty("playerTag", context.playerTag());
        response.addProperty("status", context.tracking().status().name());
        response.addProperty("period", period.apiValue());
        if (from == null) response.add("from", JsonNull.INSTANCE);
        else response.addProperty("from", from.toString());
        return response;
    }

    private AdvancedStatsUnitCategory parseCategory(String rawCategory) {
        if (rawCategory == null || rawCategory.isBlank() || "ALL".equalsIgnoreCase(rawCategory.trim())) return null;
        try {
            return AdvancedStatsUnitCategory.fromDatabase(rawCategory);
        } catch (IllegalArgumentException invalid) {
            throw new IllegalArgumentException("Ongeldige Advanced Stats unit category: " + rawCategory);
        }
    }

    private AdvancedStatsScopeSelection parseScope(String rawScope) {
        try {
            return AdvancedStatsScopeSelection.parse(rawScope);
        } catch (IllegalArgumentException invalid) {
            throw new IllegalArgumentException("Ongeldige Advanced Stats scope: " + rawScope);
        }
    }

    private void addScope(JsonObject response, AdvancedStatsScopeSelection selection) {
        if (selection.supplied()) response.addProperty("scope", selection.apiValue());
    }

    private JsonObject throwUnsupportedSelection() throws HttpException {
        throw new HttpException(501,
                "{\"error\":\"Advanced Stats scope cannot be paginated\","
                        + "\"code\":\"ADVANCED_STATS_SCOPE_UNAVAILABLE\"}");
    }

    static String encodeCursor(Cursor cursor) {
        return AdvancedStatsReadResponseSupport.encodeCursor(cursor);
    }

    static Cursor decodeCursor(String rawCursor) {
        return AdvancedStatsReadResponseSupport.decodeCursor(rawCursor);
    }

}

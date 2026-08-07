package Java.advancedstats;

import Java.HttpException;
import com.google.gson.JsonElement;
import com.google.gson.JsonNull;
import com.google.gson.JsonObject;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
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
        AdvancedStatsPeriod period = AdvancedStatsPeriod.parse(rawPeriod);
        Context context = requireContext(userId, rawPlayerTag);
        Instant from = period.from(clock.instant());
        JsonObject response = envelope(context, period, from);
        response.add("data", store.overview(context.tracking().id(), from));
        return response;
    }

    public JsonObject units(
            UUID userId,
            String rawPlayerTag,
            String rawPeriod,
            String rawCategory
    ) throws Exception {
        AdvancedStatsPeriod period = AdvancedStatsPeriod.parse(rawPeriod);
        AdvancedStatsUnitCategory category = parseCategory(rawCategory);
        Context context = requireContext(userId, rawPlayerTag);
        Instant from = period.from(clock.instant());
        JsonObject response = envelope(context, period, from);
        if (category == null) response.add("category", JsonNull.INSTANCE);
        else response.addProperty("category", category.name());
        response.add("items", store.units(context.tracking().id(), from, category));
        return response;
    }

    public JsonObject armies(
            UUID userId,
            String rawPlayerTag,
            String rawPeriod,
            int requestedLimit
    ) throws Exception {
        AdvancedStatsPeriod period = AdvancedStatsPeriod.parse(rawPeriod);
        int limit = boundedLimit(requestedLimit, 20, 100);
        Context context = requireContext(userId, rawPlayerTag);
        Instant from = period.from(clock.instant());
        JsonObject response = envelope(context, period, from);
        response.addProperty("limit", limit);
        response.add("items", store.armies(context.tracking().id(), from, limit));
        return response;
    }

    public JsonObject battles(
            UUID userId,
            String rawPlayerTag,
            String rawPeriod,
            int requestedLimit,
            String rawCursor
    ) throws Exception {
        AdvancedStatsPeriod period = AdvancedStatsPeriod.parse(rawPeriod);
        int limit = boundedLimit(requestedLimit, 25, 100);
        Cursor cursor = decodeCursor(rawCursor);
        Context context = requireContext(userId, rawPlayerTag);
        Instant from = period.from(clock.instant());

        JsonObject page = store.battles(
                context.tracking().id(),
                from,
                limit,
                cursor == null ? null : cursor.at(),
                cursor == null ? null : cursor.id()
        );

        JsonObject response = envelope(context, period, from);
        response.addProperty("limit", limit);
        response.add("items", copyOrNull(page, "items"));
        boolean hasMore = page.has("hasMore") && !page.get("hasMore").isJsonNull()
                && page.get("hasMore").getAsBoolean();
        response.addProperty("hasMore", hasMore);

        if (hasMore && hasText(page, "nextCursorAt") && hasText(page, "nextCursorId")) {
            Cursor next = new Cursor(
                    Instant.parse(page.get("nextCursorAt").getAsString()),
                    UUID.fromString(page.get("nextCursorId").getAsString())
            );
            response.addProperty("nextCursor", encodeCursor(next));
        } else {
            response.add("nextCursor", JsonNull.INSTANCE);
        }
        return response;
    }

    public JsonObject trends(UUID userId, String rawPlayerTag, String rawPeriod) throws Exception {
        AdvancedStatsPeriod period = AdvancedStatsPeriod.parse(rawPeriod);
        Context context = requireContext(userId, rawPlayerTag);
        Instant from = period.from(clock.instant());
        JsonObject response = envelope(context, period, from);
        response.add("points", store.trends(context.tracking().id(), from));
        return response;
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

    static int boundedLimit(int requested, int fallback, int maximum) {
        if (requested <= 0) return fallback;
        return Math.min(requested, maximum);
    }

    static String encodeCursor(Cursor cursor) {
        if (cursor == null || cursor.at() == null || cursor.id() == null) {
            throw new IllegalArgumentException("cursor is incomplete");
        }
        String value = cursor.at().toString() + "|" + cursor.id();
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    static Cursor decodeCursor(String rawCursor) {
        if (rawCursor == null || rawCursor.isBlank()) return null;
        try {
            String decoded = new String(
                    Base64.getUrlDecoder().decode(rawCursor.trim()),
                    StandardCharsets.UTF_8
            );
            String[] parts = decoded.split("\\|", -1);
            if (parts.length != 2) throw new IllegalArgumentException();
            return new Cursor(Instant.parse(parts[0]), UUID.fromString(parts[1]));
        } catch (RuntimeException invalid) {
            throw new IllegalArgumentException("Ongeldige Advanced Stats cursor");
        }
    }

    private JsonElement copyOrNull(JsonObject source, String field) {
        JsonElement value = source.get(field);
        return value == null ? JsonNull.INSTANCE : value.deepCopy();
    }

    private boolean hasText(JsonObject source, String field) {
        JsonElement value = source.get(field);
        return value != null && !value.isJsonNull() && !value.getAsString().isBlank();
    }
}

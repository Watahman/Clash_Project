package Java.advancedstats;

import Java.HttpException;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdvancedStatsReadServiceTest {
    private static final Instant NOW = Instant.parse("2026-08-07T14:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID TRACKING_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID CURSOR_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");

    @Test
    void thirtyDayOverviewUsesCanonicalLookbackAndOwnedTrackingId() throws Exception {
        FakeStore store = new FakeStore(state(AdvancedStatsTrackingStatus.ACTIVE));
        AdvancedStatsReadService service = service(store);

        JsonObject response = service.overview(USER_ID, "#2PYLQ", "30d");

        assertEquals("#2PYLQ", response.get("playerTag").getAsString());
        assertEquals("30d", response.get("period").getAsString());
        assertEquals(NOW.minus(Duration.ofDays(30)), store.from);
        assertEquals(TRACKING_ID, store.trackingId);
        assertEquals(1, store.compactOverviewCalls);
        assertEquals(7, response.getAsJsonObject("data").get("value").getAsInt());
    }

    @Test
    void allTimeUsesNullDatabaseBoundary() throws Exception {
        FakeStore store = new FakeStore(state(AdvancedStatsTrackingStatus.STOPPED));
        JsonObject response = service(store).overview(USER_ID, "2PYLQ", "all");

        assertTrue(response.get("from").isJsonNull());
        assertNull(store.from);
        assertEquals("STOPPED", response.get("status").getAsString());
    }

    @Test
    void unitCategoryAndPeriodAreValidatedBeforeQuery() throws Exception {
        FakeStore store = new FakeStore(state(AdvancedStatsTrackingStatus.ACTIVE));
        JsonObject response = service(store).units(USER_ID, "#2PYLQ", "7d", "SUPER_TROOP");

        assertEquals(AdvancedStatsUnitCategory.SUPER_TROOP, store.category);
        assertEquals(1, store.compactUnitsCalls);
        assertEquals(NOW.minus(Duration.ofDays(7)), store.from);
        assertTrue(response.get("items").isJsonArray());

        assertThrows(IllegalArgumentException.class,
                () -> service(store).units(USER_ID, "#2PYLQ", "7d", "NOT_A_UNIT"));
        assertThrows(IllegalArgumentException.class,
                () -> service(store).overview(USER_ID, "#2PYLQ", "365d"));
    }

    @Test
    void limitsAreBounded() throws Exception {
        FakeStore store = new FakeStore(state(AdvancedStatsTrackingStatus.ACTIVE));

        service(store).armies(USER_ID, "#2PYLQ", "90d", 9999);
        assertEquals(100, store.limit);
        assertEquals(1, store.compactArmiesCalls);

        service(store).battles(USER_ID, "#2PYLQ", "90d", 0, null);
        assertEquals(25, store.limit);
    }

    @Test
    void unscopedTrendsUseCompactReadContract() throws Exception {
        FakeStore store = new FakeStore(state(AdvancedStatsTrackingStatus.ACTIVE));

        service(store).trends(USER_ID, "#2PYLQ", "30d");

        assertEquals(1, store.compactTrendsCalls);
    }

    @Test
    void opaqueBattleCursorRoundTripsAndIsReturnedFromDatabaseBoundary() throws Exception {
        FakeStore store = new FakeStore(state(AdvancedStatsTrackingStatus.ACTIVE));
        store.nextCursorAt = NOW.minus(Duration.ofHours(2));
        store.nextCursorId = CURSOR_ID;
        store.hasMore = true;

        JsonObject first = service(store).battles(USER_ID, "#2PYLQ", "30d", 25, null);
        String cursor = first.get("nextCursor").getAsString();
        assertFalse(cursor.contains("|"));
        assertTrue(first.get("hasMore").getAsBoolean());

        service(store).battles(USER_ID, "#2PYLQ", "30d", 25, cursor);
        assertEquals(store.nextCursorAt, store.cursorAt);
        assertEquals(CURSOR_ID, store.cursorId);
    }

    @Test
    void invalidCursorIsRejectedBeforeDatabaseQuery() {
        FakeStore store = new FakeStore(state(AdvancedStatsTrackingStatus.ACTIVE));
        assertThrows(IllegalArgumentException.class,
                () -> service(store).battles(USER_ID, "#2PYLQ", "30d", 25, "not-a-cursor"));
        assertEquals(0, store.battleCalls);
    }

    @Test
    void missingTrackingReturnsNotEnabledWithoutReadingStats() {
        FakeStore store = new FakeStore(null);
        HttpException error = assertThrows(HttpException.class,
                () -> service(store).overview(USER_ID, "#2PYLQ", "all"));

        assertEquals(404, error.getStatusCode());
        assertEquals(0, store.overviewCalls);
    }

    @Test
    void ownershipIsRequiredBeforeTrackingLookup() {
        FakeStore store = new FakeStore(state(AdvancedStatsTrackingStatus.ACTIVE));
        AdvancedStatsReadService service = new AdvancedStatsReadService(
                store,
                (userId, tag) -> { throw new HttpException(403, "{\"error\":\"forbidden\"}"); },
                CLOCK
        );

        assertThrows(HttpException.class, () -> service.overview(USER_ID, "#2PYLQ", "all"));
        assertEquals(0, store.findCalls);
    }

    @Test
    void cursorCodecIsStable() {
        AdvancedStatsReadService.Cursor cursor = new AdvancedStatsReadService.Cursor(NOW, CURSOR_ID);
        String encoded = AdvancedStatsReadService.encodeCursor(cursor);
        AdvancedStatsReadService.Cursor decoded = AdvancedStatsReadService.decodeCursor(encoded);
        assertNotNull(decoded);
        assertEquals(cursor, decoded);
    }

    private AdvancedStatsReadService service(FakeStore store) {
        return new AdvancedStatsReadService(store, (userId, rawTag) -> "#2PYLQ", CLOCK);
    }

    private AdvancedStatsModels.TrackingState state(AdvancedStatsTrackingStatus status) {
        return new AdvancedStatsModels.TrackingState(
                TRACKING_ID,
                USER_ID,
                "#2PYLQ",
                "Player",
                17,
                status,
                NOW.minus(Duration.ofDays(100)),
                NOW.minus(Duration.ofDays(100)),
                NOW.minus(Duration.ofMinutes(5)),
                NOW.minus(Duration.ofMinutes(5)),
                NOW.plus(Duration.ofMinutes(15)),
                0,
                null,
                NOW.minus(Duration.ofDays(100)),
                500
        );
    }

    private static final class FakeStore implements AdvancedStatsReadService.Store {
        private final AdvancedStatsModels.TrackingState state;
        private UUID trackingId;
        private Instant from;
        private AdvancedStatsUnitCategory category;
        private int limit;
        private Instant cursorAt;
        private UUID cursorId;
        private Instant nextCursorAt;
        private UUID nextCursorId;
        private boolean hasMore;
        private int findCalls;
        private int overviewCalls;
        private int battleCalls;
        private int compactOverviewCalls;
        private int compactUnitsCalls;
        private int compactArmiesCalls;
        private int compactTrendsCalls;

        private FakeStore(AdvancedStatsModels.TrackingState state) {
            this.state = state;
        }

        @Override
        public Optional<AdvancedStatsModels.TrackingState> findTracking(UUID userId, String playerTag) {
            findCalls++;
            assertEquals(USER_ID, userId);
            assertEquals("#2PYLQ", playerTag);
            return Optional.ofNullable(state);
        }

        @Override
        public JsonObject overview(UUID trackingId, Instant from) {
            overviewCalls++;
            capture(trackingId, from);
            JsonObject result = new JsonObject();
            result.addProperty("value", 7);
            return result;
        }

        @Override
        public JsonObject compactOverview(UUID trackingId, Instant from) throws Exception {
            compactOverviewCalls++;
            return overview(trackingId, from);
        }

        @Override
        public JsonElement units(UUID trackingId, Instant from, AdvancedStatsUnitCategory category) {
            capture(trackingId, from);
            this.category = category;
            return new JsonArray();
        }

        @Override
        public JsonElement compactUnits(UUID trackingId, Instant from, AdvancedStatsUnitCategory category)
                throws Exception {
            compactUnitsCalls++;
            return units(trackingId, from, category);
        }

        @Override
        public JsonElement armies(UUID trackingId, Instant from, int limit) {
            capture(trackingId, from);
            this.limit = limit;
            return new JsonArray();
        }

        @Override
        public JsonElement compactArmies(UUID trackingId, Instant from, int limit) throws Exception {
            compactArmiesCalls++;
            return armies(trackingId, from, limit);
        }

        @Override
        public JsonObject battles(UUID trackingId, Instant from, int limit, Instant cursorAt, UUID cursorId) {
            battleCalls++;
            capture(trackingId, from);
            this.limit = limit;
            this.cursorAt = cursorAt;
            this.cursorId = cursorId;
            JsonObject result = new JsonObject();
            result.add("items", new JsonArray());
            result.addProperty("hasMore", hasMore);
            if (hasMore) {
                result.addProperty("nextCursorAt", nextCursorAt.toString());
                result.addProperty("nextCursorId", nextCursorId.toString());
            }
            return result;
        }

        @Override
        public JsonElement trends(UUID trackingId, Instant from) {
            capture(trackingId, from);
            return new JsonArray();
        }

        @Override
        public JsonElement compactTrends(UUID trackingId, Instant from) throws Exception {
            compactTrendsCalls++;
            return trends(trackingId, from);
        }

        private void capture(UUID trackingId, Instant from) {
            this.trackingId = trackingId;
            this.from = from;
        }
    }
}

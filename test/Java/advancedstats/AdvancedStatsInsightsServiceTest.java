package Java.advancedstats;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.EnumMap;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AdvancedStatsInsightsServiceTest {
    private static final Instant NOW = Instant.parse("2026-09-16T12:00:00Z");
    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");

    @Test
    void selectedSectionUsesOwnedTagAndPeriodWithoutCallingOtherReaders() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        var readers = new EnumMap<AdvancedStatsInsightsService.Section,
                AdvancedStatsInsightsService.SectionReader>(AdvancedStatsInsightsService.Section.class);
        readers.put(AdvancedStatsInsightsService.Section.WAR_CWL, (tag, period, from) -> {
            calls.incrementAndGet();
            assertEquals("#2PYLQ", tag);
            assertEquals(AdvancedStatsPeriod.NINETY_DAYS, period);
            assertEquals(NOW.minusSeconds(90L * 86400), from);
            JsonObject result = new JsonObject();
            result.addProperty("coverage", "partial");
            return result;
        });
        readers.put(AdvancedStatsInsightsService.Section.LEAGUE, (tag, period, from) -> {
            throw new AssertionError("Inactive section was called");
        });
        AdvancedStatsInsightsService service = service(readers);

        JsonObject result = service.read(USER_ID, "#2PYLQ", "90d", "warCwl");

        assertEquals(1, calls.get());
        assertEquals("warCwl", result.get("section").getAsString());
        assertEquals("partial", result.getAsJsonObject("data").get("coverage").getAsString());
    }

    @Test
    void invalidSectionAndPeriodNeverInvokeProvider() {
        AdvancedStatsInsightsService service = service(new EnumMap<>(AdvancedStatsInsightsService.Section.class));
        assertThrows(IllegalArgumentException.class,
                () -> service.read(USER_ID, "#2PYLQ", "30d", "unknown"));
        assertThrows(IllegalArgumentException.class,
                () -> service.read(USER_ID, "#2PYLQ", "365d", "warCwl"));
    }

    @Test
    void missingOwnedTrackingStopsBeforeProviderRead() {
        AtomicInteger calls = new AtomicInteger();
        var readers = new EnumMap<AdvancedStatsInsightsService.Section,
                AdvancedStatsInsightsService.SectionReader>(AdvancedStatsInsightsService.Section.class);
        readers.put(AdvancedStatsInsightsService.Section.WAR_CWL, (tag, period, from) -> {
            calls.incrementAndGet();
            return new JsonObject();
        });
        AdvancedStatsInsightsService service = new AdvancedStatsInsightsService(
                (userId, playerTag) -> { throw new IllegalStateException("not owned"); }, readers,
                Clock.fixed(NOW, ZoneOffset.UTC));

        assertThrows(IllegalStateException.class,
                () -> service.read(USER_ID, "#2PYLQ", "30d", "warCwl"));
        assertEquals(0, calls.get());
    }

    @Test
    void currentSeasonIsOwnerScopedAndLeagueOnly() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        AdvancedStatsInsightsService service = new AdvancedStatsInsightsService(
                (userId, playerTag) -> tracking(),
                new EnumMap<>(AdvancedStatsInsightsService.Section.class),
                tag -> {
                    calls.incrementAndGet();
                    assertEquals("#2PYLQ", tag);
                    return new JsonObject();
                }, Clock.fixed(NOW, ZoneOffset.UTC));

        JsonObject response = service.read(USER_ID, "#2PYLQ", "current-season", "league");

        assertEquals("current-season", response.get("period").getAsString());
        assertEquals(1, calls.get());
        assertThrows(IllegalArgumentException.class,
                () -> service.read(USER_ID, "#2PYLQ", "current-season", "warCwl"));
        assertEquals(1, calls.get());

        AdvancedStatsInsightsService denied = new AdvancedStatsInsightsService(
                (userId, playerTag) -> { throw new IllegalStateException("not owned"); },
                new EnumMap<>(AdvancedStatsInsightsService.Section.class),
                tag -> { calls.incrementAndGet(); return new JsonObject(); },
                Clock.fixed(NOW, ZoneOffset.UTC));
        assertThrows(IllegalStateException.class,
                () -> denied.read(USER_ID, "#2PYLQ", "current-season", "league"));
        assertEquals(1, calls.get());
    }

    private AdvancedStatsInsightsService service(
            EnumMap<AdvancedStatsInsightsService.Section, AdvancedStatsInsightsService.SectionReader> readers) {
        return new AdvancedStatsInsightsService((userId, playerTag) -> tracking(), readers,
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private AdvancedStatsModels.TrackingState tracking() {
        return new AdvancedStatsModels.TrackingState(
                UUID.fromString("22222222-2222-2222-2222-222222222222"), USER_ID,
                "#2PYLQ", "Player", 17, AdvancedStatsTrackingStatus.ACTIVE,
                NOW.minusSeconds(86400), null, null, null, null, 0, null, null, 0);
    }
}

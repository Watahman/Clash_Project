package Java.advancedstats;

import com.google.gson.JsonElement;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;

import static Java.advancedstats.AdvancedStatsProgressionModels.Coverage;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdvancedStatsProgressionTest {
    private static final Instant NOW = Instant.parse("2026-09-15T00:00:00Z");

    @Test
    void normalizerKeepsDatedSupportedChangesAndSkipsUnknownTypes() {
        var result = AdvancedStatsProgressionNormalizer.changes(JsonParser.parseString("""
                {"items":[
                  {"time":"2026-09-14T01:00:00Z","type":"hero_upgrade","item":{"name":"Archer Queen","id":2},"previous":{"level":70},"current":{"level":74}},
                  {"time":"2026-09-13T01:00:00Z","type":"townhall_level","townhall_level":17,"previous":16,"current":17},
                  {"time":"2026-09-12T01:00:00Z","type":"name_change","townhall_level":17}
                ]}
                """), NOW, "test/changes");

        assertEquals(3, result.records());
        assertEquals(2, result.events().size());
        assertEquals("hero", result.events().getFirst().kind().apiValue());
        assertEquals(4L, result.events().getFirst().delta());
        assertEquals("townhall", result.events().getLast().entityKey());
        assertEquals(0, result.invalidRecords());
    }

    @Test
    void serviceFiltersPeriodAndSeparatesCurrentFromChangeEvidence() {
        var provider = new AdvancedStatsProgressionProvider(new FixtureTransport(
                JsonParser.parseString("""
                        {"items":[
                          {"time":"2026-09-14T01:00:00Z","type":"hero_upgrade","item":{"name":"Archer Queen","id":2},"previous":70,"current":74},
                          {"time":"2026-08-10T01:00:00Z","type":"pet_upgrade","item":{"name":"L.A.S.S.I.","id":1},"previous":5,"current":6}
                        ]}
                        """),
                JsonParser.parseString("""
                        {"items":[
                          {"eventTime":"2026-09-10T01:00:00Z","statType":"donated","previousValue":100,"currentValue":350,"delta":250},
                          {"eventTime":"2026-09-14T01:00:00Z","statType":"donated","previousValue":350,"currentValue":500,"delta":150}
                        ]}
                        """)));

        var response = new AdvancedStatsProgressionService(provider)
                .read("#P0Y8LQ", AdvancedStatsPeriod.THIRTY_DAYS,
                        Instant.parse("2026-09-01T00:00:00Z"), NOW);

        assertEquals("complete", response.getAsJsonObject("coverage").get("status").getAsString());
        assertEquals(3, response.getAsJsonArray("changes").size());
        assertEquals(74, response.getAsJsonObject("current").getAsJsonArray("heroes")
                .get(0).getAsJsonObject().get("value").getAsInt());
        assertEquals(500, response.getAsJsonObject("donation").get("current").getAsInt());
        assertEquals(400, response.getAsJsonObject("donation").get("delta").getAsInt());
        assertEquals("no_dated_source", response.getAsJsonObject("unsupported")
                .get("trophy").getAsString());
        assertTrue(response.getAsJsonObject("current").get("townHall").isJsonNull());

        var emptyPeriod = new AdvancedStatsProgressionService(provider)
                .read("#P0Y8LQ", AdvancedStatsPeriod.ALL,
                        Instant.parse("2026-09-15T00:00:00Z"), NOW);
        assertEquals(0, emptyPeriod.getAsJsonArray("changes").size());
        assertEquals(74, emptyPeriod.getAsJsonObject("current").getAsJsonArray("heroes")
                .get(0).getAsJsonObject().get("value").getAsInt());
    }

    @Test
    void providerCachesBoundedSourceFetchAndReportsPartialFailures() {
        AtomicInteger changesCalls = new AtomicInteger();
        AtomicInteger donationCalls = new AtomicInteger();
        var transport = new AdvancedStatsProgressionProvider.Transport() {
            @Override
            public JsonElement changes(String playerTag) {
                changesCalls.incrementAndGet();
                return JsonParser.parseString("{\"items\":[]}");
            }

            @Override
            public JsonElement donations(String playerTag) throws Exception {
                donationCalls.incrementAndGet();
                throw new IllegalStateException("private upstream detail");
            }
        };
        var provider = new AdvancedStatsProgressionProvider(transport);

        var first = provider.fetch("#P0Y8LQ", NOW);
        var second = provider.fetch("#P0Y8LQ", NOW.plusSeconds(10));

        assertEquals(1, changesCalls.get());
        assertEquals(1, donationCalls.get());
        assertEquals(Coverage.PARTIAL, overall(first));
        assertEquals(Coverage.PARTIAL, overall(second));
        assertFalse(first.sources().getLast().failureCode().contains("private"));
    }

    @Test
    void malformedRowsBecomePartialWithoutLeakingErrorText() {
        var provider = new AdvancedStatsProgressionProvider(new FixtureTransport(
                JsonParser.parseString("""
                        {"items":[
                          {"time":"2026-09-14T01:00:00Z","type":"hero_upgrade","item":{"id":2},"previous":70,"current":74}
                        ]}
                        """), JsonParser.parseString("""
                        {"items":[]}
                        """)));

        var response = new AdvancedStatsProgressionService(provider)
                .read("#P0Y8LQ", AdvancedStatsPeriod.ALL, null, NOW);

        assertEquals("partial", response.getAsJsonObject("coverage").get("status").getAsString());
        assertEquals(0, response.getAsJsonArray("changes").size());
        assertTrue(response.toString().contains("INVALID_RESPONSE"));
        assertFalse(response.toString().contains("item is missing name"));
    }

    private static Coverage overall(AdvancedStatsProgressionModels.SourceData data) {
        return data.sources().stream().anyMatch(s -> s.coverage() == Coverage.UNAVAILABLE)
                ? Coverage.PARTIAL : Coverage.COMPLETE;
    }

    private record FixtureTransport(JsonElement changes, JsonElement donations)
            implements AdvancedStatsProgressionProvider.Transport {
        @Override
        public JsonElement changes(String playerTag) {
            return changes;
        }

        @Override
        public JsonElement donations(String playerTag) {
            return donations;
        }
    }
}

package Java.advancedstats;

import Java.advancedstats.AdvancedStatsHistoryModels.AttackObservation;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdvancedStatsLeagueParserTest {
    private static final Instant NOW = Instant.parse("2026-08-15T12:00:00Z");

    @Test
    void onlyRowsWithVerifiedTimeStarsAndDestructionBecomeOffensiveMetrics() {
        var payload = JsonParser.parseString("{\"attacks\":["
                + "{\"time\":\"2026-08-15T10:00:00Z\",\"stars\":3,"
                + "\"destructionPercentage\":100,\"shareCode\":\"u10x0-2x5\"},"
                + "{\"time\":\"2026-08-15T11:00:00Z\",\"stars\":2},"
                + "{\"time\":\"2026-08-15T11:30:00Z\",\"stars\":1,"
                + "\"destructionPercentage\":40}]}").getAsJsonObject();

        AdvancedStatsLeagueModels.ParsedAttacks parsed = AdvancedStatsLeagueParser.legend(
                payload, "1755000000", "2026-08-15", "#P0Y8LQ", NOW);

        assertEquals(3, parsed.coverage().sourceRows());
        assertEquals(2, parsed.coverage().validRows());
        assertEquals(1, parsed.coverage().invalidRows());
        var summary = AdvancedStatsLeagueParser.aggregate(parsed.observations());
        assertEquals(2, summary.get("attacks").getAsInt());
        assertEquals(4, summary.get("stars").getAsInt());
        assertEquals(1, summary.getAsJsonObject("starDistribution").get("3").getAsInt());
        assertEquals("PARTIAL", summary.getAsJsonObject("army").get("status").getAsString());
    }

    @Test
    void missingArmyIsExplicitlyUnavailableAndRankedIsSeparateFromLegend() {
        var payload = JsonParser.parseString("{\"attacks\":[{"
                + "\"time\":\"2026-08-15T10:00:00Z\",\"stars\":2,"
                + "\"destructionPercentage\":70}]}").getAsJsonObject();

        AttackObservation observation = AdvancedStatsLeagueParser.ranked(
                payload, "1755000000", "#P0Y8LQ", NOW).observations().getFirst();
        var summary = AdvancedStatsLeagueParser.aggregate(java.util.List.of(observation));

        assertEquals("UNAVAILABLE", summary.getAsJsonObject("army").get("status").getAsString());
        assertTrue(observation.attack());
        assertEquals("RANKED", observation.scope().name());
    }

    @Test
    void rowsMarkedAsDefenseAreExcludedFromOffensiveAggregates() {
        var payload = JsonParser.parseString("{\"attacks\":[{"
                + "\"time\":\"2026-08-15T10:00:00Z\",\"attack\":false,"
                + "\"stars\":3,\"destructionPercentage\":100}]}").getAsJsonObject();

        var parsed = AdvancedStatsLeagueParser.legend(
                payload, "1755000000", "2026-08-15", "#P0Y8LQ", NOW);

        assertTrue(parsed.observations().isEmpty());
        assertEquals(1, parsed.coverage().invalidRows());
    }
}

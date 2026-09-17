package Java.advancedstats;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdvancedStatsLeagueReaderTest {
    private static final Instant NOW = Instant.parse("2026-08-15T12:00:00Z");

    @Test
    void currentSeasonUsesLatestLeagueHistoryIdAndKeepsModesSeparate() throws Exception {
        FakeFetcher fetcher = new FakeFetcher();
        fetcher.history = object("{\"items\":["
                + "{\"mode\":\"ranked\",\"seasonId\":\"1755000000\"},"
                + "{\"mode\":\"ranked\",\"seasonId\":\"1754000000\"}]}");
        fetcher.ranked = object("{\"battlelogs\":[{"
                + "\"battle_id\":\"r1\",\"timestamp\":\"2026-08-15T10:00:00Z\","
                + "\"attack\":true,\"stars\":3,\"destructionPercentage\":100}]}");
        fetcher.legend = object("{\"attacks\":[{"
                + "\"time\":\"2026-08-15T11:00:00Z\",\"stars\":2,"
                + "\"destructionPercentage\":80}]}");
        fetcher.legendHistory = object("{\"items\":[{\"season\":\"2026-07\","
                + "\"rank\":123,\"trophies\":5200}]}");
        fetcher.dates = object("{\"legend\":\"2026-08-15\"}");

        var reader = new AdvancedStatsLeagueReader(fetcher,
                Clock.fixed(NOW, ZoneOffset.UTC));
        JsonObject result = reader.read("#P0Y8LQ", "current-season", null);
        JsonObject modes = result.getAsJsonObject("modes");

        assertEquals("current-season", result.get("period").getAsString());
        assertEquals(1, fetcher.rankedSeasons.size());
        assertEquals("1755000000", fetcher.rankedSeasons.getFirst());
        assertEquals(1, modes.getAsJsonObject("ranked").getAsJsonArray("seasons").size());
        assertEquals(1, modes.getAsJsonObject("ranked").getAsJsonObject("summary")
                .get("attacks").getAsInt());
        assertEquals(2, modes.getAsJsonObject("legend").getAsJsonObject("summary")
                .get("stars").getAsInt());
        assertEquals("PARTIAL", modes.getAsJsonObject("legend").get("status").getAsString());
        JsonObject selection = modes.getAsJsonObject("ranked").getAsJsonObject("selection");
        assertEquals("latest_observed_player_history", selection.get("basis").getAsString());
        assertTrue(!selection.get("verifiedCurrent").getAsBoolean());
        assertEquals("PARTIAL", selection.get("status").getAsString());
        assertEquals("UNAVAILABLE", modes.getAsJsonObject("legend")
                .getAsJsonObject("unavailable").get("netTrophyChange").getAsString());
        assertEquals(1, modes.getAsJsonObject("legend").getAsJsonArray("seasons").size());
    }

    @Test
    void allPeriodIsFilteredAndRankedCallsAreBounded() throws Exception {
        FakeFetcher fetcher = new FakeFetcher();
        StringBuilder history = new StringBuilder("{\"items\":[");
        for (int i = 0; i < 20; i++) {
            if (i > 0) history.append(',');
            history.append("{\"mode\":\"ranked\",\"seasonId\":\"")
                    .append(1755000000L - i).append("\"}");
        }
        history.append("]}");
        fetcher.history = object(history.toString());
        fetcher.dates = object("{\"legend\":\"2026-08-15\"}");
        fetcher.legend = object("{\"attacks\":[]}");
        fetcher.legendHistory = object("{\"items\":[]}");

        JsonObject result = new AdvancedStatsLeagueReader(fetcher,
                Clock.fixed(NOW, ZoneOffset.UTC)).read("#P0Y8LQ", AdvancedStatsPeriod.ALL, null);

        assertEquals(AdvancedStatsLeagueReader.MAX_RANKED_SEASONS, fetcher.rankedSeasons.size());
        assertEquals("PARTIAL", result.get("status").getAsString());
    }

    private static JsonObject object(String json) {
        return JsonParser.parseString(json).getAsJsonObject();
    }

    private static final class FakeFetcher implements AdvancedStatsLeagueSource.Fetcher {
        private JsonObject history = object("{\"items\":[]}");
        private JsonObject ranked = object("{\"battlelogs\":[]}");
        private JsonObject dates = object("{}");
        private JsonObject legend = object("{\"attacks\":[]}");
        private JsonElement legendHistory = object("{\"items\":[]}");
        private final List<String> rankedSeasons = new ArrayList<>();

        @Override
        public JsonObject leagueHistory(String playerTag, Instant after, Instant before) {
            return history;
        }

        @Override
        public JsonObject ranked(String playerTag, String seasonId) {
            rankedSeasons.add(seasonId);
            return ranked;
        }

        @Override
        public JsonObject currentDates() {
            return dates;
        }

        @Override
        public JsonObject legend(String playerTag, String day) {
            return legend;
        }

        @Override
        public JsonElement legendHistory(String playerTag) {
            return legendHistory;
        }
    }
}

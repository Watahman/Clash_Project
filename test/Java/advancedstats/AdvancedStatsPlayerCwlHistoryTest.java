package Java.advancedstats;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdvancedStatsPlayerCwlHistoryTest {
    private static final Instant NOW = Instant.parse("2026-09-16T12:00:00Z");

    @Test
    void readsPlayerSeasonLeagueClanPositionAndCompleteWarMisses() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        AdvancedStatsPlayerCwlHistory source = new AdvancedStatsPlayerCwlHistory(path -> {
            assertEquals("/v2/player/%23P0L/cwl/history?limit=24", path);
            calls.incrementAndGet();
            return fixture();
        });

        var first = source.seasons("#P0L", 100).getFirst();
        source.seasons("#P0L", 100);

        assertEquals(1, calls.get());
        assertEquals("2026-09", first.season());
        assertEquals("Master League II", first.league());
        assertEquals(2, first.position());
        assertEquals("clashking_player_cwl_history", first.seasonBasis());
        assertEquals(2, first.metrics().attackCount());
        assertEquals(3, first.metrics().availableAttacks());
        assertEquals(2, first.metrics().usedAttacks());
        assertEquals(1, first.metrics().missedAttacks());
        assertEquals(2.5, first.metrics().avgStars());
        assertEquals(2, first.rounds().size());
        assertNull(first.metrics().defensivePerformance());
    }

    @Test
    void malformedResponseIsNotCachedAsEmptyHistory() {
        AtomicInteger calls = new AtomicInteger();
        AdvancedStatsPlayerCwlHistory source = new AdvancedStatsPlayerCwlHistory(path -> {
            calls.incrementAndGet();
            return new JsonObject();
        });

        assertThrows(IllegalArgumentException.class, () -> source.seasons("#P0L", 24));
        assertThrows(IllegalArgumentException.class, () -> source.seasons("#P0L", 24));
        assertEquals(2, calls.get());
    }

    @Test
    void servesPlayerCwlWithoutAssumingTheirCurrentClan() throws Exception {
        AdvancedStatsPlayerCwlHistory source = new AdvancedStatsPlayerCwlHistory(path -> fixture());
        AdvancedStatsWarCwlProvider provider = new AdvancedStatsWarCwlProvider() {
            @Override public Java.performance.HistoricalPlayerData playerHistory(String tag) {
                return new Java.performance.HistoricalPlayerData(tag, List.of(), List.of(), "v2", true);
            }
            @Override public List<AdvancedStatsWarCwlSeasonReader.SeasonData> playerCwlSeasons(
                    String tag, int limit) throws Exception { return source.seasons(tag, limit); }
            @Override public String sourceName() { return "ClashKing V2"; }
        };
        AdvancedStatsWarCwlService service = new AdvancedStatsWarCwlService(
                provider, Clock.fixed(NOW, ZoneOffset.UTC));

        JsonObject data = service.read("#P0L", AdvancedStatsPeriod.ALL, null);
        JsonObject season = data.getAsJsonObject("cwl").getAsJsonArray("seasons")
                .get(0).getAsJsonObject();

        assertEquals("ClashKing V2", data.getAsJsonObject("coverage").get("source").getAsString());
        assertEquals("Master League II", season.get("league").getAsString());
        assertEquals("Old Clan", season.get("clanName").getAsString());
        assertEquals(2, season.get("position").getAsInt());
        assertEquals(1, season.get("missedAttacks").getAsInt());
        assertTrue(data.get("status").getAsString().equals("partial"));
        assertEquals(0, service.read("#P0L", AdvancedStatsPeriod.SEVEN_DAYS,
                Instant.parse("2026-09-09T12:00:00Z"))
                .getAsJsonObject("cwl").getAsJsonArray("seasons").size());
    }

    private static JsonObject fixture() {
        return JsonParser.parseString("""
                {"items":[{"season":"2026-09","townHallLevel":17,
                "clan":{"tag":"#OLD","name":"Old Clan","warLeague":{"id":18,"name":"Master League II"},
                "placement":{"group":2,"global":42}},
                "placement":{"clan":5,"group":18},"missedAttacks":1,
                "attacks":[
                  {"warTag":"#WAR1","round":1,"defender":{"townHallLevel":17},"stars":3,"destructionPercentage":100,"order":1},
                  {"warTag":"#WAR2","round":2,"defender":{"townHallLevel":18},"stars":2,"destructionPercentage":80,"order":1}
                ]}]}
                """).getAsJsonObject();
    }
}

package Java.advancedstats;

import Java.cwlhistory.HistoricalCwlSeason;
import Java.cwlhistory.HistoricalCwlSeasonSummary;
import Java.performance.HistoricalAttack;
import Java.performance.HistoricalParticipation;
import Java.performance.HistoricalPlayerData;
import Java.performance.HistoricalWarType;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdvancedStatsWarCwlServiceTest {
    private static final Instant NOW = Instant.parse("2026-09-16T12:00:00Z");

    @Test
    void aggregatesRegularAttacksAndReliableParticipation() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        AdvancedStatsWarCwlProvider provider = provider(calls, regularHistory(), List.of(), Map.of());
        AdvancedStatsWarCwlService service = service(provider);

        JsonObject result = service.read("#P0L", AdvancedStatsPeriod.ALL, null);
        JsonObject regular = result.getAsJsonObject("regular");

        assertEquals("ready", regular.get("status").getAsString());
        assertEquals(2, regular.get("warCount").getAsInt());
        assertEquals(3, regular.get("availableAttacks").getAsInt());
        assertEquals(2, regular.get("usedAttacks").getAsInt());
        assertEquals(1, regular.get("missedAttacks").getAsInt());
        assertEquals(3, regular.get("attackCount").getAsInt());
        assertEquals(4, regular.get("totalStars").getAsInt());
        assertEquals(1, regular.getAsJsonObject("starBuckets").get("zero").getAsInt());
        assertEquals(1, regular.getAsJsonObject("starBuckets").get("one").getAsInt());
        assertEquals(1, regular.getAsJsonObject("starBuckets").get("three").getAsInt());
        assertEquals(1, regular.getAsJsonObject("matchups").get("same").getAsInt());
        assertEquals(1, regular.getAsJsonObject("matchups").get("up").getAsInt());
        assertEquals(1, regular.getAsJsonObject("matchups").get("down").getAsInt());
        assertEquals(1, calls.get());
    }

    @Test
    void reusesBoundedPlayerHistoryCache() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        AdvancedStatsWarCwlService service = service(
                provider(calls, regularHistory(), List.of(), Map.of())
        );

        service.read("#P0L", AdvancedStatsPeriod.THIRTY_DAYS, NOW.minusSeconds(30 * 86_400L));
        service.read("#P0L", AdvancedStatsPeriod.THIRTY_DAYS, NOW.minusSeconds(30 * 86_400L));

        assertEquals(1, calls.get());
    }

    @Test
    void readsCwlLeaguePositionAndRoundMetricsFromCompleteSeasonDetails() throws Exception {
        HistoricalCwlSeasonSummary summary = summary("2026-09");
        HistoricalCwlSeason detail = cwlSeason("2026-09");
        AdvancedStatsWarCwlProvider provider = provider(
                new AtomicInteger(), regularHistory(), List.of(summary), Map.of("2026-09", detail)
        );

        JsonObject cwl = service(provider).read(
                "#P0L", "#PQL", AdvancedStatsPeriod.ALL, null
        ).getAsJsonObject("cwl");
        JsonObject season = cwl.getAsJsonArray("seasons").get(0).getAsJsonObject();

        assertEquals("partial", cwl.get("status").getAsString());
        assertEquals("2026-09", season.get("season").getAsString());
        assertEquals("Master League II", season.get("league").getAsString());
        assertEquals(2, season.get("position").getAsInt());
        assertEquals(2, season.get("attackCount").getAsInt());
        assertEquals(2, season.get("availableAttacks").getAsInt());
        assertEquals(2, season.get("usedAttacks").getAsInt());
        assertEquals(0, season.get("missedAttacks").getAsInt());
        assertEquals(1, season.getAsJsonArray("rounds").size());
        assertEquals(2, season.getAsJsonArray("rounds").get(0)
                .getAsJsonObject().get("attackCount").getAsInt());
    }

    @Test
    void leavesCwlMetadataUnknownWithoutVerifiedClanTag() throws Exception {
        JsonObject cwl = service(provider(
                new AtomicInteger(), regularHistory(), List.of(), Map.of()
        )).read("#P0L", AdvancedStatsPeriod.ALL, null).getAsJsonObject("cwl");

        assertEquals("unavailable", cwl.get("status").getAsString());
        assertTrue(cwl.getAsJsonArray("unknown").contains(
                new com.google.gson.JsonPrimitive("cwl_league_position_unavailable")
        ));
        assertEquals(0, cwl.getAsJsonArray("seasons").size());
    }

    @Test
    void keepsObservedCwlMonthAsPartialWhenClanMetadataIsUnavailable() throws Exception {
        HistoricalAttack attack = new HistoricalAttack(
                "#P0L", HistoricalWarType.CWL, NOW.minusSeconds(2 * 86_400L),
                17, 17, 3, 100, 1, "cwl-1"
        );
        HistoricalPlayerData history = new HistoricalPlayerData(
                "#P0L", List.of(attack), List.of(), "test", true
        );

        JsonObject cwl = service(provider(
                new AtomicInteger(), history, List.of(), Map.of()
        )).read("#P0L", AdvancedStatsPeriod.ALL, null).getAsJsonObject("cwl");

        assertEquals("partial", cwl.get("status").getAsString());
        JsonObject season = cwl.getAsJsonArray("seasons").get(0).getAsJsonObject();
        assertEquals("observed_month", season.get("seasonBasis").getAsString());
        assertEquals(1, season.get("attackCount").getAsInt());
    }

    @Test
    void hidesSourceFailureBehindStableErrorState() throws Exception {
        AdvancedStatsWarCwlProvider provider = new AdvancedStatsWarCwlProvider() {
            @Override
            public HistoricalPlayerData playerHistory(String playerTag) throws Exception {
                throw new IllegalStateException("upstream detail must not escape");
            }

            @Override
            public String sourceName() {
                return "test";
            }
        };

        JsonObject result = service(provider).read("#P0L", AdvancedStatsPeriod.ALL, null);

        assertEquals("error", result.get("status").getAsString());
        assertEquals("error", result.getAsJsonObject("regular").get("status").getAsString());
        assertFalse(result.toString().contains("upstream detail"));
    }

    @Test
    void treatsExplicitUnavailableSourceAsUnavailableInsteadOfNoData() throws Exception {
        AdvancedStatsWarCwlProvider provider = provider(
                new AtomicInteger(),
                new HistoricalPlayerData("#P0L", List.of(), List.of(), "test", false),
                List.of(), Map.of()
        );

        JsonObject result = service(provider).read("#P0L", AdvancedStatsPeriod.ALL, null);

        assertEquals("error", result.get("status").getAsString());
        assertEquals("error", result.getAsJsonObject("regular").get("status").getAsString());
        assertTrue(result.getAsJsonArray("unknown").contains(
                new com.google.gson.JsonPrimitive("player_history_unavailable")
        ));
    }

    @Test
    void doesNotCacheUnavailablePlayerHistory() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        AdvancedStatsWarCwlProvider provider = provider(
                calls,
                new HistoricalPlayerData("#P0L", List.of(), List.of(), "test", false),
                List.of(), Map.of()
        );
        AdvancedStatsWarCwlService service = service(provider);

        service.read("#P0L", AdvancedStatsPeriod.ALL, null);
        service.read("#P0L", AdvancedStatsPeriod.ALL, null);

        assertEquals(2, calls.get());
    }

    private static AdvancedStatsWarCwlService service(AdvancedStatsWarCwlProvider provider) {
        return new AdvancedStatsWarCwlService(provider, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private static AdvancedStatsWarCwlProvider provider(
            AtomicInteger calls,
            HistoricalPlayerData history,
            List<HistoricalCwlSeasonSummary> summaries,
            Map<String, HistoricalCwlSeason> details
    ) {
        return new AdvancedStatsWarCwlProvider() {
            @Override
            public HistoricalPlayerData playerHistory(String playerTag) {
                calls.incrementAndGet();
                return history;
            }

            @Override
            public List<HistoricalCwlSeasonSummary> cwlSeasons(String clanTag, int limit) {
                return summaries;
            }

            @Override
            public HistoricalCwlSeason cwlSeason(String clanTag, String season) {
                return details.get(season);
            }

            @Override
            public String sourceName() {
                return "test";
            }
        };
    }

    private static HistoricalPlayerData regularHistory() {
        List<HistoricalAttack> attacks = List.of(
                attack("r1", 3, 100, 17, 17, 2),
                attack("r1", 0, 25, 17, 18, 3),
                attack("r2", 1, 60, 18, 17, 4)
        );
        List<HistoricalParticipation> participation = List.of(
                new HistoricalParticipation("#P0L", HistoricalWarType.REGULAR,
                        NOW.minusSeconds(2 * 86_400L), 2, 1, "r1", true),
                new HistoricalParticipation("#P0L", HistoricalWarType.REGULAR,
                        NOW.minusSeconds(4 * 86_400L), 1, 1, "r2", true)
        );
        return new HistoricalPlayerData("#P0L", attacks, participation, "test", true);
    }

    private static HistoricalAttack attack(
            String warId, int stars, double destruction, int attacker, int defender, int daysAgo
    ) {
        return new HistoricalAttack("#P0L", HistoricalWarType.REGULAR,
                NOW.minusSeconds(daysAgo * 86_400L), attacker, defender,
                stars, destruction, null, warId);
    }

    private static HistoricalCwlSeasonSummary summary(String season) {
        return new HistoricalCwlSeasonSummary(
                season, new HistoricalCwlSeason.League(18, "Master League II"),
                2, 5, 1, 0, 15, 98.4, "completed", "test", "Complete"
        );
    }

    private static HistoricalCwlSeason cwlSeason(String season) {
        HistoricalCwlSeason.Member member = new HistoricalCwlSeason.Member(
                "#P0L", "Player", 17, List.of(
                        new HistoricalCwlSeason.Attack("#P0L", "#E1", 17, 17, 3, 100, 1),
                        new HistoricalCwlSeason.Attack("#P0L", "#E2", 17, 18, 2, 80, 2)
                )
        );
        HistoricalCwlSeason.WarSide clan = new HistoricalCwlSeason.WarSide(
                "#PQL", "Clan", 5, 98, 2, List.of(member)
        );
        HistoricalCwlSeason.WarSide opponent = new HistoricalCwlSeason.WarSide(
                "#PQR", "Enemy", 4, 90, 2, List.of()
        );
        HistoricalCwlSeason.War war = new HistoricalCwlSeason.War(
                1, "#WAR", "completed", "win", 1, 2, clan, opponent, true
        );
        return new HistoricalCwlSeason(
                season, new HistoricalCwlSeason.Clan("#PQL", "Clan"),
                new HistoricalCwlSeason.League(18, "Master League II"), 2,
                new HistoricalCwlSeason.Record(5, 1, 0), List.of(), List.of(war),
                List.of(new HistoricalCwlSeason.Player("#P0L", "Player", 17)),
                "completed", "test", "Complete", true
        );
    }
}

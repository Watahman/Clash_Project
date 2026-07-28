package Java.cwlhistory;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class CwlHistoryNormalizerTest {
    @Test
    void v2NormalizesGroupWarsRosterAndReliableDefense() {
        JsonObject group = JsonParser.parseString("""
                {
                  "season":"2026-06",
                  "state":"ended",
                  "clans":[{
                    "tag":"#PQL","name":"ClashPanel",
                    "warLeague":{"id":48000014,"name":"Master League II"},
                    "members":[{"tag":"#P0L","name":"Alex","townHallLevel":17}]
                  }],
                  "clan_rankings":[
                    {"tag":"#PQL","name":"ClashPanel","stars":35,"destruction":95,
                     "rounds":{"won":1,"lost":0,"tied":0}},
                    {"tag":"#P2Y","name":"Opponent","stars":31,"destruction":91,
                     "rounds":{"won":0,"lost":1,"tied":0}}
                  ]
                }
                """).getAsJsonObject();
        JsonObject wars = JsonParser.parseString("""
                {"items":[{
                  "tag":"#WAR","state":"warEnded","endTime":"2026-06-08T12:00:00Z",
                  "teamSize":1,"attacksPerMember":1,
                  "clan":{"tag":"#PQL","name":"ClashPanel","stars":3,
                    "destructionPercentage":100,"attacks":1,
                    "members":[{"tag":"#P0L","name":"Alex","townhallLevel":17,
                      "attacks":[{"attackerTag":"#P0L","defenderTag":"#P2Y",
                        "stars":3,"destructionPercentage":100,"order":1}]}]},
                  "opponent":{"tag":"#ENEMY","name":"Opponent","stars":2,
                    "destructionPercentage":88,"attacks":1,
                    "members":[{"tag":"#P2Y","name":"Luna","townhallLevel":17,
                      "attacks":[{"attackerTag":"#P2Y","defenderTag":"#P0L",
                        "stars":2,"destructionPercentage":88,"order":1}]}]}
                }]}
                """).getAsJsonObject();

        HistoricalCwlSeason season = CwlHistoryNormalizer.normalizeSeason(
                "#PQL", "2026-06", group, wars, "v2"
        );

        assertEquals("Master League II", season.league().name());
        assertEquals(1, season.position());
        assertEquals(1, season.record().wins());
        assertEquals(2, season.standings().size());
        assertEquals(1, season.wars().size());
        assertTrue(season.wars().getFirst().detailsComplete());
        assertEquals(3, season.wars().getFirst().clan()
                .members().getFirst().attacks().getFirst().stars());
        assertEquals(2, season.wars().getFirst().opponent()
                .members().getFirst().attacks().getFirst().stars());
        assertEquals("Complete", season.dataQuality());
    }

    @Test
    void legacySeasonIndexUsesLeagueChangesWithoutInventingPlacements() {
        JsonObject response = JsonParser.parseString("""
                {"changes":{"clanWarLeague":{
                  "2026-05":{"league":"Master League II"},
                  "2026-06":{"league":"Master League I"}
                }}}
                """).getAsJsonObject();

        List<HistoricalCwlSeasonSummary> seasons =
                CwlHistoryIndexNormalizer.normalizeLegacy(
                        response, 12, "legacy"
                );

        assertEquals(List.of("2026-06", "2026-05"),
                seasons.stream().map(HistoricalCwlSeasonSummary::season).toList());
        assertNull(seasons.getFirst().position());
        assertEquals("Partial history", seasons.getFirst().dataQuality());
    }

    @Test
    void currentApiNormalizesWarsNestedUnderRounds() {
        JsonObject group = JsonParser.parseString("""
                {
                  "state":"ended",
                  "season":"2026-06",
                  "clans":[
                    {"tag":"#PQL","name":"ClashPanel",
                     "members":[{"tag":"#P0L","name":"Alex","townHallLevel":17}]},
                    {"tag":"#P2Y","name":"Opponent","members":[]}
                  ],
                  "rounds":[{"warTags":[{
                    "tag":"#WAR","state":"warEnded","endTime":"20260608T120000.000Z",
                    "teamSize":1,"attacksPerMember":1,
                    "clan":{"tag":"#PQL","name":"ClashPanel","stars":3,
                      "destructionPercentage":100,"attacks":1,
                      "members":[{"tag":"#P0L","name":"Alex","townhallLevel":17,
                        "attacks":[{"attackerTag":"#P0L","defenderTag":"#E1",
                          "stars":3,"destructionPercentage":100,"order":1}]}]},
                    "opponent":{"tag":"#P2Y","name":"Opponent","stars":2,
                      "destructionPercentage":88,"attacks":1,
                      "members":[{"tag":"#E1","name":"Luna","townhallLevel":17,
                        "attacks":[{"attackerTag":"#E1","defenderTag":"#P0L",
                          "stars":2,"destructionPercentage":88,"order":1}]}]}
                  }]}]
                }
                """).getAsJsonObject();

        HistoricalCwlSeason season = CwlHistoryNormalizer.normalizeSeason(
                "#PQL", "2026-06", group, null, "api"
        );

        assertEquals(1, season.wars().size());
        assertEquals("#WAR", season.wars().getFirst().id());
        assertEquals("win", season.wars().getFirst().result());
        assertTrue(season.wars().getFirst().detailsComplete());
    }
}

package Java.cwlhistory;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class CwlHistoryNormalizerTest {
    @Test
    void v2NormalizesGroupWarsRosterAndReliableDefense() {
        JsonObject group = JsonParser.parseString("""
                {
                  "season":"2026-06",
                  "state":"ended",
                  "warLeague":{"id":48000014,"name":"Master League II"},
                  "clans":[{
                    "tag":"#PQL","name":"ClashPanel",
                    "members":[{"tag":"#P0L","name":"Alex","townHallLevel":17}]
                  },{
                    "tag":"#ENEMY","name":"Opponent",
                    "members":[{"tag":"#P2Y","name":"Luna","townHallLevel":17}]
                  }]
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
    void currentLeagueIdsIncludeTitanAndLegendCwlTiers() {
        assertEquals("Titan League III",
                CwlHistoryIndexNormalizer.leagueName(48_000_019));
        assertEquals("Titan League II",
                CwlHistoryIndexNormalizer.leagueName(48_000_020));
        assertEquals("Titan League I",
                CwlHistoryIndexNormalizer.leagueName(48_000_021));
        assertEquals("Legend League",
                CwlHistoryIndexNormalizer.leagueName(48_000_022));
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
        assertEquals(1, season.position());
        assertEquals(2, season.standings().size());
        assertEquals(13, season.standings().getFirst().stars());
        assertEquals(1, season.record().wins());
    }

    @Test
    void v2StandingsPreferTheCompleteGroupOverSelectedClanWars() {
        JsonObject group = JsonParser.parseString("""
                {"clans":[
                  {"tag":"#A","name":"Alpha"},{"tag":"#B","name":"Beta"},
                  {"tag":"#C","name":"Gamma"}
                ],"rounds":[{"warTags":[
                  {"tag":"#W1","state":"warEnded",
                   "clan":{"tag":"#A","stars":3,"destructionPercentage":100},
                   "opponent":{"tag":"#B","stars":2,"destructionPercentage":90}},
                  {"tag":"#W2","state":"warEnded",
                   "clan":{"tag":"#B","stars":3,"destructionPercentage":95},
                   "opponent":{"tag":"#C","stars":1,"destructionPercentage":80}}
                ]}]}
                """).getAsJsonObject();
        JsonObject selectedClanWars = JsonParser.parseString("""
                {"items":[{"tag":"#W1","state":"warEnded",
                  "clan":{"tag":"#A","stars":3},
                  "opponent":{"tag":"#B","stars":2}}]}
                """).getAsJsonObject();

        var standings = CwlHistoryStandingsNormalizer.normalize(
                group, selectedClanWars
        );
        HistoricalCwlSeason.Standing beta = standings.stream()
                .filter(row -> "#B".equals(row.tag()))
                .findFirst()
                .orElseThrow();

        assertEquals(1, beta.wins());
        assertEquals(1, beta.losses());
        assertEquals(3, standings.size());
    }
}

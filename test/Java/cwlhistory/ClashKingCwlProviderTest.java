package Java.cwlhistory;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ClashKingCwlProviderTest {
    private HttpServer server;
    private Map<String, Response> responses;
    private List<String> requests;
    private ClashKingLegacyCwlProvider provider;

    @BeforeEach
    void startServer() throws IOException {
        responses = new ConcurrentHashMap<>();
        requests = new CopyOnWriteArrayList<>();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", this::handle);
        server.start();
        provider = new ClashKingLegacyCwlProvider(
                "http://127.0.0.1:" + server.getAddress().getPort()
        );
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @Test
    void buildsADeepSeasonIndexWithoutPrefetchingCwlDetails()
            throws Exception {
        respond(
                "/clan/%23PQL/basic",
                200,
                """
                {"warLeague":"Champion League III",
                 "changes":{"clanWarLeague":{
                  "2026-07":"Champion League II"
                }}}
                """
        );
        respond(
                "/list/seasons?last=48",
                200,
                """
                ["2026-08","2026-07","2026-06",
                 "2026-05","2026-04","2026-03"]
                """
        );

        List<HistoricalCwlSeasonSummary> seasons =
                provider.getAvailableSeasons("#PQL", 3);

        assertEquals(
                List.of("2026-08", "2026-07", "2026-06"),
                seasons.stream()
                        .map(HistoricalCwlSeasonSummary::season)
                        .toList()
        );
        assertEquals("Champion League II", seasons.get(1).league().name());
        assertEquals(
                List.of(
                        "/clan/%23PQL/basic",
                        "/list/seasons?last=48"
                ),
                requests
        );
    }

    @Test
    void expandsAClashKingSeasonPageAcrossTheFortyEightMonthWindow()
            throws Exception {
        respond(
                "/clan/%23PQL/basic",
                200,
                "{\"changes\":{\"clanWarLeague\":{}}}"
        );
        respond(
                "/list/seasons?last=48",
                200,
                """
                ["2026-08","2026-07","2026-06","2026-05",
                 "2026-04","2026-03","2026-02","2026-01"]
                """
        );

        List<HistoricalCwlSeasonSummary> seasons =
                provider.getAvailableSeasons("#PQL", 12);

        assertEquals(12, seasons.size());
        assertEquals("2026-08", seasons.getFirst().season());
        assertEquals("2025-09", seasons.getLast().season());
        assertEquals(
                List.of(
                        "/clan/%23PQL/basic",
                        "/list/seasons?last=48"
                ),
                requests
        );
    }

    @Test
    void overviewRestoresLeagueCountBackAfterDeepIndexDiscovery()
            throws Exception {
        respond(
                "/clan/%23PQL/basic",
                200,
                """
                {"warLeague":"Champion League III",
                 "changes":{"clanWarLeague":{}}}
                """
        );
        respond(
                "/list/seasons?last=48",
                200,
                "[\"2026-06\",\"2026-05\",\"2026-03\"]"
        );
        respond(
                "/cwl/%23PQL/2026-06",
                200,
                rankedSeason("2026-06", "ended", 3)
        );
        respond(
                "/cwl/%23PQL/2026-05",
                200,
                rankedSeason("2026-05", "ended", 7)
        );
        respond(
                "/cwl/%23PQL/2026-03",
                200,
                rankedSeason("2026-03", "ended", 1)
        );

        List<HistoricalCwlSeason> seasons =
                new HistoricalCwlService(provider).getOverview("#PQL", 3);

        assertEquals(
                List.of("2026-06", "2026-05", "2026-03"),
                seasons.stream().map(HistoricalCwlSeason::season).toList()
        );
        assertEquals(
                List.of(
                        "Champion League III",
                        "Champion League II",
                        "Champion League III"
                ),
                seasons.stream()
                        .map(item -> item.league().name())
                        .toList()
        );
        assertEquals(1, requests.stream()
                .filter("/clan/%23PQL/basic"::equals)
                .count());
    }

    @Test
    void usesTheDocumentedCwlSeasonEndpointAndEncoding() throws Exception {
        respond(
                "/cwl/%23PQL/2026-06",
                200,
                season("2026-06", "ended")
        );

        provider.getSeason("#PQL", "2026-06");

        assertEquals(
                List.of("/cwl/%23PQL/2026-06"),
                requests
        );
    }

    @Test
    void rejectsAClashKingResponseForADifferentSeason() {
        respond(
                "/cwl/%23PQL/2025-06",
                200,
                season("2026-06", "ended")
        );

        Java.HttpException error = assertThrows(
                Java.HttpException.class,
                () -> provider.getSeason("#PQL", "2025-06")
        );

        assertEquals(502, error.getStatusCode());
    }

    @Test
    void stillReturnsSeasonCandidatesWhenBasicClanHistoryIsMissing()
            throws Exception {
        respond(
                "/clan/%23PQL/basic",
                404,
                "{\"detail\":\"Not Found\"}"
        );
        respond(
                "/list/seasons?last=48",
                200,
                "[\"2026-06\"]"
        );

        List<HistoricalCwlSeasonSummary> seasons =
                provider.getAvailableSeasons("#PQL", 8);

        assertEquals(8, seasons.size());
        assertEquals("2026-06", seasons.getFirst().season());
        assertEquals("2025-11", seasons.getLast().season());
        assertEquals(
                List.of(
                        "/clan/%23PQL/basic",
                        "/list/seasons?last=48"
                ),
                requests
        );
    }

    @Test
    void acceptsJsonNullForTheOptionalBasicClanHistory() throws Exception {
        respond("/clan/%23PQL/basic", 200, "null");
        respond("/list/seasons?last=48", 200, "[\"2026-06\"]");

        List<HistoricalCwlSeasonSummary> seasons =
                provider.getAvailableSeasons("#PQL", 2);

        assertEquals(List.of("2026-06", "2026-05"), seasons.stream()
                .map(HistoricalCwlSeasonSummary::season)
                .toList());
    }

    @Test
    void doesNotTreatInvalidBasicClanJsonAsMissingHistory() {
        respond("/clan/%23PQL/basic", 200, "[]");

        Java.HttpException error = assertThrows(
                Java.HttpException.class,
                () -> provider.getAvailableSeasons("#PQL", 2)
        );

        assertEquals(502, error.getStatusCode());
    }

    @Test
    void temporarilyCachesMissingSeasonResponses() {
        respond(
                "/cwl/%23PQL/2026-06",
                404,
                "{\"detail\":\"Not Found\"}"
        );

        assertThrows(
                Java.HttpException.class,
                () -> provider.getSeason("#PQL", "2026-06")
        );
        assertThrows(
                Java.HttpException.class,
                () -> provider.getSeason("#PQL", "2026-06")
        );

        assertEquals(1, requests.stream()
                .filter("/cwl/%23PQL/2026-06"::equals)
                .count());
    }

    private void respond(String target, int status, String body) {
        responses.put(target, new Response(status, body));
    }

    private void handle(HttpExchange exchange) throws IOException {
        String query = exchange.getRequestURI().getRawQuery();
        String target = exchange.getRequestURI().getRawPath()
                + (query == null ? "" : "?" + query);
        requests.add(target);
        Response current = responses.getOrDefault(
                target,
                new Response(404, "{\"detail\":\"Not Found\"}")
        );
        byte[] body = current.body().getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(current.status(), body.length);
        exchange.getResponseBody().write(body);
        exchange.close();
    }

    private static String season(String season, String state) {
        return """
               {
                 "season":"%s",
                 "state":"%s",
                 "clans":[{"tag":"#PQL","name":"ClashPanel"}],
                 "rounds":[]
               }
               """.formatted(season, state);
    }

    private static String rankedSeason(
            String season,
            String state,
            int targetRank
    ) {
        StringBuilder standings = new StringBuilder();
        for (int rank = 1; rank <= 8; rank++) {
            if (rank > 1) standings.append(',');
            String tag = rank == targetRank ? "#PQL" : "#CLAN" + rank;
            standings.append("""
                    {"rank":%d,"tag":"%s","name":"Clan %d",
                     "stars":%d,"destruction":%d}
                    """.formatted(
                    rank,
                    tag,
                    rank,
                    100 - rank,
                    100 - rank
            ));
        }
        return """
               {
                 "season":"%s",
                 "state":"%s",
                 "clans":[{"tag":"#PQL","name":"ClashPanel"}],
                 "clan_rankings":[%s],
                 "rounds":[]
               }
               """.formatted(season, state, standings);
    }

    private record Response(int status, String body) {}
}

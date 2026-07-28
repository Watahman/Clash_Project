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
    void doesNotCarryStaleLeagueHistoryIntoNewerSeasons()
            throws Exception {
        respond(
                "/clan/%23PQL/basic",
                200,
                """
                {"changes":{"clanWarLeague":{
                  "2026-05":"Master League II"
                }}}
                """
        );
        respond(
                "/list/seasons?last=24",
                200,
                "[\"2026-08\",\"2026-07\",\"2026-06\",\"2026-05\"]"
        );
        respond("/cwl/%23PQL/2026-08", 404, "{\"detail\":\"Not Found\"}");
        respond(
                "/cwl/%23PQL/2026-07",
                200,
                season("2026-07", "inWar")
        );
        respond(
                "/cwl/%23PQL/2026-06",
                200,
                season("2026-06", "ended")
        );
        respond(
                "/cwl/%23PQL/2026-05",
                200,
                season("2026-05", "ended")
        );

        List<HistoricalCwlSeasonSummary> seasons =
                provider.getAvailableSeasons("#PQL", 2);
        HistoricalCwlSeason cached =
                provider.getSeason("#PQL", "2026-06");

        assertEquals(
                List.of("2026-06", "2026-05"),
                seasons.stream()
                        .map(HistoricalCwlSeasonSummary::season)
                        .toList()
        );
        assertEquals("", seasons.getFirst().league().name());
        assertEquals("Master League II", seasons.get(1).league().name());
        assertEquals("", cached.league().name());
        assertEquals(
                List.of(
                        "/clan/%23PQL/basic",
                        "/list/seasons?last=24",
                        "/cwl/%23PQL/2026-08",
                        "/cwl/%23PQL/2026-07",
                        "/cwl/%23PQL/2026-06",
                        "/cwl/%23PQL/2026-05"
                ),
                requests
        );
    }

    @Test
    void expandsAClashKingSeasonPageWhenOnlyEightMonthsAreReturned()
            throws Exception {
        respond(
                "/clan/%23PQL/basic",
                200,
                "{\"changes\":{\"clanWarLeague\":{}}}"
        );
        respond(
                "/list/seasons?last=24",
                200,
                """
                ["2026-08","2026-07","2026-06","2026-05",
                 "2026-04","2026-03","2026-02","2026-01"]
                """
        );
        for (String season : List.of(
                "2026-08", "2026-07", "2026-06", "2026-05",
                "2026-04", "2026-03", "2026-02", "2026-01"
        )) {
            respond(
                    "/cwl/%23PQL/" + season,
                    404,
                    "{\"detail\":\"Not Found\"}"
            );
        }
        respond(
                "/cwl/%23PQL/2025-12",
                200,
                season("2025-12", "ended")
        );

        List<HistoricalCwlSeasonSummary> seasons =
                provider.getAvailableSeasons("#PQL", 1);

        assertEquals("2025-12", seasons.getFirst().season());
        assertEquals(
                "/cwl/%23PQL/2025-12",
                requests.getLast()
        );
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
    void returnsAnEmptyIndexWhenClashKingHasNoClanHistory()
            throws Exception {
        respond(
                "/clan/%23PQL/basic",
                404,
                "{\"detail\":\"Not Found\"}"
        );
        respond(
                "/list/seasons?last=24",
                200,
                "[\"2026-06\"]"
        );
        respond(
                "/cwl/%23PQL/2026-06",
                404,
                "{\"detail\":\"Not Found\"}"
        );

        List<HistoricalCwlSeasonSummary> seasons =
                provider.getAvailableSeasons("#PQL", 8);

        assertEquals(List.of(), seasons);
        assertEquals("/clan/%23PQL/basic", requests.getFirst());
        assertEquals("/list/seasons?last=24", requests.get(1));
        assertEquals("/cwl/%23PQL/2026-06", requests.get(2));
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

    private record Response(int status, String body) {}
}

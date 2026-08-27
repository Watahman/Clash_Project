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
    private ClashKingV2CwlProvider provider;

    @BeforeEach
    void startServer() throws IOException {
        responses = new ConcurrentHashMap<>();
        requests = new CopyOnWriteArrayList<>();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", this::handle);
        server.start();
        provider = new ClashKingV2CwlProvider(
                "http://127.0.0.1:" + server.getAddress().getPort()
        );
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @Test
    void usesTheV2SeasonIndexAndNormalizesRecordedValues() throws Exception {
        respond("/v2/cwl/%23PQL/seasons?limit=2", 200, """
                {"items":[
                  {"season":"2026-06","state":"ended","rank":2,
                   "stars":321,"destruction":98.5,
                   "warLeague":{"id":48000017,"name":"Champion League II"},
                   "rounds":{"won":5,"lost":1,"tied":1}},
                  {"season":"2026-05","state":"ended","rank":4,
                   "warLeague":{"id":48000016,"name":"Champion League III"},
                   "rounds":{"won":3,"lost":4,"tied":0}}
                ]}
                """);

        List<HistoricalCwlSeasonSummary> seasons =
                provider.getAvailableSeasons("#PQL", 2);

        assertEquals(List.of("2026-06", "2026-05"), seasons.stream()
                .map(HistoricalCwlSeasonSummary::season).toList());
        assertEquals("Champion League II", seasons.getFirst().league().name());
        assertEquals(2, seasons.getFirst().position());
        assertEquals(5, seasons.getFirst().wins());
        assertEquals(List.of("/v2/cwl/%23PQL/seasons?limit=2"), requests);
    }

    @Test
    void usesOnlyV2GroupAndWarRoutesForSeasonDetails() throws Exception {
        respond("/v2/cwl/%23PQL/group?season=2026-06", 200, season("2026-06"));
        respond(
                "/v2/clan/%23PQL/wars?type=cwl"
                        + "&time%5Bafter%5D=2026-06-01T00%3A00%3A00Z"
                        + "&time%5Bbefore%5D=2026-07-01T00%3A00%3A00Z&limit=20",
                200,
                "{\"items\":[]}"
        );

        HistoricalCwlSeason result = provider.getSeason("#PQL", "2026-06");

        assertEquals("2026-06", result.season());
        assertEquals("Champion League II", result.league().name());
        assertEquals(List.of(
                "/v2/cwl/%23PQL/group?season=2026-06",
                "/v2/clan/%23PQL/wars?type=cwl"
                        + "&time%5Bafter%5D=2026-06-01T00%3A00%3A00Z"
                        + "&time%5Bbefore%5D=2026-07-01T00%3A00%3A00Z&limit=20"
        ), requests);
    }

    @Test
    void rejectsAResponseForADifferentSeason() {
        respond("/v2/cwl/%23PQL/group?season=2025-06", 200, season("2026-06"));

        Java.HttpException error = assertThrows(
                Java.HttpException.class,
                () -> provider.getSeason("#PQL", "2025-06")
        );

        assertEquals(502, error.getStatusCode());
        assertEquals(List.of("/v2/cwl/%23PQL/group?season=2025-06"), requests);
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

    private static String season(String season) {
        return """
               {
                 "season":"%s",
                 "state":"ended",
                 "warLeague":{"id":48000017,"name":"Champion League II"},
                 "clans":[{"tag":"#PQL","name":"ClashPanel","members":[]}],
                 "rounds":[]
               }
               """.formatted(season);
    }

    private record Response(int status, String body) {}
}

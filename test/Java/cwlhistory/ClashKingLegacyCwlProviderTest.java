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

class ClashKingLegacyCwlProviderTest {
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
    void usesTheLegacySeasonEndpointAndEncoding() throws Exception {
        respond("/cwl/%23PQL/2026-06", 200, season("2026-06"));

        HistoricalCwlSeason result = provider.getSeason("#PQL", "2026-06");

        assertEquals("2026-06", result.season());
        assertEquals("Champion League II", result.league().name());
        assertEquals(List.of("/cwl/%23PQL/2026-06"), requests);
    }

    @Test
    void rejectsAResponseForADifferentSeason() {
        respond("/cwl/%23PQL/2025-06", 200, season("2026-06"));

        Java.HttpException error = assertThrows(
                Java.HttpException.class,
                () -> provider.getSeason("#PQL", "2025-06")
        );

        assertEquals(502, error.getStatusCode());
    }

    @Test
    void discoversLegacySeasonsAndPreservesRecordedLeagueChanges() throws Exception {
        respond(
                "/clan/%23PQL/basic",
                200,
                "{\"changes\":{\"clanWarLeague\":{\"2026-05\":\"Champion League I\"}}}"
        );
        respond(
                "/list/seasons?last=48",
                200,
                "[\"2026-06\",\"2026-05\"]"
        );

        List<HistoricalCwlSeasonSummary> seasons =
                provider.getAvailableSeasons("#PQL", 2);

        assertEquals(List.of("2026-06", "2026-05"), seasons.stream()
                .map(HistoricalCwlSeasonSummary::season).toList());
        assertEquals("Champion League I", seasons.get(1).league().name());
        assertEquals(List.of(
                "/clan/%23PQL/basic",
                "/list/seasons?last=48"
        ), requests);
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

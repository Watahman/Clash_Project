package Java;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class ApiValidationTest {
    private HttpServer server;

    @AfterEach
    void stopServer() {
        if (server != null) server.stop(0);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "not-json",
            "[]",
            "{\"playerID\":42}",
            "{\"playerID\":\"#INVALID\"}"
    })
    void malformedPlayerRequestsReturnSafeClientErrors(String body) throws Exception {
        Config config = new Config();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        new API_Player(server, config).getPlayer();
        server.start();

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + server.getAddress().getPort() + config._EXT_PLAYER_INFO))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .build();
        HttpResponse<String> response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());

        assertEquals(400, response.statusCode());
        assertFalse(response.body().contains("Exception"));
        assertFalse(response.body().contains("stack"));
    }
}

package Java;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class ProtectedRoutesTest {
    private HttpServer server;

    @AfterEach
    void stopServer() {
        if (server != null) server.stop(0);
    }

    @Test
    void spoofedPlannerUserIdWithoutSessionIsRejected() throws Exception {
        Config config = new Config();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        new SUPABASE_CWLPlanner(server, config).saveCWLPlanner();
        server.start();

        String body = """
                {
                  "userId":"00000000-0000-0000-0000-000000000001",
                  "name":"spoof",
                  "planInfo":[]
                }
                """;
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + server.getAddress().getPort() + config._EXT_SUPA_CWLPLANNER_DATA_SET))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .build();
        HttpResponse<String> response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());

        assertEquals(401, response.statusCode());
        assertFalse(response.body().contains("00000000-0000-0000-0000-000000000001"));
    }
}

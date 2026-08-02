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

class AuthSessionTest {
    private HttpServer server;

    @AfterEach
    void stopServer() {
        if (server != null) server.stop(0);
    }

    @Test
    void anonymousSessionProbeReturnsNullWithoutAConsolePolluting401() throws Exception {
        Config config = new Config();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        new SUPABASE_Auth(server, config).registerRoutes();
        server.start();

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(
                        "http://127.0.0.1:"
                                + server.getAddress().getPort()
                                + config._AUTH_SESSION
                ))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString("{}", StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> response = HttpClient.newHttpClient().send(
                request,
                HttpResponse.BodyHandlers.ofString()
        );

        assertEquals(200, response.statusCode());
        assertEquals("{\"session\":null}", response.body());
    }
}

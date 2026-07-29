package Java;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ApiProxySecurityTest {
    private HttpServer server;
    private Config config;
    private URI endpoint;

    @BeforeEach
    void startServer() throws Exception {
        config = new Config();
        config._API_PROXY_SECRET = "expected-proxy-secret";
        config._TRUST_PROXY_HEADERS = "true";
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        new API_Player(server, config).getPlayer();
        server.start();
        endpoint = URI.create(
                "http://127.0.0.1:" + server.getAddress().getPort() + config._EXT_PLAYER_INFO
        );
    }

    @AfterEach
    void stopServer() {
        if (server != null) server.stop(0);
    }

    @Test
    void configuredProxySecretRejectsDirectRequests() throws Exception {
        HttpResponse<String> response = send(HttpRequest.newBuilder(endpoint)
                .POST(HttpRequest.BodyPublishers.ofString("{}"))
                .build());

        assertEquals(403, response.statusCode());
        assertTrue(response.body().contains("PROXY_AUTH_REQUIRED"));
    }

    @Test
    void validProxySecretAllowsRequestValidationToContinue() throws Exception {
        HttpResponse<String> response = send(HttpRequest.newBuilder(endpoint)
                .header(API_Utils.API_PROXY_SECRET_HEADER, "expected-proxy-secret")
                .POST(HttpRequest.BodyPublishers.ofString("{}"))
                .build());

        assertEquals(400, response.statusCode());
    }

    @Test
    void methodErrorsAdvertiseTheAllowedMethods() throws Exception {
        HttpResponse<String> response = send(HttpRequest.newBuilder(endpoint)
                .header(API_Utils.API_PROXY_SECRET_HEADER, "expected-proxy-secret")
                .GET()
                .build());

        assertEquals(405, response.statusCode());
        assertEquals("POST, OPTIONS", response.headers().firstValue("Allow").orElse(""));
    }

    private HttpResponse<String> send(HttpRequest request) throws Exception {
        return HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
    }
}

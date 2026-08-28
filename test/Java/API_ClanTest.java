package Java;

import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class API_ClanTest {
    private HttpServer clashServer;
    private HttpServer appServer;

    @AfterEach
    void stopServers() {
        if (appServer != null) appServer.stop(0);
        if (clashServer != null) clashServer.stop(0);
    }

    @Test
    void noActiveLeagueGroupReturnsAnEmptySuccessFromSourceAndCache() throws Exception {
        AtomicInteger upstreamCalls = new AtomicInteger();
        startClashServer(upstreamCalls);
        Config config = testConfig();
        startAppServer(config);

        HttpResponse<String> first = requestLeagueGroup(config);
        HttpResponse<String> cached = requestLeagueGroup(config);

        assertNoActiveCwl(first);
        assertNoActiveCwl(cached);
        assertEquals(1, upstreamCalls.get());
        assertTrue(cached.headers().firstValue("X-ClashTools-Cache")
                .orElse("").startsWith("l1-"));
    }

    @Test
    void explicitLiveRefreshBypassesCachedLeagueGroup() throws Exception {
        AtomicInteger upstreamCalls = new AtomicInteger();
        AtomicBoolean active = new AtomicBoolean(false);
        startChangingClashServer(upstreamCalls, active);
        Config config = testConfig();
        startAppServer(config);

        assertNoActiveCwl(requestLeagueGroup(config, "#PQL20", false));
        active.set(true);
        assertNoActiveCwl(requestLeagueGroup(config, "#PQL20", false));
        HttpResponse<String> refreshed = requestLeagueGroup(config, "#PQL20", true);

        assertEquals(2, upstreamCalls.get());
        assertEquals(200, refreshed.statusCode());
        assertEquals(
                "inWar",
                JsonParser.parseString(refreshed.body()).getAsJsonObject()
                        .get("state").getAsString()
        );
    }

    private void startClashServer(AtomicInteger calls) throws IOException {
        clashServer = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        clashServer.createContext("/clans/", exchange -> {
            calls.incrementAndGet();
            respond(exchange, 404, "{\"reason\":\"notFound\"}");
        });
        clashServer.start();
    }

    private void startChangingClashServer(
            AtomicInteger calls,
            AtomicBoolean active
    ) throws IOException {
        clashServer = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        clashServer.createContext("/clans/", exchange -> {
            calls.incrementAndGet();
            if (active.get()) {
                respond(exchange, 200, "{\"state\":\"inWar\",\"rounds\":[{\"warTags\":[\"#WAR\"]}]}");
                return;
            }
            respond(exchange, 404, "{\"reason\":\"notFound\"}");
        });
        clashServer.start();
    }

    private Config testConfig() {
        Config config = new Config();
        config._BASE_URL_CLASH = "http://127.0.0.1:" + clashServer.getAddress().getPort();
        config._API_KEY_ALL = "test-key";
        config._API_KEY_ALL2 = "";
        config._API_KEY_ALL3 = "";
        config._CLASH_API_KEY_POOL = "";
        config._CACHE_ENABLED = "true";
        config._CACHE_MODE = "memory";
        return config;
    }

    private void startAppServer(Config config) throws IOException {
        appServer = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        new API_Clan(appServer, config).getClanCurrentWarLeagueGroup();
        appServer.start();
    }

    private HttpResponse<String> requestLeagueGroup(Config config) throws Exception {
        return requestLeagueGroup(config, "#PQL2", false);
    }

    private HttpResponse<String> requestLeagueGroup(
            Config config,
            String clanTag,
            boolean forceRefresh
    ) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + appServer.getAddress().getPort()
                        + config._EXT_CLAN_CURRENTWAR_LEAGUEGROUP))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(
                        "{\"clanTag\":\"" + clanTag + "\"}"
                ));
        if (forceRefresh) builder.header("Cache-Control", "no-cache");
        return HttpClient.newHttpClient().send(
                builder.build(),
                HttpResponse.BodyHandlers.ofString()
        );
    }

    private void assertNoActiveCwl(HttpResponse<String> response) {
        assertEquals(200, response.statusCode());
        var json = JsonParser.parseString(response.body()).getAsJsonObject();
        assertTrue(json.get("noActive").getAsBoolean());
        assertEquals("notInWar", json.get("state").getAsString());
        assertTrue(json.getAsJsonArray("rounds").isEmpty());
    }

    private void respond(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }
}

package Java;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpExchange;
import Java.cache.CacheKeys;
import Java.cache.CacheEntry;
import Java.cache.CacheStore;
import Java.cache.InMemoryCacheStore;
import Java.cache.PersistentCacheStore;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class API_Utils {
    private static final CacheStore L1_CACHE = new InMemoryCacheStore();
    private static final CacheStore L2_CACHE = new PersistentCacheStore();
    private static final ConcurrentHashMap<String, CompletableFuture<CacheEntry>> IN_FLIGHT = new ConcurrentHashMap<>();
    private static final RateLimiter RATE_LIMITER = new RateLimiter();
    private static final ExecutorService CACHE_EXECUTOR = Executors.newFixedThreadPool(4, runnable -> {
        Thread thread = new Thread(runnable, "clashtools-cache-refresh");
        thread.setDaemon(true);
        return thread;
    });
    private final Config conf;
    private final AuthService authService;

    public API_Utils(Config conf) {
        this.conf = conf;
        this.authService = new AuthService(conf);
    }

    public void addCORS(HttpExchange exchange) {
        String origin = exchange.getRequestHeaders().getFirst("Origin");
        if (origin != null && conf.isOriginAllowed(origin)) {
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", origin);
            exchange.getResponseHeaders().set("Vary", "Origin");
        }
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization");
        exchange.getResponseHeaders().set("Access-Control-Expose-Headers", "X-ClashTools-Cache, X-ClashTools-Cache-Age");
    }

    private void addSecurityHeaders(HttpExchange exchange) {
        exchange.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
        exchange.getResponseHeaders().set("Referrer-Policy", "no-referrer");
        exchange.getResponseHeaders().set("X-Frame-Options", "DENY");
        exchange.getResponseHeaders().set("Cache-Control", "no-store");
    }

    public String getClashApiResponse(String urlStr) throws Exception {
        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        conn.setRequestProperty("Authorization", conf.getClashApiKey());
        conn.setRequestProperty("Accept", "application/json");
        conn.setConnectTimeout(8_000);
        conn.setReadTimeout(15_000);

        int statusCode = conn.getResponseCode();
        String responseBody = readResponseBody(conn, statusCode);
        if (statusCode < 200 || statusCode >= 300) {
            throw new HttpException(statusCode, responseBody);
        }
        return responseBody;
    }

    public String postClashApiResponse(String urlStr, String jsonBody) throws Exception {
        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Authorization", conf.getClashApiKey());
        conn.setRequestProperty("Accept", "application/json");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);
        conn.setConnectTimeout(8_000);
        conn.setReadTimeout(15_000);

        try (OutputStream os = conn.getOutputStream()) {
            os.write(jsonBody.getBytes(StandardCharsets.UTF_8));
        }

        int statusCode = conn.getResponseCode();
        String responseBody = readResponseBody(conn, statusCode);
        if (statusCode < 200 || statusCode >= 300) {
            throw new HttpException(statusCode, responseBody);
        }
        return responseBody;
    }

    private String readResponseBody(HttpURLConnection conn, int statusCode) throws Exception {
        InputStream stream = (statusCode >= 200 && statusCode < 300) ? conn.getInputStream() : conn.getErrorStream();
        if (stream == null) return "{\"error\":\"HTTP " + statusCode + "\"}";
        return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
    }

    public void sendJsonResponse(HttpExchange exchange, String json, int statusCode) throws Exception {
        addCORS(exchange);
        addSecurityHeaders(exchange);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(statusCode, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    public static String generateCode() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        SecureRandom random = new SecureRandom();
        StringBuilder code = new StringBuilder();
        for (int i = 0; i < 8; i++) {
            code.append(chars.charAt(random.nextInt(chars.length())));
        }
        return code.toString();
    }

    public JsonObject parseBody(HttpExchange exchange) throws Exception {
        int limit = conf.getMaxRequestBodyBytes();
        byte[] bytes = exchange.getRequestBody().readNBytes(limit + 1);
        if (bytes.length > limit) {
            throw new HttpException(413, "{\"error\":\"Request body is te groot\",\"code\":\"BODY_TOO_LARGE\"}");
        }
        String body = new String(bytes, StandardCharsets.UTF_8);
        if (body.isBlank()) throw new IllegalArgumentException("Request body is leeg");
        return JsonParser.parseString(body).getAsJsonObject();
    }

    public String requireAuthenticatedUser(HttpExchange exchange) throws Exception {
        return authService.requireUserId(exchange);
    }

    public String requireString(JsonObject json, String field) throws IllegalArgumentException {
        JsonElement el = json.get(field);
        if (el == null || el.isJsonNull()) throw new IllegalArgumentException("Verplicht veld ontbreekt: " + field);
        return el.getAsString();
    }

    public void handlePost(HttpExchange exchange, PostHandler handler) {
        try {
            addCORS(exchange);
            String origin = exchange.getRequestHeaders().getFirst("Origin");
            if (!conf.isOriginAllowed(origin)) {
                sendJsonResponse(exchange, "{\"error\":\"Origin niet toegestaan\",\"code\":\"ORIGIN_DENIED\"}", 403);
                return;
            }
            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                addSecurityHeaders(exchange);
                exchange.sendResponseHeaders(204, -1);
                return;
            }
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendJsonResponse(exchange, "{\"error\":\"Method not allowed\"}", 405);
                return;
            }

            long start = System.currentTimeMillis();
            String path = exchange.getHttpContext().getPath();
            int rateLimit = conf.getRateLimitForPath(path);
            RateLimiter.Result rate = RATE_LIMITER.check(clientRateLimitKey(exchange, path), rateLimit, start);
            exchange.getResponseHeaders().set("RateLimit-Limit", Integer.toString(rateLimit));
            exchange.getResponseHeaders().set("RateLimit-Remaining", Integer.toString(rate.remaining()));
            if (!rate.allowed()) {
                exchange.getResponseHeaders().set("Retry-After", Integer.toString(rate.retryAfterSeconds()));
                sendJsonResponse(
                        exchange,
                        "{\"error\":\"Te veel aanvragen. Probeer later opnieuw.\",\"code\":\"RATE_LIMITED\"}",
                        429
                );
                return;
            }

            try {
                handler.handle(exchange);
                long duration = System.currentTimeMillis() - start;
                System.out.printf("[%s] %d ms%n", path, duration);
            } catch (IllegalArgumentException e) {
                long duration = System.currentTimeMillis() - start;
                System.out.printf("[%s] %d ms (400)%n", path, duration);
                sendJsonResponse(exchange, "{\"error\":\"" + escapeJson(e.getMessage()) + "\"}", 400);
            } catch (HttpException e) {
                long duration = System.currentTimeMillis() - start;
                System.out.printf("[%s] %d ms (%d)%n", path, duration, e.getStatusCode());
                sendJsonResponse(exchange, e.getResponseBody(), e.getStatusCode());
            } catch (Exception e) {
                long duration = System.currentTimeMillis() - start;
                System.out.printf("[%s] %d ms (500)%n", path, duration);
                e.printStackTrace();
                sendJsonResponse(exchange, "{\"error\":\"Interne serverfout\"}", 500);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public JsonArray requireArray(JsonObject json, String field) throws IllegalArgumentException {
        JsonElement el = json.get(field);
        if (el == null || el.isJsonNull() || !el.isJsonArray()) {
            throw new IllegalArgumentException("Verplicht veld ontbreekt of is geen array: " + field);
        }
        return el.getAsJsonArray();
    }

    public void clashGet(HttpExchange exchange, String path) throws Exception {
        String response = getClashApiResponse(conf.getClashBaseUrl() + path);
        sendJsonResponse(exchange, response, 200);
    }

    public void clashGetCached(HttpExchange exchange, String path, long ttlMs) throws Exception {
        if (!conf.isCacheEnabled() || ttlMs <= 0 || "none".equalsIgnoreCase(conf.getCacheMode())) {
            clashGet(exchange, path);
            return;
        }

        String key = CacheKeys.clashGet(path);
        CacheEntry cached = L1_CACHE.get(key);
        String cacheLayer = "l1";
        if (cached == null && "layered".equalsIgnoreCase(conf.getCacheMode())) {
            cached = L2_CACHE.get(key);
            cacheLayer = "l2";
            if (cached != null) L1_CACHE.put(key, cached);
        }

        if (cached != null && cached.isFresh()) {
            sendCachedResponse(exchange, cached, cacheLayer + "-fresh");
            return;
        }
        if (cached != null && cached.isUsable()) {
            sendCachedResponse(exchange, cached, cacheLayer + "-stale");
            refreshSingleFlight(key, path, ttlMs).exceptionally(error -> null);
            return;
        }

        try {
            CacheEntry refreshed = refreshSingleFlight(key, path, ttlMs).join();
            sendCachedResponse(exchange, refreshed, "source");
        } catch (CompletionException wrapped) {
            Throwable cause = wrapped.getCause();
            if (cause instanceof HttpException httpException) throw httpException;
            if (cause instanceof Exception exception) throw exception;
            throw wrapped;
        }
    }

    private String clientRateLimitKey(HttpExchange exchange, String path) {
        String address = exchange.getRemoteAddress() == null
                ? "unknown"
                : exchange.getRemoteAddress().getAddress().getHostAddress();
        return address + "|" + path;
    }

    private CompletableFuture<CacheEntry> refreshSingleFlight(String key, String path, long ttlMs) {
        return IN_FLIGHT.computeIfAbsent(key, ignored -> CompletableFuture
                .supplyAsync(() -> {
                    try {
                        String response = getClashApiResponse(conf.getClashBaseUrl() + path);
                        CacheEntry entry = CacheEntry.create(response, ttlMs, retentionFor(ttlMs), 200);
                        putAllCacheLayers(key, entry);
                        return entry;
                    } catch (HttpException sourceError) {
                        if (isNegativeCacheable(sourceError.getStatusCode())) {
                            CacheEntry entry = CacheEntry.create(
                                    sourceError.getResponseBody(),
                                    negativeTtl(sourceError.getStatusCode()),
                                    2 * 60 * 1000L,
                                    sourceError.getStatusCode()
                            );
                            putAllCacheLayers(key, entry);
                        }
                        throw new CompletionException(sourceError);
                    } catch (Exception sourceError) {
                        throw new CompletionException(sourceError);
                    }
                }, CACHE_EXECUTOR)
                .whenComplete((result, error) -> IN_FLIGHT.remove(key)));
    }

    private void putAllCacheLayers(String key, CacheEntry entry) {
        L1_CACHE.put(key, entry);
        if ("layered".equalsIgnoreCase(conf.getCacheMode())) L2_CACHE.put(key, entry);
    }

    private void sendCachedResponse(HttpExchange exchange, CacheEntry entry, String cacheState) throws Exception {
        exchange.getResponseHeaders().set("X-ClashTools-Cache", cacheState);
        exchange.getResponseHeaders().set("X-ClashTools-Cache-Age", Long.toString(entry.ageMs() / 1000));
        sendJsonResponse(exchange, entry.value(), entry.sourceStatus());
    }

    private long retentionFor(long ttlMs) {
        long minimum = 10 * 60 * 1000L;
        long maximum = 30L * 24 * 60 * 60 * 1000;
        return Math.min(maximum, Math.max(minimum, ttlMs * 8));
    }

    private boolean isNegativeCacheable(int status) {
        return status == 403 || status == 404 || status == 429;
    }

    private long negativeTtl(int status) {
        return status == 429 ? 10_000L : 30_000L;
    }

    public void clashPost(HttpExchange exchange, String path, String body) throws Exception {
        String response = postClashApiResponse(conf.getClashBaseUrl() + path, body);
        sendJsonResponse(exchange, response, 200);
    }

    public static String escapeJson(String value) {
        if (value == null) return "";
        return value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");
    }

    @FunctionalInterface
    public interface PostHandler {
        void handle(HttpExchange exchange) throws Exception;
    }
}

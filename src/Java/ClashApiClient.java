package Java;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.HashSet;
import java.util.Set;

/** Executes official Clash API requests through the shared credential pool. */
final class ClashApiClient {
    private static final int CONNECT_TIMEOUT_MS = 8_000;
    private static final int READ_TIMEOUT_MS = 15_000;

    private final ClashApiKeyPool keyPool;
    private final long defaultCooldownMillis;
    private final long maximumCooldownMillis;

    ClashApiClient(
            ClashApiKeyPool keyPool,
            long defaultCooldownMillis,
            long maximumCooldownMillis
    ) {
        this.keyPool = keyPool;
        this.defaultCooldownMillis = defaultCooldownMillis;
        this.maximumCooldownMillis = maximumCooldownMillis;
    }

    String get(String url) throws Exception {
        return execute("GET", url, null);
    }

    String post(String url, String jsonBody) throws Exception {
        return execute("POST", url, jsonBody);
    }

    private String execute(String method, String url, String body) throws Exception {
        Set<Integer> attempted = new HashSet<>();
        HttpException lastKeyFailure = null;
        int maximumAttempts = keyPool.size();

        for (int attempt = 0; attempt < maximumAttempts; attempt++) {
            ClashApiKeyPool.Lease lease = acquire(attempted, lastKeyFailure);
            attempted.add(lease.index());
            Response response = send(method, url, body, lease.authorizationValue());
            if (response.isSuccess()) return response.body();

            HttpException failure = HttpException.upstream(
                    response.status(), response.body(), "Clash API"
            );
            if (response.status() == 429) {
                keyPool.markRateLimited(lease, cooldownMillis(response.retryAfter()));
                lastKeyFailure = failure;
                continue;
            }
            if (response.status() == 401 || response.status() == 403) {
                keyPool.markInvalid(lease);
                lastKeyFailure = failure;
                continue;
            }
            throw failure;
        }
        if (lastKeyFailure != null) throw lastKeyFailure;
        throw unavailable();
    }

    private ClashApiKeyPool.Lease acquire(
            Set<Integer> attempted,
            HttpException lastKeyFailure
    ) throws Exception {
        try {
            return keyPool.acquire(attempted);
        } catch (ClashApiKeyPool.UnavailableException unavailable) {
            if (lastKeyFailure != null) throw lastKeyFailure;
            throw unavailable();
        }
    }

    private Response send(
            String method,
            String url,
            String body,
            String authorization
    ) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) URI.create(url).toURL().openConnection();
        try {
            configure(connection, method, authorization);
            if (body != null) writeBody(connection, body);
            int status = connection.getResponseCode();
            return new Response(
                    status,
                    readBody(connection, status),
                    connection.getHeaderField("Retry-After")
            );
        } finally {
            connection.disconnect();
        }
    }

    private void configure(
            HttpURLConnection connection,
            String method,
            String authorization
    ) throws Exception {
        connection.setRequestMethod(method);
        connection.setRequestProperty("Authorization", authorization);
        connection.setRequestProperty("Accept", "application/json");
        connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
        connection.setReadTimeout(READ_TIMEOUT_MS);
    }

    private void writeBody(HttpURLConnection connection, String body) throws Exception {
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setDoOutput(true);
        try (OutputStream output = connection.getOutputStream()) {
            output.write(body.getBytes(StandardCharsets.UTF_8));
        }
    }

    private String readBody(HttpURLConnection connection, int status) throws Exception {
        InputStream stream = status >= 200 && status < 300
                ? connection.getInputStream()
                : connection.getErrorStream();
        if (stream == null) return "{\"error\":\"HTTP " + status + "\"}";
        try (stream) {
            return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private long cooldownMillis(String retryAfter) {
        long requested = parseRetryAfter(retryAfter, System.currentTimeMillis());
        long selected = requested > 0 ? requested : defaultCooldownMillis;
        return Math.max(1_000L, Math.min(selected, maximumCooldownMillis));
    }

    static long parseRetryAfter(String value, long nowMillis) {
        if (value == null || value.isBlank()) return 0L;
        try {
            return Math.max(0L, Long.parseLong(value.trim()) * 1_000L);
        } catch (NumberFormatException ignored) {
            try {
                Instant reset = ZonedDateTime.parse(
                        value.trim(), DateTimeFormatter.RFC_1123_DATE_TIME
                ).toInstant();
                return Math.max(0L, reset.toEpochMilli() - nowMillis);
            } catch (DateTimeParseException invalidDate) {
                return 0L;
            }
        }
    }

    private HttpException unavailable() {
        return HttpException.upstream(
                503,
                "{\"error\":\"Clash API key pool unavailable\"}",
                "Clash API"
        );
    }

    private record Response(int status, String body, String retryAfter) {
        boolean isSuccess() {
            return status >= 200 && status < 300;
        }
    }
}

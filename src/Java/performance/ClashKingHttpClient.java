package Java.performance;

import Java.HttpException;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

public final class ClashKingHttpClient {
    private static final ClashKingRequestCounter REQUEST_COUNTER = ClashKingRequestCounter.shared();
    private final String baseUrl;
    private final String upstreamName;
    private final String bearerToken;
    private final HttpClient client;

    public ClashKingHttpClient(String baseUrl, String upstreamName) {
        this(baseUrl, upstreamName, "");
    }

    public ClashKingHttpClient(String baseUrl, String upstreamName, String bearerToken) {
        this.baseUrl = String.valueOf(baseUrl).replaceAll("/+$", "");
        this.upstreamName = upstreamName;
        this.bearerToken = normalizeBearerToken(bearerToken);
        this.client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(8))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    public JsonObject get(String path) throws Exception {
        return object(getElement(path));
    }

    public JsonObject getNullableObject(String path) throws Exception {
        JsonElement response = getElement(path);
        if (response.isJsonNull()) return null;
        return object(response);
    }

    public JsonArray getArray(String path) throws Exception {
        JsonElement response = getElement(path);
        if (response.isJsonArray()) return response.getAsJsonArray();
        throw invalidJson();
    }

    public JsonElement getElement(String path) throws Exception {
        HttpRequest request = request(path).GET().build();
        return send(request);
    }

    public JsonObject post(String path, JsonObject body) throws Exception {
        HttpRequest request = request(path)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
                .build();
        return object(send(request));
    }

    private HttpRequest.Builder request(String path) {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(baseUrl + path))
                .timeout(Duration.ofSeconds(20))
                .header("Accept", "application/json")
                .header("User-Agent", "ClashPanel/1.0");
        if (!bearerToken.isBlank()) builder.header("Authorization", bearerToken);
        return builder;
    }

    private String normalizeBearerToken(String value) {
        if (value == null || value.isBlank()) return "";
        String normalized = value.trim();
        if (normalized.regionMatches(true, 0, "Bearer ", 0, 7)) normalized = normalized.substring(7).trim();
        return normalized.isBlank() ? "" : "Bearer " + normalized;
    }

    private JsonElement send(HttpRequest request) throws Exception {
        REQUEST_COUNTER.record(request.method());
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw HttpException.upstream(response.statusCode(), response.body(), upstreamName);
        }
        try {
            return JsonParser.parseString(response.body());
        } catch (RuntimeException invalidJson) {
            throw invalidJson();
        }
    }

    private JsonObject object(JsonElement response) throws HttpException {
        if (response.isJsonObject()) return response.getAsJsonObject();
        throw invalidJson();
    }

    private HttpException invalidJson() {
        return HttpException.upstream(
                502,
                "{\"error\":\"Invalid upstream JSON\"}",
                upstreamName
        );
    }
}

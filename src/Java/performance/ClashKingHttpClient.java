package Java.performance;

import Java.HttpException;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

final class ClashKingHttpClient {
    private final String baseUrl;
    private final String upstreamName;
    private final HttpClient client;

    ClashKingHttpClient(String baseUrl, String upstreamName) {
        this.baseUrl = String.valueOf(baseUrl).replaceAll("/+$", "");
        this.upstreamName = upstreamName;
        this.client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(8))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    JsonObject get(String path) throws Exception {
        HttpRequest request = request(path).GET().build();
        return send(request);
    }

    JsonObject post(String path, JsonObject body) throws Exception {
        HttpRequest request = request(path)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
                .build();
        return send(request);
    }

    private HttpRequest.Builder request(String path) {
        return HttpRequest.newBuilder(URI.create(baseUrl + path))
                .timeout(Duration.ofSeconds(20))
                .header("Accept", "application/json")
                .header("User-Agent", "ClashPanel/1.0");
    }

    private JsonObject send(HttpRequest request) throws Exception {
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw HttpException.upstream(response.statusCode(), response.body(), upstreamName);
        }
        try {
            return JsonParser.parseString(response.body()).getAsJsonObject();
        } catch (RuntimeException invalidJson) {
            throw HttpException.upstream(502, "{\"error\":\"Invalid upstream JSON\"}", upstreamName);
        }
    }
}

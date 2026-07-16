package Java;

import com.google.gson.JsonObject;
import com.google.gson.JsonArray;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpExchange;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

public final class AuthService {
    private static final int MAX_AUTH_HEADER_LENGTH = 16_384;
    private static final HttpClient CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .version(HttpClient.Version.HTTP_1_1)
            .build();

    private final Config config;

    public AuthService(Config config) {
        this.config = config;
    }

    public String requireUserId(HttpExchange exchange) throws Exception {
        String authorization = exchange.getRequestHeaders().getFirst("Authorization");
        if (authorization == null
                || authorization.length() > MAX_AUTH_HEADER_LENGTH
                || !authorization.regionMatches(true, 0, "Bearer ", 0, 7)) {
            throw unauthorized();
        }

        String token = authorization.substring(7).trim();
        if (token.isBlank()) throw unauthorized();
        String supabaseUrl;
        String publishableKey;
        try {
            supabaseUrl = config.getSupabaseUrl();
            publishableKey = config.getSupabasePublishableKey();
        } catch (IllegalStateException configurationError) {
            throw new HttpException(503, "{\"error\":\"Authenticatie is niet geconfigureerd\",\"code\":\"AUTH_NOT_CONFIGURED\"}");
        }

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(supabaseUrl + "/auth/v1/user"))
                .timeout(Duration.ofSeconds(8))
                .header("apikey", publishableKey)
                .header("Authorization", "Bearer " + token)
                .header("Accept", "application/json")
                .GET()
                .build();
        HttpResponse<String> response = CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) throw unauthorized();

        JsonObject user;
        try {
            user = JsonParser.parseString(response.body()).getAsJsonObject();
        } catch (RuntimeException invalidResponse) {
            throw unauthorized();
        }
        if (!user.has("id") || user.get("id").isJsonNull() || user.get("id").getAsString().isBlank()) {
            throw unauthorized();
        }
        String authUserId = user.get("id").getAsString();
        try {
            JsonArray profiles = JsonParser.parseString(SUPABASE_Client.getWithBody(
                    "users",
                    "select=id&auth_user_id=" + SUPABASE_Client.eq(authUserId) + "&limit=1"
            )).getAsJsonArray();
            if (!profiles.isEmpty()) return profiles.get(0).getAsJsonObject().get("id").getAsString();

            JsonArray sameIdProfiles = JsonParser.parseString(SUPABASE_Client.getWithBody(
                    "users",
                    "select=id&id=" + SUPABASE_Client.eq(authUserId) + "&limit=1"
            )).getAsJsonArray();
            if (!sameIdProfiles.isEmpty()) return authUserId;
        } catch (Exception profileLookupFailure) {
            throw new HttpException(503, "{\"error\":\"Gebruikersprofiel kan niet worden gevalideerd\",\"code\":\"PROFILE_LOOKUP_FAILED\"}");
        }
        throw new HttpException(403, "{\"error\":\"Gebruikersprofiel is nog niet gekoppeld\",\"code\":\"PROFILE_NOT_LINKED\"}");
    }

    private HttpException unauthorized() {
        return new HttpException(401, "{\"error\":\"Authenticatie vereist\",\"code\":\"AUTH_REQUIRED\"}");
    }
}

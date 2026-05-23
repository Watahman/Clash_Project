package Java;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

public class SUPABASE_Client {
    private static final String BASE_URL = System.getenv("_BASE_URL_SUPABASE");
    private static final String API_KEY  = System.getenv("_API_KEY_SECR_SUPABASE");

    // één gedeelde client voor alle requests
    private static final HttpClient CLIENT = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)  // ← forceer HTTP/1.1
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    // GET — data ophalen
    public static String getWithBody(String table) throws Exception {
        return sendRequest("GET", table, null);
    }

    public static String getWithBody(String table, String filter) throws Exception {
        return sendRequest("GET", table + "?" + filter, null);
    }

    // POST — data aanmaken
    public static String post(String table, String body) throws Exception {
        return sendRequest("POST", table, body);
    }

    // PATCH — data updaten
    public static String patch(String table, String filter, String body) throws Exception {
        return sendRequest("PATCH", table + "?" + filter, body);
    }

    // DELETE — data verwijderen
    public static String delete(String table) throws Exception {
        return sendRequest("DELETE", table, null);
    }

    public static String deleteColumn(String table, String filter) throws Exception {
        return sendRequest("DELETE", table + "?" + filter, null);
    }

    // algemene helper
    private static String sendRequest(String method, String table, String body) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(BASE_URL + "/rest/v1/" + table))
                .timeout(Duration.ofSeconds(15)) // request timeout
                .header("apikey", API_KEY)
                .header("Authorization", "Bearer " + API_KEY)
                .header("Content-Type", "application/json")
                .header("Prefer", "return=representation");

        if (body != null) {
            builder.method(method, HttpRequest.BodyPublishers.ofString(body));
        } else {
            builder.method(method, HttpRequest.BodyPublishers.noBody());
        }

        HttpResponse<String> response = CLIENT.send(builder.build(),
                HttpResponse.BodyHandlers.ofString());
        return response.body();
    }
}

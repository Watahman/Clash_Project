package Java;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

public class SUPABASE_Client {
    private static final Config CONF = new Config();

    private static final HttpClient CLIENT = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public static String getWithBody(String table) throws Exception {
        return sendRequest("GET", table, null);
    }

    public static String getWithBody(String table, String filter) throws Exception {
        return sendRequest("GET", table + "?" + filter, null);
    }

    public static String post(String table, String body) throws Exception {
        return sendRequest("POST", table, body);
    }

    public static String upsert(String table, String conflictColumn, String body) throws Exception {
        return sendRequest(
                "POST",
                table + "?on_conflict=" + URLEncoder.encode(conflictColumn, StandardCharsets.UTF_8),
                body,
                "resolution=merge-duplicates,return=minimal"
        );
    }

    public static String patch(String table, String filter, String body) throws Exception {
        return sendRequest("PATCH", table + "?" + filter, body);
    }

    public static String delete(String table) throws Exception {
        return sendRequest("DELETE", table, null);
    }

    public static String deleteColumn(String table, String filter) throws Exception {
        return sendRequest("DELETE", table + "?" + filter, null);
    }

    public static String eq(String value) {
        return "eq." + URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static String sendRequest(String method, String table, String body) throws Exception {
        return sendRequest(method, table, body, "return=representation");
    }

    private static String sendRequest(String method, String table, String body, String prefer) throws Exception {
        String baseUrl = CONF.getSupabaseUrl();
        String apiKey = CONF.getSupabaseServiceKey();

        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/rest/v1/" + table))
                .timeout(Duration.ofSeconds(15))
                .header("apikey", apiKey)
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .header("Prefer", prefer);

        if (body != null) {
            builder.method(method, HttpRequest.BodyPublishers.ofString(body));
        } else {
            builder.method(method, HttpRequest.BodyPublishers.noBody());
        }

        HttpResponse<String> response = CLIENT.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        int status = response.statusCode();
        String responseBody = response.body() == null ? "" : response.body();

        if (status < 200 || status >= 300) {
            if (responseBody.isBlank()) responseBody = "{\"error\":\"Supabase HTTP " + status + "\"}";
            throw new HttpException(status, responseBody);
        }

        return responseBody;
    }
}

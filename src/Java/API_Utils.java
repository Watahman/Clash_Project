package Java;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpExchange;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class API_Utils {
    private Config conf;

    public API_Utils(Config conf) {
        this.conf = conf;
    }

    public void addCORS(HttpExchange exchange) {
        exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");
    }

    public JsonObject parseRequestBody(HttpExchange exchange) throws Exception {
        InputStream is = exchange.getRequestBody();
        String body = new String(is.readAllBytes());
        System.out.println("Frontend stuurde data: " + body);
        return JsonParser.parseString(body).getAsJsonObject();
    }

    public String getClashApiResponse(String urlStr) throws Exception {
        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        conn.setRequestProperty("Authorization", conf._API_KEY_ACTIVE);
        conn.setRequestProperty("Accept", "application/json");

        InputStream is = conn.getInputStream();
        return new String(is.readAllBytes());
    }

    public String postClashApiResponse(String urlStr, String jsonBody) throws Exception {
        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();

        conn.setRequestMethod("POST");
        conn.setRequestProperty("Authorization", conf._API_KEY_ACTIVE);
        conn.setRequestProperty("Accept", "application/json");
        conn.setRequestProperty("Content-Type", "application/json");

        conn.setDoOutput(true);

        try (OutputStream os = conn.getOutputStream()) {
            byte[] input = jsonBody.getBytes("utf-8");
            os.write(input, 0, input.length);
        }

        InputStream is = conn.getInputStream();
        return new String(is.readAllBytes());
    }

    public void sendJsonResponse(HttpExchange exchange, String json, int statusCode) throws Exception {
        byte[] bytes = json.getBytes();
        exchange.sendResponseHeaders(statusCode, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }
}

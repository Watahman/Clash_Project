package Java;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.SecureRandom;

public class API_Utils {
    private final Config conf;

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

        int statusCode = conn.getResponseCode();

        if (statusCode != 200) {
            InputStream errorStream = conn.getErrorStream();
            String errorBody = errorStream != null
                    ? new String(errorStream.readAllBytes())
                    : "{\"error\":\"HTTP " + statusCode + "\"}";
            throw new HttpException(statusCode, errorBody);
        }

        return new String(conn.getInputStream().readAllBytes());
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
            os.write(jsonBody.getBytes("utf-8"));
        }

        int statusCode = conn.getResponseCode();

        if (statusCode != 200) {
            InputStream errorStream = conn.getErrorStream();
            String errorBody = errorStream != null
                    ? new String(errorStream.readAllBytes())
                    : "{\"error\":\"HTTP " + statusCode + "\"}";
            throw new HttpException(statusCode, errorBody);
        }

        return new String(conn.getInputStream().readAllBytes());
    }

    public void sendJsonResponse(HttpExchange exchange, String json, int statusCode) throws Exception {
        byte[] bytes = json.getBytes();
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

    // Leest en parsed de body; gooit een IllegalArgumentException als het mislukt
    public JsonObject parseBody(HttpExchange exchange) throws Exception {
        String body = new String(exchange.getRequestBody().readAllBytes());
        if (body.isBlank()) throw new IllegalArgumentException("Request body is leeg");
        return JsonParser.parseString(body).getAsJsonObject();
    }

    // Haalt een verplicht string-veld op uit een JsonObject
    public String requireString(JsonObject json, String field) throws IllegalArgumentException {
        JsonElement el = json.get(field);
        if (el == null || el.isJsonNull()) throw new IllegalArgumentException("Verplicht veld ontbreekt: " + field);
        return el.getAsString();
    }

    // Centrale handler-wrapper: vangt CORS, OPTIONS en errors af
    public void handlePost(HttpExchange exchange, PostHandler handler) {
        try {
            addCORS(exchange);
            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) return;

            try {
                handler.handle(exchange);
            } catch (IllegalArgumentException e) {
                sendJsonResponse(exchange, "{\"error\":\"" + e.getMessage() + "\"}", 400);
            } catch (Exception e) {
                e.printStackTrace();
                sendJsonResponse(exchange, "{\"error\":\"Interne serverfout\"}", 500);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public JsonArray requireArray(JsonObject json, String field) throws IllegalArgumentException {
        JsonElement el = json.get(field);
        if (el == null || el.isJsonNull() || !el.isJsonArray())
            throw new IllegalArgumentException("Verplicht veld ontbreekt of is geen array: " + field);
        return el.getAsJsonArray();
    }

    // Clash GET shorthand
    public void clashGet(HttpExchange exchange, String path) throws Exception {
        String response = getClashApiResponse(conf._BASE_URL_CLASH + path);
        sendJsonResponse(exchange, response, 200);
    }

    // Clash POST shorthand
    public void clashPost(HttpExchange exchange, String path, String body) throws Exception {
        String response = postClashApiResponse(conf._BASE_URL_CLASH + path, body);
        sendJsonResponse(exchange, response, 200);
    }

    @FunctionalInterface
    public interface PostHandler {
        void handle(HttpExchange exchange) throws Exception;
    }
}

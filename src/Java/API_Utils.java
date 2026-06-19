package Java;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpExchange;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;

public class API_Utils {
    private final Config conf;

    public API_Utils(Config conf) {
        this.conf = conf;
    }

    public void addCORS(HttpExchange exchange) {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }

    public String getClashApiResponse(String urlStr) throws Exception {
        URL url = new URL(urlStr);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        conn.setRequestProperty("Authorization", conf.getClashApiKey());
        conn.setRequestProperty("Accept", "application/json");

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
        String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        if (body.isBlank()) throw new IllegalArgumentException("Request body is leeg");
        return JsonParser.parseString(body).getAsJsonObject();
    }

    public String requireString(JsonObject json, String field) throws IllegalArgumentException {
        JsonElement el = json.get(field);
        if (el == null || el.isJsonNull()) throw new IllegalArgumentException("Verplicht veld ontbreekt: " + field);
        return el.getAsString();
    }

    public void handlePost(HttpExchange exchange, PostHandler handler) {
        try {
            addCORS(exchange);
            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendJsonResponse(exchange, "{\"error\":\"Method not allowed\"}", 405);
                return;
            }

            long start = System.currentTimeMillis();
            String path = exchange.getHttpContext().getPath();

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

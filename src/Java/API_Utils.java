package Java;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpExchange;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.SecureRandom;

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
}

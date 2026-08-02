package Java;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpServer;

import java.util.Set;

public final class PublicIntake {
    private static final Set<String> FEEDBACK_CATEGORIES = Set.of("bug", "feature", "account", "privacy", "other");
    private final HttpServer server;
    private final Config config;
    private final API_Utils utils;

    public PublicIntake(HttpServer server, Config config) {
        this.server = server;
        this.config = config;
        this.utils = new API_Utils(config);
    }

    public void registerRoutes() {
        server.createContext(config._PUBLIC_FEEDBACK, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject request = utils.parseBody(ex);
            String honeypot = text(request, "website", 200);
            long startedAt = number(request, "startedAt");
            if (!honeypot.isBlank() || startedAt <= 0 || System.currentTimeMillis() - startedAt < 2_000) {
                utils.sendJsonResponse(ex, "{\"accepted\":true}", 202);
                return;
            }
            String category = text(request, "category", 30).toLowerCase();
            if (!FEEDBACK_CATEGORIES.contains(category)) throw new IllegalArgumentException("Invalid feedback category");
            String description = text(request, "description", 4_000);
            if (description.length() < 10) throw new IllegalArgumentException("Description is too short");
            String email = text(request, "contactEmail", 254);
            String pagePath = safePath(text(request, "pagePath", 300));
            String screenshot = text(request, "screenshotData", 650_000);
            if (!screenshot.isBlank() && !screenshot.startsWith("data:image/")) {
                throw new IllegalArgumentException("Invalid screenshot");
            }
            JsonObject record = new JsonObject();
            record.addProperty("category", category);
            record.addProperty("page_path", pagePath);
            record.addProperty("description", description);
            record.addProperty("contact_email", email);
            if (screenshot.isBlank()) record.add("screenshot_data", null);
            else record.addProperty("screenshot_data", screenshot);
            SUPABASE_Client.post("feedback_submissions", record.toString());
            utils.sendJsonResponse(ex, "{\"accepted\":true}", 201);
        }));

        server.createContext(config._CLIENT_ERROR, exchange -> utils.handlePost(exchange, ex -> {
            storeDiagnostic("frontend", utils.parseBody(ex));
            utils.sendJsonResponse(ex, "{\"accepted\":true}", 202);
        }));

        server.createContext(config._CSP_REPORT, exchange -> utils.handlePost(exchange, ex -> {
            storeDiagnostic("csp", utils.parseBody(ex));
            utils.sendJsonResponse(ex, "{\"accepted\":true}", 202);
        }));
    }

    private void storeDiagnostic(String type, JsonObject request) throws Exception {
        JsonObject source = request.has("csp-report") && request.get("csp-report").isJsonObject()
                ? request.getAsJsonObject("csp-report") : request;
        String path = safePath(text(source, type.equals("csp") ? "document-uri" : "pagePath", 300));
        String message = text(source, type.equals("csp") ? "violated-directive" : "message", 500);
        JsonObject details = new JsonObject();
        for (String field : type.equals("csp")
                ? new String[]{"blocked-uri", "effective-directive", "source-file", "line-number"}
                : new String[]{"kind", "source", "line", "column"}) {
            String value = text(source, field, 500);
            if (!value.isBlank()) details.addProperty(field, value);
        }
        JsonObject record = new JsonObject();
        record.addProperty("event_type", type);
        record.addProperty("page_path", path);
        record.addProperty("message", message);
        record.add("details", details);
        SUPABASE_Client.post("client_error_events", record.toString());
        System.out.printf("[client-%s] %s %s%n", type, path, message);
    }

    private static String text(JsonObject object, String field, int maxLength) {
        JsonElement value = object.get(field);
        if (value == null || value.isJsonNull() || !value.isJsonPrimitive()) return "";
        String text = value.getAsString().trim();
        return text.length() <= maxLength ? text : text.substring(0, maxLength);
    }

    private static long number(JsonObject object, String field) {
        try { return object.has(field) ? object.get(field).getAsLong() : 0L; }
        catch (RuntimeException ignored) { return 0L; }
    }

    private static String safePath(String value) {
        try {
            java.net.URI uri = java.net.URI.create(value);
            String path = uri.isAbsolute() ? uri.getPath() : value;
            return path == null ? "" : path.replaceAll("[\\r\\n]", "");
        } catch (IllegalArgumentException ignored) {
            return "";
        }
    }
}

package Java;

import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

public final class SUPABASE_Auth {
    private final HttpServer server;
    private final Config conf;
    private final API_Utils utils;
    private final AuthService authService;

    public SUPABASE_Auth(HttpServer server, Config conf) {
        this.server = server;
        this.conf = conf;
        this.utils = new API_Utils(conf);
        this.authService = new AuthService(conf);
    }

    public void registerRoutes() {
        login();
        signup();
        session();
        recover();
        changePassword();
        logout();
        google();
        googleCallback();
    }

    private void login() {
        server.createContext(conf._AUTH_LOGIN, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json = utils.parseBody(ex);
            String email = requireEmail(json);
            String password = utils.requireString(json, "password");
            validateExistingPassword(password);

            utils.sendJsonResponse(ex, authService.signIn(ex, email, password).toString(), 200);
        }));
    }

    private void signup() {
        server.createContext(conf._AUTH_SIGNUP, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json = utils.parseBody(ex);
            String name = utils.requireString(json, "name").trim();
            String email = requireEmail(json);
            String password = utils.requireString(json, "password");

            if (name.length() < 2 || name.length() > 32) {
                throw new IllegalArgumentException("Naam moet tussen 2 en 32 tekens lang zijn.");
            }
            validateNewPassword(password);

            utils.sendJsonResponse(ex, authService.signUp(ex, name, email, password).toString(), 200);
        }));
    }

    private void session() {
        server.createContext(conf._AUTH_SESSION, exchange -> utils.handlePost(exchange, ex ->
                utils.sendJsonResponse(ex, authService.currentSession(ex).toString(), 200)
        ));
    }

    private void recover() {
        server.createContext(conf._AUTH_RECOVER, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json = utils.parseBody(ex);
            String email = requireEmail(json);
            authService.requestPasswordReset(email);
            utils.sendJsonResponse(ex, "{\"success\":true}", 200);
        }));
    }

    private void changePassword() {
        server.createContext(conf._AUTH_CHANGE_PASSWORD, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json = utils.parseBody(ex);
            String currentPassword = utils.requireString(json, "currentPassword");
            String newPassword = utils.requireString(json, "newPassword");
            validateExistingPassword(currentPassword);
            validateNewPassword(newPassword);
            if (currentPassword.equals(newPassword)) {
                throw new IllegalArgumentException("Het nieuwe wachtwoord moet verschillen van het huidige wachtwoord.");
            }

            utils.sendJsonResponse(
                    ex,
                    authService.changePassword(ex, currentPassword, newPassword).toString(),
                    200
            );
        }));
    }

    private void logout() {
        server.createContext(conf._AUTH_LOGOUT, exchange -> utils.handlePost(exchange, ex -> {
            authService.signOut(ex);
            utils.sendJsonResponse(ex, "{\"success\":true}", 200);
        }));
    }

    private String requireEmail(JsonObject json) {
        String email = utils.requireString(json, "email").trim().toLowerCase();
        if (email.length() > 320 || !email.contains("@") || email.startsWith("@") || email.endsWith("@")) {
            throw new IllegalArgumentException("Ongeldig e-mailadres.");
        }
        return email;
    }

    private void validateExistingPassword(String password) {
        if (password == null || password.isBlank() || password.length() > 1024) {
            throw new IllegalArgumentException("Wachtwoord ontbreekt of is te lang.");
        }
    }

    private void google() {
        server.createContext(conf._AUTH_GOOGLE, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json = utils.parseBody(ex);
            String next = json.has("next") && !json.get("next").isJsonNull() ? json.get("next").getAsString() : "";
            JsonObject response = new JsonObject();
            response.addProperty("url", authService.startGoogleOAuth(ex, next));
            utils.sendJsonResponse(ex, response.toString(), 200);
        }));
    }

    private void googleCallback() {
        server.createContext(conf._AUTH_GOOGLE_CALLBACK, exchange -> utils.handleGet(exchange, ex -> {
            ex.getResponseHeaders().set("Cache-Control", "private, no-store");
            ex.getResponseHeaders().set("Referrer-Policy", "no-referrer");

            String destination;
            try {
                String providerError = queryParameter(ex, "error");
                if (!providerError.isBlank()) throw new IllegalArgumentException("Google-aanmelding geannuleerd");
                destination = authService.completeGoogleOAuth(ex, queryParameter(ex, "code"));
            } catch (Exception authError) {
                authService.clearGoogleFlowCookies(ex);
                destination = "/subPages/login.html?oauth=failed";
            }
            ex.getResponseHeaders().set("Location", destination);
            ex.sendResponseHeaders(303, -1);
            ex.close();
        }));
    }

    private String queryParameter(HttpExchange exchange, String name) {
        String rawQuery = exchange.getRequestURI().getRawQuery();
        if (rawQuery == null || rawQuery.isBlank()) return "";
        for (String pair : rawQuery.split("&")) {
            int separator = pair.indexOf('=');
            String key = separator < 0 ? pair : pair.substring(0, separator);
            if (!name.equals(URLDecoder.decode(key, StandardCharsets.UTF_8))) continue;
            String value = separator < 0 ? "" : pair.substring(separator + 1);
            return URLDecoder.decode(value, StandardCharsets.UTF_8);
        }
        return "";
    }

    private void validateNewPassword(String password) {
        if (password == null
                || password.length() < 8
                || password.length() > 1024
                || !password.matches(".*[a-z].*")
                || !password.matches(".*[A-Z].*")
                || !password.matches(".*\\d.*")
                || !password.matches(".*[^A-Za-z0-9].*")) {
            throw new IllegalArgumentException(
                    "Wachtwoord moet 8 tot 1024 tekens, kleine en hoofdletters, een cijfer en een speciaal teken bevatten."
            );
        }
    }
}

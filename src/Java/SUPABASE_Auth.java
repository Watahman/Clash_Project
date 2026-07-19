package Java;

import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

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
    }

    private void login() {
        server.createContext(conf._AUTH_LOGIN, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json = utils.parseBody(ex);
            String email = requireEmail(json);
            String password = utils.requireString(json, "password");
            validatePasswordInput(password);

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
            validatePasswordInput(password);

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
            validatePasswordInput(currentPassword);
            validatePasswordInput(newPassword);
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

    private void validatePasswordInput(String password) {
        if (password == null || password.length() < 8 || password.length() > 1024) {
            throw new IllegalArgumentException("Wachtwoord moet minstens 8 tekens lang zijn.");
        }
    }
}

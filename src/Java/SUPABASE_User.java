package Java;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpServer;

import java.security.MessageDigest;
import java.util.Base64;

public class SUPABASE_User {
    private final HttpServer server;
    private final Config conf;
    private final API_Utils utils;

    public SUPABASE_User(HttpServer server, Config conf){
        this.server = server;
        this.conf = conf;
        utils = new API_Utils(conf);
    }

    public void getUserInfo(){
        server.createContext(conf._EXT_SUPA_USER_INFO, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    String body = new String(exchange.getRequestBody().readAllBytes());

                    if (body.isBlank()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Request body is leeg\"}", 400);
                        return;
                    }

                    JsonObject json = JsonParser.parseString(body).getAsJsonObject();
                    JsonElement idEl = json.get("userId");

                    if (idEl == null || idEl.isJsonNull()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Verplicht veld ontbreekt: id\"}", 400);
                        return;
                    }

                    String id = idEl.getAsString();
                    String result = SUPABASE_Client.getWithBody("users", "id=eq." + id);

                    JsonArray users = JsonParser.parseString(result).getAsJsonArray();
                    if (users.isEmpty()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Gebruiker niet gevonden\"}", 404);
                        return;
                    }

                    utils.sendJsonResponse(exchange, result, 200);

                } catch (IllegalStateException | ClassCastException e) {
                    e.printStackTrace();
                    try {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Ongeldige JSON structuur\"}", 400);
                    } catch (Exception ex) {
                        ex.printStackTrace();
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                    try {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Ophalen gebruiker mislukt\"}", 500);
                    } catch (Exception ex) {
                        ex.printStackTrace();
                    }
                }
            }
        });
    }

    public void getUserBases(){
        server.createContext(conf._EXT_SUPA_USER_BASES, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    String body = new String(exchange.getRequestBody().readAllBytes());

                    if (body.isBlank()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Request body is leeg\"}", 400);
                        return;
                    }

                    JsonObject json = JsonParser.parseString(body).getAsJsonObject();
                    JsonElement idEl = json.get("id");

                    if (idEl == null || idEl.isJsonNull()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Verplicht veld ontbreekt: id\"}", 400);
                        return;
                    }

                    String id = idEl.getAsString();
                    String result = SUPABASE_Client.getWithBody("users", "select=accounts&id=eq." + id);
                    utils.sendJsonResponse(exchange, result, 200);

                } catch (IllegalStateException | ClassCastException e) {
                    e.printStackTrace();
                    try {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Ongeldige JSON structuur\"}", 400);
                    } catch (Exception ex) {
                        ex.printStackTrace();
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                    try {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Ophalen bases mislukt\"}", 500);
                    } catch (Exception ex) {
                        ex.printStackTrace();
                    }
                }
            }
        });
    }

    public void checkUserLogin(){
        server.createContext(conf._EXT_SUPA_USER_CHECK, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    String body = new String(exchange.getRequestBody().readAllBytes());

                    if (body.isBlank()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Request body is leeg\"}", 400);
                        return;
                    }

                    JsonObject json = JsonParser.parseString(body).getAsJsonObject();
                    JsonElement emailEl    = json.get("email");
                    JsonElement passwordEl = json.get("password");

                    if (emailEl == null || emailEl.isJsonNull() || passwordEl == null || passwordEl.isJsonNull()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Verplichte velden ontbreken: email, password\"}", 400);
                        return;
                    }

                    String email    = emailEl.getAsString();
                    String password = passwordEl.getAsString();

                    MessageDigest md = MessageDigest.getInstance("SHA-256");
                    byte[] hash = md.digest(password.getBytes());
                    String hashedPassword = Base64.getEncoder().encodeToString(hash);

                    String result = SUPABASE_Client.getWithBody("users", "email=eq." + email);
                    JsonArray users = JsonParser.parseString(result).getAsJsonArray();

                    if (users.isEmpty()) {
                        utils.sendJsonResponse(exchange, "{\"success\":false, \"error\":\"Gebruiker niet gevonden\"}", 404);
                        return;
                    }

                    JsonObject user = users.get(0).getAsJsonObject();
                    JsonElement storedPasswordEl = user.get("password");

                    if (storedPasswordEl == null || storedPasswordEl.isJsonNull()) {
                        utils.sendJsonResponse(exchange, "{\"success\":false, \"error\":\"Gebruikersdata onvolledig\"}", 500);
                        return;
                    }

                    if (storedPasswordEl.getAsString().equals(hashedPassword)) {
                        utils.sendJsonResponse(exchange, "{\"success\":true, \"id\":\"" + user.get("id").getAsString() + "\"}", 200);
                    } else {
                        utils.sendJsonResponse(exchange, "{\"success\":false, \"error\":\"Verkeerd wachtwoord\"}", 401);
                    }

                } catch (IllegalStateException | ClassCastException e) {
                    e.printStackTrace();
                    try {
                        utils.sendJsonResponse(exchange, "{\"success\":false, \"error\":\"Ongeldige JSON structuur\"}", 400);
                    } catch (Exception ex) {
                        ex.printStackTrace();
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                    try {
                        utils.sendJsonResponse(exchange, "{\"success\":false, \"error\":\"Inloggen mislukt\"}", 500);
                    } catch (Exception ex) {
                        ex.printStackTrace();
                    }
                }
            }
        });
    }

    public void compareUserId(){
        server.createContext(conf._EXT_SUPA_USER_IDCHECK, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    String body = new String(exchange.getRequestBody().readAllBytes());

                    if (body.isBlank()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Request body is leeg\"}", 400);
                        return;
                    }

                    JsonObject json = JsonParser.parseString(body).getAsJsonObject();
                    JsonElement idEl = json.get("userId");

                    if (idEl == null || idEl.isJsonNull()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Verplicht veld ontbreekt: id\"}", 400);
                        return;
                    }

                    String id = idEl.getAsString();
                    String user = SUPABASE_Client.getWithBody("users", "id=eq." + id);
                    JsonArray userArray = JsonParser.parseString(user).getAsJsonArray();

                    if (userArray.isEmpty()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Gebruiker niet gevonden\"}", 404);
                        return;
                    }

                    JsonObject userObj  = userArray.get(0).getAsJsonObject();
                    JsonObject userJson = new JsonObject();

                    userJson.addProperty("name",       userObj.get("name").getAsString());
                    userJson.addProperty("email",      userObj.get("email").getAsString());
                    userJson.addProperty("created_at", userObj.get("created_at").getAsString());
                    userJson.addProperty("code",       userObj.get("code").getAsString());

                    JsonElement accounts = userObj.get("accounts");
                    if (accounts != null && !accounts.isJsonNull()) {
                        userJson.add("accounts", accounts.getAsJsonArray());
                    } else {
                        userJson.add("accounts", new JsonArray());
                    }

                    utils.sendJsonResponse(exchange, userJson.toString(), 200);

                } catch (IllegalStateException | ClassCastException e) {
                    e.printStackTrace();
                    try {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Ongeldige JSON structuur\"}", 400);
                    } catch (Exception ex) {
                        ex.printStackTrace();
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                    try {
                        utils.sendJsonResponse(exchange, "{\"error\":\"ID check mislukt\"}", 500);
                    } catch (Exception ex) {
                        ex.printStackTrace();
                    }
                }
            }
        });
    }

    public void createUser(){
        server.createContext(conf._EXT_SUPA_USER_MAKE, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    String body = new String(exchange.getRequestBody().readAllBytes());

                    if (body.isBlank()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Request body is leeg\"}", 400);
                        return;
                    }

                    JsonObject json = JsonParser.parseString(body).getAsJsonObject();
                    JsonElement nameEl     = json.get("name");
                    JsonElement emailEl    = json.get("email");
                    JsonElement passwordEl = json.get("password");

                    if (nameEl == null || nameEl.isJsonNull()
                            || emailEl == null || emailEl.isJsonNull()
                            || passwordEl == null || passwordEl.isJsonNull()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Verplichte velden ontbreken: name, email, password\"}", 400);
                        return;
                    }

                    String naam     = nameEl.getAsString();
                    String email    = emailEl.getAsString();
                    String password = passwordEl.getAsString();
                    String code     = API_Utils.generateCode();

                    // Controleer of email al bestaat
                    String existing = SUPABASE_Client.getWithBody("users", "email=eq." + email);
                    JsonArray existingUsers = JsonParser.parseString(existing).getAsJsonArray();
                    if (!existingUsers.isEmpty()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Email is al in gebruik\"}", 409);
                        return;
                    }

                    MessageDigest md = MessageDigest.getInstance("SHA-256");
                    byte[] hash = md.digest(password.getBytes());
                    String hashedPassword = Base64.getEncoder().encodeToString(hash);

                    JsonObject user = new JsonObject();
                    user.addProperty("name",     naam);
                    user.addProperty("email",    email);
                    user.addProperty("password", hashedPassword);
                    user.addProperty("code",     code);

                    String result = SUPABASE_Client.post("users", user.toString());

                    JsonArray resultArray = JsonParser.parseString(result).getAsJsonArray();
                    if (resultArray.isEmpty()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Gebruiker aanmaken mislukt\"}", 500);
                        return;
                    }

                    utils.sendJsonResponse(exchange, result, 201);

                } catch (IllegalStateException | ClassCastException e) {
                    e.printStackTrace();
                    try {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Ongeldige JSON structuur\"}", 400);
                    } catch (Exception ex) {
                        ex.printStackTrace();
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                    try {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Gebruiker aanmaken mislukt\"}", 500);
                    } catch (Exception ex) {
                        ex.printStackTrace();
                    }
                }
            }
        });
    }

    public void addAccountToUser(){
        server.createContext(conf._EXT_SUPA_USER_ADD_ACCOUNT, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    String body = new String(exchange.getRequestBody().readAllBytes());

                    if (body.isBlank()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Request body is leeg\"}", 400);
                        return;
                    }

                    JsonObject json = JsonParser.parseString(body).getAsJsonObject();
                    JsonElement idEl      = json.get("id");
                    JsonElement accountEl = json.get("base");

                    if (idEl == null || idEl.isJsonNull() || accountEl == null || accountEl.isJsonNull()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Verplichte velden ontbreken: id, account\"}", 400);
                        return;
                    }

                    if (!accountEl.isJsonObject()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Veld 'account' moet een object zijn\"}", 400);
                        return;
                    }

                    String userId      = idEl.getAsString();
                    JsonObject newAccount = accountEl.getAsJsonObject();

                    String result = SUPABASE_Client.getWithBody("users", "id=eq." + userId);
                    JsonArray users = JsonParser.parseString(result).getAsJsonArray();

                    if (users.isEmpty()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Gebruiker niet gevonden\"}", 404);
                        return;
                    }

                    JsonElement accountsEl = users.get(0).getAsJsonObject().get("accounts");
                    JsonArray accounts = (accountsEl == null || accountsEl.isJsonNull())
                            ? new JsonArray()
                            : accountsEl.getAsJsonArray();

                    accounts.add(newAccount);

                    JsonObject patch = new JsonObject();
                    patch.add("accounts", accounts);
                    SUPABASE_Client.patch("users", "id=eq." + userId, patch.toString());

                    utils.sendJsonResponse(exchange, patch.toString(), 200);

                } catch (IllegalStateException | ClassCastException e) {
                    e.printStackTrace();
                    try {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Ongeldige JSON structuur\"}", 400);
                    } catch (Exception ex) {
                        ex.printStackTrace();
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                    try {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Account toevoegen mislukt\"}", 500);
                    } catch (Exception ex) {
                        ex.printStackTrace();
                    }
                }
            }
        });
    }
}
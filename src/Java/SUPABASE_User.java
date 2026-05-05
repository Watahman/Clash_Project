package Java;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpServer;

import java.security.MessageDigest;
import java.util.Base64;

public class SUPABASE_User {
    private HttpServer server;
    private Config conf;
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
                    JsonObject json = JsonParser.parseString(body).getAsJsonObject();

                    String id = json.get("id").getAsString();

                    String result = SUPABASE_Client.getWithBody("users", "id=eq." + id);
                    utils.sendJsonResponse(exchange, result, 201);
                } catch (Exception e) {
                    e.printStackTrace();
                    try {
                        utils.sendJsonResponse(exchange, "{\"error\":\"failed\"}", 500);
                    } catch (Exception ex) {
                        throw new RuntimeException(ex);
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
                    JsonObject json = JsonParser.parseString(body).getAsJsonObject();

                    String email = json.get("email").getAsString();
                    String password = json.get("password").getAsString();

                    MessageDigest md = MessageDigest.getInstance("SHA-256");
                    byte[] hash = md.digest(password.getBytes());
                    String hashedPassword = Base64.getEncoder().encodeToString(hash);

                    String result = SUPABASE_Client.getWithBody("users", "email=eq." + email);
                    JsonArray users = JsonParser.parseString(result).getAsJsonArray();

                    if (users.isEmpty()) {
                        utils.sendJsonResponse(exchange, "{\"success\":false, \"error\":\"user not found\"}", 404);
                        return;
                    }

                    JsonObject user = users.get(0).getAsJsonObject();
                    String storedPassword = user.get("password").getAsString();

                    if (storedPassword.equals(hashedPassword)) {
                        utils.sendJsonResponse(exchange, "{\"success\":true, \"id\":\"" + user.get("id").getAsString() + "\"}", 200);
                    } else {
                        utils.sendJsonResponse(exchange, "{\"success\":false, \"error\":\"wrong password\"}", 401);
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                    try {
                        utils.sendJsonResponse(exchange, "{\"success\":false, \"error\":\"failed\"}", 500);
                    } catch (Exception ex) {
                        throw new RuntimeException(ex);
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
                    JsonObject json = JsonParser.parseString(body).getAsJsonObject();

                    String id = json.get("id").getAsString();
                    String user = SUPABASE_Client.getWithBody("users", "id=eq." + id);
                    JsonArray userArray = JsonParser.parseString(user).getAsJsonArray();
                    JsonObject userJson = new JsonObject();

                    if (!userArray.isEmpty()) {
                        userJson.addProperty("name", userArray.get(0).getAsJsonObject().get("name").getAsString());
                        userJson.addProperty("email", userArray.get(0).getAsJsonObject().get("email").getAsString());

                        JsonElement accounts = userArray.get(0).getAsJsonObject().get("accounts");

                        if (accounts != null && !accounts.isJsonNull()) {
                            userJson.add("accounts", accounts.getAsJsonArray());
                        } else {
                            userJson.add("accounts", null);
                        }

                        userJson.addProperty("created_at", userArray.get(0).getAsJsonObject().get("created_at").getAsString());
                    }

                    utils.sendJsonResponse(exchange, String.valueOf(userJson), 200);
                } catch (Exception e) {
                    e.printStackTrace();
                    try {
                        utils.sendJsonResponse(exchange, "{\"error\":\"failed\"}", 500);
                    } catch (Exception ex) {
                        throw new RuntimeException(ex);
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
                    JsonObject json = JsonParser.parseString(body).getAsJsonObject();

                    String naam = json.get("name").getAsString();
                    String email = json.get("email").getAsString();
                    String password = json.get("password").getAsString();

                    // wachtwoord hashen
                    MessageDigest md = MessageDigest.getInstance("SHA-256");
                    byte[] hash = md.digest(password.getBytes());
                    String hashedPassword = Base64.getEncoder().encodeToString(hash);

                    // user object aanmaken
                    JsonObject user = new JsonObject();
                    user.addProperty("name", naam);
                    user.addProperty("email", email);
                    user.addProperty("password", hashedPassword);

                    // opslaan in Supabase
                    String result = SUPABASE_Client.post("users", user.toString());
                    System.out.println(result);
                    utils.sendJsonResponse(exchange, result, 201);
                } catch (Exception e) {
                    e.printStackTrace();
                    try {
                        utils.sendJsonResponse(exchange, "{\"error\":\"failed\"}", 500);
                    } catch (Exception ex) {
                        throw new RuntimeException(ex);
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
                    JsonObject json = JsonParser.parseString(body).getAsJsonObject();

                    String userId = json.get("id").getAsString();
                    JsonObject newAccount = json.get("account").getAsJsonObject();

                    // Huidige accounts ophalen
                    String result = SUPABASE_Client.getWithBody("users", "id=eq." + userId);
                    JsonArray users = JsonParser.parseString(result).getAsJsonArray();

                    if (users.isEmpty()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"user not found\"}", 404);
                        return;
                    }

                    JsonElement accountsEl = users.get(0).getAsJsonObject().get("accounts");
                    JsonArray accounts;

                    if (accountsEl == null || accountsEl.isJsonNull()) {
                        accounts = new JsonArray(); // was null, start fresh
                    } else {
                        accounts = accountsEl.getAsJsonArray();
                    }

                    accounts.add(newAccount);

                    // Opslaan
                    JsonObject patch = new JsonObject();
                    patch.add("accounts", accounts);
                    SUPABASE_Client.patch("users", "id=eq." + userId, patch.toString());

                    utils.sendJsonResponse(exchange, patch.toString(), 200);
                } catch (Exception e) {
                    e.printStackTrace();
                    try {
                        utils.sendJsonResponse(exchange, "{\"error\":\"failed\"}", 500);
                    } catch (Exception ex) {
                        throw new RuntimeException(ex);
                    }
                }
            }
        });
    }
}

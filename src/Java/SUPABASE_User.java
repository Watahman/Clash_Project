package Java;

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
}

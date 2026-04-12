package Java;

import at.favre.lib.crypto.bcrypt.BCrypt;
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
        server.createContext("/api/vrienden", exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if ("GET".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    String data = SUPABASE_Client.get("vrienden");
                    utils.sendJsonResponse(exchange, data, 200);
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
                    System.out.println("Body ontvangen: " + body);

                    JsonObject json = JsonParser.parseString(body).getAsJsonObject();
                    System.out.println("JSON geparsed: " + json);

                    String naam = json.get("name").getAsString();
                    String email = json.get("email").getAsString();
                    String password = json.get("password").getAsString();
                    System.out.println("Data uitgelezen: " + naam + " " + email);

                    // wachtwoord hashen
                    System.out.println("Start hashing...");
                    MessageDigest md = MessageDigest.getInstance("SHA-256");
                    byte[] hash = md.digest(password.getBytes());
                    String hashedPassword = Base64.getEncoder().encodeToString(hash);
                    System.out.println("Hash klaar: " + hashedPassword);

                    // user object aanmaken
                    JsonObject user = new JsonObject();
                    user.addProperty("name", naam);
                    user.addProperty("email", email);
                    user.addProperty("password", hashedPassword);
                    System.out.println("User object: " + user);

                    // opslaan in Supabase
                    System.out.println("Supabase aanroepen...");
                    String result = SUPABASE_Client.post("users", user.toString());
                    System.out.println("Supabase resultaat: " + result);

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

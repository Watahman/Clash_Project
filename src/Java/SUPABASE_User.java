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

    public void getUserBases() {
        server.createContext(conf._EXT_SUPA_USER_BASES, exchange -> {
            utils.handlePost(exchange, ex -> {
                JsonObject json = utils.parseBody(ex);
                String id = utils.requireString(json, "userId");
                String result = SUPABASE_Client.getWithBody("users", "select=accounts&id=eq." + id);
                utils.sendJsonResponse(ex, result, 200);
            });
        });
    }

    public void getUserInfo() {
        server.createContext(conf._EXT_SUPA_USER_INFO, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json = utils.parseBody(ex);
            String id = utils.requireString(json, "userId");
            String result = SUPABASE_Client.getWithBody("users", "id=eq." + id);
            JsonArray users = JsonParser.parseString(result).getAsJsonArray();
            if (users.isEmpty()) { utils.sendJsonResponse(ex, "{\"error\":\"Gebruiker niet gevonden\"}", 404); return; }
            utils.sendJsonResponse(ex, result, 200);
        }));
    }

    public void checkUserLogin() {
        server.createContext(conf._EXT_SUPA_USER_CHECK, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json = utils.parseBody(ex);
            String email    = utils.requireString(json, "email");
            String password = utils.requireString(json, "password");

            MessageDigest md = MessageDigest.getInstance("SHA-256");
            String hashedPassword = Base64.getEncoder().encodeToString(md.digest(password.getBytes()));

            JsonArray users = JsonParser.parseString(SUPABASE_Client.getWithBody("users", "email=eq." + email)).getAsJsonArray();
            if (users.isEmpty()) { utils.sendJsonResponse(ex, "{\"success\":false,\"error\":\"Gebruiker niet gevonden\"}", 404); return; }

            JsonObject user = users.get(0).getAsJsonObject();
            boolean match = user.get("password").getAsString().equals(hashedPassword);
            if (match) {
                utils.sendJsonResponse(ex, "{\"success\":true,\"id\":\"" + user.get("id").getAsString() + "\"}", 200);
            } else {
                utils.sendJsonResponse(ex, "{\"success\":false,\"error\":\"Verkeerd wachtwoord\"}", 401);
            }
        }));
    }

    public void compareUserId() {
        server.createContext(conf._EXT_SUPA_USER_IDCHECK, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json = utils.parseBody(ex);
            String id = utils.requireString(json, "userId");

            JsonArray userArray = JsonParser.parseString(SUPABASE_Client.getWithBody("users", "id=eq." + id)).getAsJsonArray();
            if (userArray.isEmpty()) { utils.sendJsonResponse(ex, "{\"error\":\"Gebruiker niet gevonden\"}", 404); return; }

            JsonObject userObj  = userArray.get(0).getAsJsonObject();
            JsonObject userJson = new JsonObject();
            userJson.addProperty("name",       userObj.get("name").getAsString());
            userJson.addProperty("email",      userObj.get("email").getAsString());
            userJson.addProperty("created_at", userObj.get("created_at").getAsString());
            userJson.addProperty("code",       userObj.get("code").getAsString());
            JsonElement accounts = userObj.get("accounts");
            userJson.add("accounts", (accounts != null && !accounts.isJsonNull()) ? accounts.getAsJsonArray() : new JsonArray());

            utils.sendJsonResponse(ex, userJson.toString(), 200);
        }));
    }

    public void createUser() {
        server.createContext(conf._EXT_SUPA_USER_MAKE, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json = utils.parseBody(ex);
            String naam     = utils.requireString(json, "name");
            String email    = utils.requireString(json, "email");
            String password = utils.requireString(json, "password");

            if (!JsonParser.parseString(SUPABASE_Client.getWithBody("users", "email=eq." + email)).getAsJsonArray().isEmpty()) {
                utils.sendJsonResponse(ex, "{\"error\":\"Email is al in gebruik\"}", 409); return;
            }

            MessageDigest md = MessageDigest.getInstance("SHA-256");
            String hashedPassword = Base64.getEncoder().encodeToString(md.digest(password.getBytes()));

            JsonObject user = new JsonObject();
            user.addProperty("name",     naam);
            user.addProperty("email",    email);
            user.addProperty("password", hashedPassword);
            user.addProperty("code",     API_Utils.generateCode());

            String result = SUPABASE_Client.post("users", user.toString());
            JsonArray resultArray = JsonParser.parseString(result).getAsJsonArray();
            if (resultArray.isEmpty()) { utils.sendJsonResponse(ex, "{\"error\":\"Gebruiker aanmaken mislukt\"}", 500); return; }

            utils.sendJsonResponse(ex, result, 201);
        }));
    }

    public void addAccountToUser() {
        server.createContext(conf._EXT_SUPA_USER_ADD_ACCOUNT, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json = utils.parseBody(ex);
            String userId     = utils.requireString(json, "id");
            JsonElement accountEl = json.get("base");

            if (accountEl == null || accountEl.isJsonNull() || !accountEl.isJsonObject()) {
                utils.sendJsonResponse(ex, "{\"error\":\"Veld 'base' moet een object zijn\"}", 400); return;
            }

            JsonArray users = JsonParser.parseString(SUPABASE_Client.getWithBody("users", "id=eq." + userId)).getAsJsonArray();
            if (users.isEmpty()) { utils.sendJsonResponse(ex, "{\"error\":\"Gebruiker niet gevonden\"}", 404); return; }

            JsonElement accountsEl = users.get(0).getAsJsonObject().get("accounts");
            JsonArray accounts = (accountsEl == null || accountsEl.isJsonNull()) ? new JsonArray() : accountsEl.getAsJsonArray();
            accounts.add(accountEl.getAsJsonObject());

            JsonObject patch = new JsonObject();
            patch.add("accounts", accounts);
            SUPABASE_Client.patch("users", "id=eq." + userId, patch.toString());

            utils.sendJsonResponse(ex, patch.toString(), 200);
        }));
    }
}
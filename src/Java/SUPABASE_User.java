package Java;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpServer;

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
        server.createContext(conf._EXT_SUPA_USER_BASES, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json = utils.parseBody(ex);
            String id = utils.requireString(json, "userId");
            String result = SUPABASE_Client.getWithBody("users", "select=accounts&id=" + SUPABASE_Client.eq(id));
            utils.sendJsonResponse(ex, result, 200);
        }));
    }

    public void getUserInfo() {
        server.createContext(conf._EXT_SUPA_USER_INFO, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json = utils.parseBody(ex);
            String id = utils.requireString(json, "userId");
            String result = SUPABASE_Client.getWithBody("users", "select=id,name,code,accounts,created_at&id=" + SUPABASE_Client.eq(id));
            JsonArray users = JsonParser.parseString(result).getAsJsonArray();
            if (users.isEmpty()) {
                utils.sendJsonResponse(ex, "{\"error\":\"Gebruiker niet gevonden\"}", 404);
                return;
            }
            utils.sendJsonResponse(ex, result, 200);
        }));
    }

    public void checkUserLogin() {
        server.createContext(conf._EXT_SUPA_USER_CHECK, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json = utils.parseBody(ex);
            String email    = utils.requireString(json, "email");
            String password = utils.requireString(json, "password");

            JsonArray users = JsonParser.parseString(SUPABASE_Client.getWithBody("users", "email=" + SUPABASE_Client.eq(email))).getAsJsonArray();
            if (users.isEmpty()) {
                utils.sendJsonResponse(ex, "{\"success\":false,\"error\":\"Gebruiker niet gevonden\"}", 404);
                return;
            }

            JsonObject user = users.get(0).getAsJsonObject();
            String storedHash = user.get("password").getAsString();
            boolean match = PasswordUtil.verifyPassword(password, storedHash);
            if (match) {
                if (PasswordUtil.isLegacyHash(storedHash)) {
                    JsonObject patch = new JsonObject();
                    patch.addProperty("password", PasswordUtil.hashPassword(password));
                    SUPABASE_Client.patch("users", "id=" + SUPABASE_Client.eq(user.get("id").getAsString()), patch.toString());
                }
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

            JsonArray userArray = JsonParser.parseString(SUPABASE_Client.getWithBody("users", "select=id,name,email,created_at,code,accounts&id=" + SUPABASE_Client.eq(id))).getAsJsonArray();
            if (userArray.isEmpty()) {
                utils.sendJsonResponse(ex, "{\"error\":\"Gebruiker niet gevonden\"}", 404);
                return;
            }

            JsonObject userObj  = userArray.get(0).getAsJsonObject();
            JsonObject userJson = new JsonObject();
            userJson.addProperty("id",         userObj.get("id").getAsString());
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

            if (!JsonParser.parseString(SUPABASE_Client.getWithBody("users", "email=" + SUPABASE_Client.eq(email))).getAsJsonArray().isEmpty()) {
                utils.sendJsonResponse(ex, "{\"error\":\"Email is al in gebruik\"}", 409);
                return;
            }

            JsonObject user = new JsonObject();
            user.addProperty("name",     naam);
            user.addProperty("email",    email);
            user.addProperty("password", PasswordUtil.hashPassword(password));
            user.addProperty("code",     API_Utils.generateCode());

            String result = SUPABASE_Client.post("users", user.toString());
            JsonArray resultArray = JsonParser.parseString(result).getAsJsonArray();
            if (resultArray.isEmpty()) {
                utils.sendJsonResponse(ex, "{\"error\":\"Gebruiker aanmaken mislukt\"}", 500);
                return;
            }

            utils.sendJsonResponse(ex, result, 201);
        }));
    }

    public void addAccountToUser() {
        server.createContext(conf._EXT_SUPA_USER_ADD_ACCOUNT, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json = utils.parseBody(ex);
            String userId = utils.requireString(json, "userId");
            JsonElement accountEl = json.get("base");

            if (accountEl == null || accountEl.isJsonNull() || !accountEl.isJsonObject()) {
                utils.sendJsonResponse(ex, "{\"error\":\"Veld 'base' moet een object zijn\"}", 400);
                return;
            }

            JsonArray users = JsonParser.parseString(SUPABASE_Client.getWithBody("users", "select=accounts&id=" + SUPABASE_Client.eq(userId))).getAsJsonArray();
            if (users.isEmpty()) {
                utils.sendJsonResponse(ex, "{\"error\":\"Gebruiker niet gevonden\"}", 404);
                return;
            }

            JsonElement accountsEl = users.get(0).getAsJsonObject().get("accounts");
            JsonArray accounts = (accountsEl == null || accountsEl.isJsonNull()) ? new JsonArray() : accountsEl.getAsJsonArray();
            JsonObject newAccount = accountEl.getAsJsonObject();
            String newTag = normalizeTag(readFirstString(newAccount, "tag", "playerTag", "accountTag", "clashTag"));
            if (newTag.isBlank()) {
                utils.sendJsonResponse(ex, "{\"error\":\"Account tag ontbreekt\"}", 400);
                return;
            }
            for (JsonElement existingEl : accounts) {
                if (!existingEl.isJsonObject()) continue;
                String existingTag = normalizeTag(readFirstString(existingEl.getAsJsonObject(), "tag", "playerTag", "accountTag", "clashTag"));
                if (newTag.equals(existingTag)) {
                    utils.sendJsonResponse(ex, "{\"error\":\"Account bestaat al\"}", 409);
                    return;
                }
            }
            newAccount.addProperty("tag", newTag);
            accounts.add(newAccount);

            JsonObject patch = new JsonObject();
            patch.add("accounts", accounts);
            String result = SUPABASE_Client.patch("users", "id=" + SUPABASE_Client.eq(userId), patch.toString());

            utils.sendJsonResponse(ex, result, 200);
        }));
    }

    private String normalizeTag(String value) {
        if (value == null) return "";
        String tag = value.trim().toUpperCase();
        if (tag.isBlank()) return "";
        return tag.startsWith("#") ? tag : "#" + tag;
    }

    private String readFirstString(JsonObject object, String... fields) {
        if (object == null) return "";
        for (String field : fields) {
            JsonElement value = object.get(field);
            if (value != null && !value.isJsonNull()) return value.getAsString();
        }
        return "";
    }
}

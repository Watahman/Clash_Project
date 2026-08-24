package Java;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpServer;
import Java.cache.CacheKeys;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

public class SUPABASE_User {
    private final HttpServer server;
    private final Config conf;
    private final API_Utils utils;
    private final LinkedAccountRepository accounts = new LinkedAccountRepository();

    public SUPABASE_User(HttpServer server, Config conf){
        this.server = server;
        this.conf = conf;
        utils = new API_Utils(conf);
    }

    public void getUserBases() {
        server.createContext(conf._EXT_SUPA_USER_BASES, exchange -> utils.handlePost(exchange, ex -> {
            utils.parseBody(ex);
            String id = utils.requireAuthenticatedUser(ex);
            JsonObject row = new JsonObject();
            row.add("accounts", accounts.listForUser(id));
            JsonArray result = new JsonArray();
            result.add(row);
            utils.sendJsonResponse(ex, result.toString(), 200);
        }));
    }

    public void getUserInfo() {
        server.createContext(conf._EXT_SUPA_USER_INFO, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json = utils.parseBody(ex);
            String actorId = utils.requireAuthenticatedUser(ex);
            String id = utils.requireString(json, "userId");
            if (!actorId.equals(id)) {
                throw new HttpException(403, "{\"error\":\"Geen toegang tot dit gebruikersprofiel\"}");
            }
            String result = SUPABASE_Client.getWithBody(
                    "users",
                    "select=id,name,code,created_at&id=" + SUPABASE_Client.eq(actorId)
            );
            JsonArray users = JsonParser.parseString(result).getAsJsonArray();
            if (users.isEmpty()) {
                utils.sendJsonResponse(ex, "{\"error\":\"Gebruiker niet gevonden\"}", 404);
                return;
            }
            accounts.attachToProfiles(users);
            utils.sendJsonResponse(ex, users.toString(), 200);
        }));
    }

    public void compareUserId() {
        server.createContext(conf._EXT_SUPA_USER_IDCHECK, exchange -> utils.handlePost(exchange, ex -> {
            utils.parseBody(ex);
            String id = utils.requireAuthenticatedUser(ex);

            JsonArray userArray = JsonParser.parseString(SUPABASE_Client.getWithBody(
                    "users", "select=id,name,email,created_at,code&id=" + SUPABASE_Client.eq(id)
            )).getAsJsonArray();
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
            userJson.add("accounts", accounts.listForUser(id));

            utils.sendJsonResponse(ex, userJson.toString(), 200);
        }));
    }

    public void addAccountToUser() {
        server.createContext(conf._EXT_SUPA_USER_ADD_ACCOUNT, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json = utils.parseBody(ex);
            String userId = utils.requireAuthenticatedUser(ex);
            String playerToken = utils.requireString(json, "playerToken").trim();
            JsonElement accountEl = json.get("base");

            if (playerToken.isBlank() || playerToken.length() > 128) {
                utils.sendJsonResponse(ex,
                        "{\"error\":\"Accounttoken ontbreekt\",\"code\":\"ACCOUNT_TOKEN_REQUIRED\"}",
                        400);
                return;
            }
            if (accountEl == null || accountEl.isJsonNull() || !accountEl.isJsonObject()) {
                utils.sendJsonResponse(ex, "{\"error\":\"Veld 'base' moet een object zijn\"}", 400);
                return;
            }

            JsonObject newAccount = accountEl.getAsJsonObject();
            String rawTag = readFirstString(newAccount, "tag", "playerTag", "accountTag", "clashTag");
            if (rawTag.isBlank()) {
                utils.sendJsonResponse(ex, "{\"error\":\"Account tag ontbreekt\"}", 400);
                return;
            }
            String newTag = CacheKeys.requireValidTag(rawTag);

            verifyAccountOwnership(newTag, playerToken);
            newAccount.addProperty("tag", newTag);

            JsonObject rpcBody = new JsonObject();
            rpcBody.addProperty("p_user_id", userId);
            rpcBody.addProperty("p_player_tag", newTag);
            rpcBody.add("p_account", newAccount.deepCopy());

            String result = SUPABASE_Client.rpc(
                    "claim_verified_user_account",
                    rpcBody.toString()
            );
            utils.sendJsonResponse(ex, result, 200);
        }));
    }

    private void verifyAccountOwnership(String playerTag, String playerToken) throws Exception {
        JsonObject verifyBody = new JsonObject();
        verifyBody.addProperty("token", playerToken);

        String response;
        try {
            response = utils.postClashApiResponse(
                    conf.getClashBaseUrl()
                            + "/players/"
                            + URLEncoder.encode(playerTag, StandardCharsets.UTF_8)
                            + "/verifytoken",
                    verifyBody.toString()
            );
        } catch (HttpException error) {
            throw new HttpException(
                    403,
                    "{\"error\":\"Accountverificatie mislukt\",\"code\":\"ACCOUNT_VERIFICATION_FAILED\"}"
            );
        }

        JsonObject verification = JsonParser.parseString(response).getAsJsonObject();
        String status = readFirstString(verification, "status");
        if (!"ok".equalsIgnoreCase(status)) {
            throw new HttpException(
                    403,
                    "{\"error\":\"Accountverificatie mislukt\",\"code\":\"ACCOUNT_VERIFICATION_FAILED\"}"
            );
        }
    }

    public void updateUserName() {
        server.createContext(conf._EXT_SUPA_USER_UPDATE_NAME, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json = utils.parseBody(ex);
            String userId = utils.requireAuthenticatedUser(ex);
            String name = utils.requireString(json, "name").trim();

            if (name.length() < 2 || name.length() > 32) {
                utils.sendJsonResponse(ex, "{\"error\":\"Ongeldige naam\"}", 400);
                return;
            }

            JsonArray users = JsonParser.parseString(SUPABASE_Client.getWithBody("users", "select=id&id=" + SUPABASE_Client.eq(userId))).getAsJsonArray();
            if (users.isEmpty()) {
                utils.sendJsonResponse(ex, "{\"error\":\"Gebruiker niet gevonden\"}", 404);
                return;
            }

            JsonObject patch = new JsonObject();
            patch.addProperty("name", name);
            SUPABASE_Client.patch("users", "id=" + SUPABASE_Client.eq(userId), patch.toString());

            JsonObject response = new JsonObject();
            response.addProperty("success", true);
            response.addProperty("name", name);
            utils.sendJsonResponse(ex, response.toString(), 200);
        }));
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

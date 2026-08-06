package Java;

import Java.achievements.AchievementEvaluator;
import Java.achievements.AchievementProgress;
import Java.achievements.BaseDataSnapshot;
import Java.cache.CacheKeys;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class SUPABASE_Achievements {
    static final String IMPORT_ROUTE = "/AchievementsImport";
    static final String GET_ROUTE = "/Achievements";

    private final HttpServer server;
    private final API_Utils utils;
    private final AchievementEvaluator evaluator = new AchievementEvaluator();

    public SUPABASE_Achievements(HttpServer server, Config conf) {
        this.server = server;
        this.utils = new API_Utils(conf);
    }

    public void registerRoutes() {
        server.createContext(IMPORT_ROUTE, exchange -> utils.handlePost(exchange, this::importBaseData));
        server.createContext(GET_ROUTE, exchange -> utils.handleGet(exchange, this::getAchievements));
    }

    private void importBaseData(HttpExchange exchange) throws Exception {
        JsonObject body = utils.parseBody(exchange);
        String userId = utils.requireAuthenticatedUser(exchange);
        JsonObject baseData = unwrapBaseData(body);
        BaseDataSnapshot snapshot = BaseDataSnapshot.parse(baseData);

        ensureOwnedAccount(userId, snapshot.playerTag());

        List<AchievementProgress> evaluated = evaluator.evaluate(snapshot.metrics());
        JsonArray progressJson = evaluator.toJson(evaluated);
        long unlockedCount = evaluated.stream().filter(AchievementProgress::unlocked).count();

        JsonObject rpcBody = new JsonObject();
        rpcBody.addProperty("p_user_id", userId);
        rpcBody.addProperty("p_player_tag", snapshot.playerTag());
        rpcBody.addProperty("p_source_timestamp", snapshot.sourceTimestamp());
        rpcBody.addProperty("p_checksum", snapshot.checksum());
        rpcBody.add("p_payload", snapshot.payload());
        rpcBody.add("p_metrics", metricsJson(snapshot.metrics()));
        rpcBody.add("p_progress", progressJson);

        String persistenceResult = SUPABASE_Client.rpc("save_achievement_import", rpcBody.toString());

        JsonObject response = new JsonObject();
        response.addProperty("success", true);
        response.addProperty("playerTag", snapshot.playerTag());
        response.addProperty("sourceTimestamp", snapshot.sourceTimestamp());
        response.addProperty("checksum", snapshot.checksum());
        response.addProperty("unlockedCount", unlockedCount);
        response.addProperty("achievementCount", evaluated.size());
        response.add("metrics", metricsJson(snapshot.metrics()));
        response.add("achievements", progressJson);
        response.add("persistence", parseAnyJson(persistenceResult));
        utils.sendJsonResponse(exchange, response.toString(), 200);
    }

    private void getAchievements(HttpExchange exchange) throws Exception {
        String userId = utils.requireAuthenticatedUser(exchange);
        String playerTag = CacheKeys.requireValidTag(requiredQueryParameter(exchange, "playerTag"));
        ensureOwnedAccount(userId, playerTag);

        String userFilter = "user_id=" + SUPABASE_Client.eq(userId);
        String tagFilter = "player_tag=" + SUPABASE_Client.eq(playerTag);

        String progress = SUPABASE_Client.getWithBody(
                "achievement_progress",
                "select=achievement_key,family_key,title,description,category,rarity,tier,xp,metric,progress,target,unlocked,unlocked_at,updated_at"
                        + "&" + userFilter + "&" + tagFilter + "&order=category.asc,family_key.asc,tier.asc"
        );
        String snapshots = SUPABASE_Client.getWithBody(
                "achievement_base_snapshots",
                "select=source_timestamp,imported_at,checksum,metrics"
                        + "&" + userFilter + "&" + tagFilter + "&order=source_timestamp.desc&limit=1"
        );

        JsonObject response = new JsonObject();
        response.addProperty("playerTag", playerTag);
        response.add("achievements", JsonParser.parseString(progress));
        response.add("latestSnapshot", firstOrNull(snapshots));
        utils.sendJsonResponse(exchange, response.toString(), 200);
    }

    private JsonObject unwrapBaseData(JsonObject body) {
        JsonElement nested = body.get("baseData");
        if (nested == null) return body;
        if (!nested.isJsonObject()) throw new IllegalArgumentException("Veld 'baseData' moet een JSON-object zijn");
        return nested.getAsJsonObject();
    }

    private void ensureOwnedAccount(String userId, String playerTag) throws Exception {
        String result = SUPABASE_Client.getWithBody(
                "users",
                "select=accounts&id=" + SUPABASE_Client.eq(userId) + "&limit=1"
        );
        JsonArray users = JsonParser.parseString(result).getAsJsonArray();
        if (users.isEmpty()) throw new HttpException(404, "{\"error\":\"Gebruiker niet gevonden\"}");

        JsonElement accounts = users.get(0).getAsJsonObject().get("accounts");
        if (!containsPlayerTag(accounts, playerTag)) {
            throw new HttpException(
                    403,
                    "{\"error\":\"Deze speler is niet als geverifieerd account gekoppeld\",\"code\":\"ACCOUNT_NOT_LINKED\"}"
            );
        }
    }

    private boolean containsPlayerTag(JsonElement element, String playerTag) {
        if (element == null || element.isJsonNull()) return false;
        if (element.isJsonPrimitive() && element.getAsJsonPrimitive().isString()) {
            try {
                return playerTag.equals(CacheKeys.requireValidTag(element.getAsString()));
            } catch (IllegalArgumentException ignored) {
                return false;
            }
        }
        if (element.isJsonArray()) {
            for (JsonElement child : element.getAsJsonArray()) {
                if (containsPlayerTag(child, playerTag)) return true;
            }
            return false;
        }
        if (!element.isJsonObject()) return false;

        JsonObject object = element.getAsJsonObject();
        for (String key : List.of("tag", "playerTag", "accountTag", "clashTag")) {
            if (object.has(key) && containsPlayerTag(object.get(key), playerTag)) return true;
        }
        return false;
    }

    private String requiredQueryParameter(HttpExchange exchange, String name) {
        Map<String, String> parameters = queryParameters(exchange.getRequestURI().getRawQuery());
        String value = parameters.get(name);
        if (value == null || value.isBlank()) throw new IllegalArgumentException("Queryparameter ontbreekt: " + name);
        return value;
    }

    private Map<String, String> queryParameters(String query) {
        Map<String, String> result = new HashMap<>();
        if (query == null || query.isBlank()) return result;
        for (String pair : query.split("&")) {
            String[] parts = pair.split("=", 2);
            String key = URLDecoder.decode(parts[0], StandardCharsets.UTF_8);
            String value = parts.length > 1 ? URLDecoder.decode(parts[1], StandardCharsets.UTF_8) : "";
            result.put(key, value);
        }
        return result;
    }

    private JsonObject metricsJson(Map<String, Long> metrics) {
        JsonObject result = new JsonObject();
        metrics.forEach(result::addProperty);
        return result;
    }

    private JsonElement parseAnyJson(String value) {
        if (value == null || value.isBlank()) return new JsonObject();
        return JsonParser.parseString(value);
    }

    private JsonElement firstOrNull(String jsonArray) {
        JsonArray values = JsonParser.parseString(jsonArray).getAsJsonArray();
        return values.isEmpty() ? com.google.gson.JsonNull.INSTANCE : values.get(0);
    }
}

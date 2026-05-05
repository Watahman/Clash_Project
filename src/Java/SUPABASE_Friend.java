package Java;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpServer;

public class SUPABASE_Friend {
    private HttpServer server;
    private Config conf;
    private final API_Utils utils;

    public SUPABASE_Friend(HttpServer server, Config conf){
        this.server = server;
        this.conf = conf;
        utils = new API_Utils(conf);
    }

    public void addFriend(){
        server.createContext(conf._EXT_SUPA_USER_ADD_FRIEND, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    String body = new String(exchange.getRequestBody().readAllBytes());
                    JsonObject json = JsonParser.parseString(body).getAsJsonObject();

                    String userId = json.get("userId").getAsString();
                    String friendCode = json.get("friendCode").getAsString();

                    String friendResult = SUPABASE_Client.getWithBody("users", "code=eq." + friendCode + "&select=id");
                    JsonArray users = JsonParser.parseString(friendResult).getAsJsonArray();

                    if (users.isEmpty()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"user not found\"}", 404);
                        return;
                    }

                    String friendId = users.get(0).getAsJsonObject().get("id").getAsString();
                    JsonObject friend = new JsonObject();
                    friend.addProperty("user_a", userId);
                    friend.addProperty("user_b", friendId);
                    friend.addProperty("status", "pending");

                    String result = SUPABASE_Client.post("friends", friend.toString());

                    utils.sendJsonResponse(exchange, String.valueOf(result), 200);
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

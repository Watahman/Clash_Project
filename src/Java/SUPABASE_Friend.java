package Java;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpServer;

import java.util.HashSet;
import java.util.Set;

public class SUPABASE_Friend {
    private final HttpServer server;
    private final Config conf;
    private final API_Utils utils;

    public SUPABASE_Friend(HttpServer server, Config conf){
        this.server = server;
        this.conf = conf;
        utils = new API_Utils(conf);
    }

    public void addFriend() {
        server.createContext(conf._EXT_SUPA_USER_ADD_FRIEND, exchange -> utils.handlePost(exchange, ex -> {
            String userId = utils.requireAuthenticatedUser(ex);
            JsonObject json   = utils.parseBody(ex);
            String friendCode = utils.requireString(json, "friendCode").replace("#", "").trim();

            JsonArray users = JsonParser.parseString(
                    SUPABASE_Client.getWithBody("users", "code=" + SUPABASE_Client.eq(friendCode) + "&select=id")).getAsJsonArray();

            if (users.isEmpty()) {
                utils.sendJsonResponse(ex, "{\"error\":\"Gebruiker niet gevonden met code: " + API_Utils.escapeJson(friendCode) + "\"}", 404);
                return;
            }

            String friendId = users.get(0).getAsJsonObject().get("id").getAsString();

            if (friendId.equals(userId)) {
                utils.sendJsonResponse(ex, "{\"error\":\"Je kan jezelf niet toevoegen als vriend\"}", 400);
                return;
            }

            JsonArray existing = JsonParser.parseString(SUPABASE_Client.getWithBody("friends",
                    "or=(and(user_a.eq." + userId + ",user_b.eq." + friendId + "),and(user_a.eq." + friendId + ",user_b.eq." + userId + "))&select=user_a")).getAsJsonArray();
            if (!existing.isEmpty()) {
                utils.sendJsonResponse(ex, "{\"error\":\"Vriend of verzoek bestaat al\"}", 409);
                return;
            }

            JsonObject friend = new JsonObject();
            friend.addProperty("user_a",  userId);
            friend.addProperty("user_b",  friendId);
            friend.addProperty("status",  "pending");

            String result = SUPABASE_Client.post("friends", friend.toString());
            utils.sendJsonResponse(ex, result, 200);
        }));
    }

    public void getPendingRequests() {
        server.createContext(conf._EXT_SUPA_USER_GET_PENDING_FRIENDS, exchange -> utils.handlePost(exchange, ex -> {
            String userId = utils.requireAuthenticatedUser(ex);
            utils.parseBody(ex);
            String result   = SUPABASE_Client.getWithBody("friends",
                    "user_a=" + SUPABASE_Client.eq(userId) + "&status=eq.pending&select=user_b,status");
            utils.sendJsonResponse(ex, result, 200);
        }));
    }

    public void getFriendRequests() {
        server.createContext(conf._EXT_SUPA_USER_GET_FRIEND_REQUESTS, exchange -> utils.handlePost(exchange, ex -> {
            String userId = utils.requireAuthenticatedUser(ex);
            utils.parseBody(ex);
            String result   = SUPABASE_Client.getWithBody("friends",
                    "user_b=" + SUPABASE_Client.eq(userId) + "&status=eq.pending&select=user_a,status");
            utils.sendJsonResponse(ex, result, 200);
        }));
    }

    public void getFriends() {
        server.createContext(conf._EXT_SUPA_USER_GET_FRIENDS, exchange -> utils.handlePost(exchange, ex -> {
            String userId = utils.requireAuthenticatedUser(ex);
            utils.parseBody(ex);

            JsonArray resultsA = JsonParser.parseString(SUPABASE_Client.getWithBody("friends",
                    "user_a=" + SUPABASE_Client.eq(userId) + "&status=eq.accepted&select=user_b,status")).getAsJsonArray();
            JsonArray resultsB = JsonParser.parseString(SUPABASE_Client.getWithBody("friends",
                    "user_b=" + SUPABASE_Client.eq(userId) + "&status=eq.accepted&select=user_a,status")).getAsJsonArray();

            JsonArray combined = new JsonArray();
            Set<String> seen   = new HashSet<>();

            for (JsonElement e : resultsA) {
                String friendId = e.getAsJsonObject().get("user_b").getAsString();
                if (seen.add(friendId)) {
                    JsonObject entry = new JsonObject();
                    entry.addProperty("user_a", userId);
                    entry.addProperty("user_b", friendId);
                    entry.addProperty("status", e.getAsJsonObject().get("status").getAsString());
                    combined.add(entry);
                }
            }

            for (JsonElement e : resultsB) {
                String friendId = e.getAsJsonObject().get("user_a").getAsString();
                if (seen.add(friendId)) {
                    JsonObject entry = new JsonObject();
                    entry.addProperty("user_a", userId);
                    entry.addProperty("user_b", friendId);
                    entry.addProperty("status", e.getAsJsonObject().get("status").getAsString());
                    combined.add(entry);
                }
            }

            utils.sendJsonResponse(ex, combined.toString(), 200);
        }));
    }

    public void acceptFriend() {
        server.createContext(conf._EXT_SUPA_USER_ACCEPT_FRIEND, exchange -> utils.handlePost(exchange, ex -> {
            String userId = utils.requireAuthenticatedUser(ex);
            JsonObject json = utils.parseBody(ex);
            String friendId = utils.requireString(json, "friendId");

            JsonObject patch = new JsonObject();
            patch.addProperty("status", "accepted");

            boolean addressedToActor = !JsonParser.parseString(SUPABASE_Client.getWithBody("friends",
                    "user_a=" + SUPABASE_Client.eq(friendId)
                            + "&user_b=" + SUPABASE_Client.eq(userId)
                            + "&status=eq.pending&select=user_a")).getAsJsonArray().isEmpty();

            if (!addressedToActor) {
                utils.sendJsonResponse(ex, "{\"error\":\"Vriendverzoek niet gevonden\"}", 404);
                return;
            }
            SUPABASE_Client.patch("friends",
                    "user_a=" + SUPABASE_Client.eq(friendId)
                            + "&user_b=" + SUPABASE_Client.eq(userId)
                            + "&status=eq.pending",
                    patch.toString());

            utils.sendJsonResponse(ex, "{\"success\":true}", 200);
        }));
    }

    public void rejectFriend() {
        server.createContext(conf._EXT_SUPA_USER_REJECT_FRIEND, exchange -> utils.handlePost(exchange, ex -> {
            String userId = utils.requireAuthenticatedUser(ex);
            JsonObject json = utils.parseBody(ex);
            String friendId = utils.requireString(json, "friendId");

            boolean addressedToActor = !JsonParser.parseString(SUPABASE_Client.getWithBody("friends",
                    "user_a=" + SUPABASE_Client.eq(friendId)
                            + "&user_b=" + SUPABASE_Client.eq(userId)
                            + "&status=eq.pending&select=user_a")).getAsJsonArray().isEmpty();

            if (!addressedToActor) {
                utils.sendJsonResponse(ex, "{\"error\":\"Vriendverzoek niet gevonden\"}", 404);
                return;
            }
            SUPABASE_Client.deleteColumn("friends",
                    "user_a=" + SUPABASE_Client.eq(friendId)
                            + "&user_b=" + SUPABASE_Client.eq(userId)
                            + "&status=eq.pending");

            utils.sendJsonResponse(ex, "{\"success\":true}", 200);
        }));
    }
}

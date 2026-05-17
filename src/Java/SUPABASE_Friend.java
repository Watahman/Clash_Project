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

                    if (body.isBlank()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Request body is leeg\"}", 400);
                        return;
                    }

                    JsonObject json = JsonParser.parseString(body).getAsJsonObject();
                    JsonElement userIdEl     = json.get("userId");
                    JsonElement friendCodeEl = json.get("friendCode");

                    if (userIdEl == null || userIdEl.isJsonNull() || friendCodeEl == null || friendCodeEl.isJsonNull()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Verplichte velden ontbreken: userId, friendCode\"}", 400);
                        return;
                    }

                    String userId     = userIdEl.getAsString();
                    String friendCode = friendCodeEl.getAsString();

                    String friendResult = SUPABASE_Client.getWithBody("users", "code=eq." + friendCode + "&select=id");
                    JsonArray users = JsonParser.parseString(friendResult).getAsJsonArray();

                    if (users.isEmpty()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Gebruiker niet gevonden met code: " + friendCode + "\"}", 404);
                        return;
                    }

                    String friendId = users.get(0).getAsJsonObject().get("id").getAsString();

                    if (friendId.equals(userId)) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Je kan jezelf niet toevoegen als vriend\"}", 400);
                        return;
                    }

                    JsonObject friend = new JsonObject();
                    friend.addProperty("user_a", userId);
                    friend.addProperty("user_b", friendId);
                    friend.addProperty("status", "pending");

                    String result = SUPABASE_Client.post("friends", friend.toString());
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
                        utils.sendJsonResponse(exchange, "{\"error\":\"Vriend toevoegen mislukt\"}", 500);
                    } catch (Exception ex) {
                        ex.printStackTrace();
                    }
                }
            }
        });
    }

    public void getPendingRequests(){
        server.createContext(conf._EXT_SUPA_USER_GET_PENDING_FRIENDS, exchange -> {
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
                    JsonElement userIdEl = json.get("userId");

                    if (userIdEl == null || userIdEl.isJsonNull()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Verplicht veld ontbreekt: userId\"}", 400);
                        return;
                    }

                    String userId = userIdEl.getAsString();
                    String result = SUPABASE_Client.getWithBody("friends",
                            "user_a=eq." + userId + "&status=eq.pending&select=user_b,status");

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
                        utils.sendJsonResponse(exchange, "{\"error\":\"Ophalen pending requests mislukt\"}", 500);
                    } catch (Exception ex) {
                        ex.printStackTrace();
                    }
                }
            }
        });
    }

    public void getFriendRequests(){
        server.createContext(conf._EXT_SUPA_USER_GET_FRIEND_REQUESTS, exchange -> {
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
                    JsonElement userIdEl = json.get("userId");

                    if (userIdEl == null || userIdEl.isJsonNull()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Verplicht veld ontbreekt: userId\"}", 400);
                        return;
                    }

                    String userId = userIdEl.getAsString();
                    String result = SUPABASE_Client.getWithBody("friends",
                            "user_b=eq." + userId + "&status=eq.pending&select=user_a,status");

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
                        utils.sendJsonResponse(exchange, "{\"error\":\"Ophalen vriendverzoeken mislukt\"}", 500);
                    } catch (Exception ex) {
                        ex.printStackTrace();
                    }
                }
            }
        });
    }

    public void getFriends(){
        server.createContext(conf._EXT_SUPA_USER_GET_FRIENDS, exchange -> {
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
                    JsonElement userIdEl = json.get("userId");

                    if (userIdEl == null || userIdEl.isJsonNull()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Verplicht veld ontbreekt: userId\"}", 400);
                        return;
                    }

                    String userId = userIdEl.getAsString();

                    String checkA = SUPABASE_Client.getWithBody("friends",
                            "user_a=eq." + userId + "&status=eq.accepted&select=user_b,status");
                    String checkB = SUPABASE_Client.getWithBody("friends",
                            "user_b=eq." + userId + "&status=eq.accepted&select=user_a,status");

                    JsonArray resultsA = JsonParser.parseString(checkA).getAsJsonArray();
                    JsonArray resultsB = JsonParser.parseString(checkB).getAsJsonArray();

                    JsonArray combined = new JsonArray();
                    Set<String> seen = new HashSet<>();

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

                    utils.sendJsonResponse(exchange, combined.toString(), 200);

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
                        utils.sendJsonResponse(exchange, "{\"error\":\"Ophalen vrienden mislukt\"}", 500);
                    } catch (Exception ex) {
                        ex.printStackTrace();
                    }
                }
            }
        });
    }

    public void acceptFriend(){
        server.createContext(conf._EXT_SUPA_USER_ACCEPT_FRIEND, exchange -> {
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
                    JsonElement userIdEl   = json.get("userId");
                    JsonElement friendIdEl = json.get("friendId");

                    if (userIdEl == null || userIdEl.isJsonNull() || friendIdEl == null || friendIdEl.isJsonNull()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Verplichte velden ontbreken: userId, friendId\"}", 400);
                        return;
                    }

                    String userId   = userIdEl.getAsString();
                    String friendId = friendIdEl.getAsString();

                    String checkA = SUPABASE_Client.getWithBody("friends",
                            "user_a=eq." + userId + "&user_b=eq." + friendId + "&select=user_a");
                    String checkB = SUPABASE_Client.getWithBody("friends",
                            "user_a=eq." + friendId + "&user_b=eq." + userId + "&select=user_a");

                    JsonObject patch = new JsonObject();
                    patch.addProperty("status", "accepted");

                    if (!JsonParser.parseString(checkA).getAsJsonArray().isEmpty()) {
                        SUPABASE_Client.patch("friends",
                                "user_a=eq." + userId + "&user_b=eq." + friendId, patch.toString());
                    } else if (!JsonParser.parseString(checkB).getAsJsonArray().isEmpty()) {
                        SUPABASE_Client.patch("friends",
                                "user_a=eq." + friendId + "&user_b=eq." + userId, patch.toString());
                    } else {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Vriendverzoek niet gevonden\"}", 404);
                        return;
                    }

                    utils.sendJsonResponse(exchange, "{\"success\":true}", 200);

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
                        utils.sendJsonResponse(exchange, "{\"error\":\"Vriend accepteren mislukt\"}", 500);
                    } catch (Exception ex) {
                        ex.printStackTrace();
                    }
                }
            }
        });
    }

    public void rejectFriend(){
        server.createContext(conf._EXT_SUPA_USER_REJECT_FRIEND, exchange -> {
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
                    JsonElement userIdEl   = json.get("userId");
                    JsonElement friendIdEl = json.get("friendId");

                    if (userIdEl == null || userIdEl.isJsonNull() || friendIdEl == null || friendIdEl.isJsonNull()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Verplichte velden ontbreken: userId, friendId\"}", 400);
                        return;
                    }

                    String userId   = userIdEl.getAsString();
                    String friendId = friendIdEl.getAsString();

                    String checkA = SUPABASE_Client.getWithBody("friends",
                            "user_a=eq." + userId + "&user_b=eq." + friendId + "&select=user_a");
                    String checkB = SUPABASE_Client.getWithBody("friends",
                            "user_a=eq." + friendId + "&user_b=eq." + userId + "&select=user_a");

                    if (!JsonParser.parseString(checkA).getAsJsonArray().isEmpty()) {
                        SUPABASE_Client.deleteColumn("friends",
                                "user_a=eq." + userId + "&user_b=eq." + friendId);
                    } else if (!JsonParser.parseString(checkB).getAsJsonArray().isEmpty()) {
                        SUPABASE_Client.deleteColumn("friends",
                                "user_a=eq." + friendId + "&user_b=eq." + userId);
                    } else {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Vriendverzoek niet gevonden\"}", 404);
                        return;
                    }

                    utils.sendJsonResponse(exchange, "{\"success\":true}", 200);

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
                        utils.sendJsonResponse(exchange, "{\"error\":\"Vriend weigeren mislukt\"}", 500);
                    } catch (Exception ex) {
                        ex.printStackTrace();
                    }
                }
            }
        });
    }
}
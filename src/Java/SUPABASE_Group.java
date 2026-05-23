package Java;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpServer;

import java.util.Objects;

public class SUPABASE_Group {
    private final HttpServer server;
    private final Config conf;
    private final API_Utils utils;

    public SUPABASE_Group(HttpServer server, Config conf){
        this.server = server;
        this.conf = conf;
        utils = new API_Utils(conf);
    }

    public void createGroup(){
        server.createContext(conf._EXT_SUPA_GROUP_MAKE, exchange -> {
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
                    JsonElement nameEl    = json.get("name");
                    JsonElement ownerEl   = json.get("ownerId");

                    if (nameEl == null || nameEl.isJsonNull() || ownerEl == null || ownerEl.isJsonNull()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Verplichte velden ontbreken: name, ownerId\"}", 400);
                        return;
                    }

                    String naam    = nameEl.getAsString();
                    String ownerId = ownerEl.getAsString();
                    String code    = API_Utils.generateCode();

                    JsonObject group = new JsonObject();
                    group.addProperty("name", naam);
                    group.addProperty("owner_id", ownerId);
                    group.addProperty("code", code);

                    String result = SUPABASE_Client.post("groups", group.toString());
                    JsonArray resultArray = JsonParser.parseString(result).getAsJsonArray();

                    if (resultArray.isEmpty()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Groep aanmaken mislukt\"}", 500);
                        return;
                    }

                    String id = resultArray.get(0).getAsJsonObject().get("id").getAsString();

                    JsonObject groupMember = new JsonObject();
                    groupMember.addProperty("group_id", id);
                    groupMember.addProperty("user_id", ownerId);
                    SUPABASE_Client.post("group_members", groupMember.toString());

                    utils.sendJsonResponse(exchange, result, 201);

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
                        utils.sendJsonResponse(exchange, "{\"error\":\"Groep aanmaken mislukt\"}", 500);
                    } catch (Exception ex) {
                        ex.printStackTrace();
                    }
                }
            }
        });
    }

    public void getUserGroups(){
        server.createContext(conf._EXT_SUPA_USER_GROUPS, exchange -> {
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
                    JsonElement idEl = json.get("userId");

                    if (idEl == null || idEl.isJsonNull()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Verplicht veld ontbreekt: id\"}", 400);
                        return;
                    }

                    String id = idEl.getAsString();
                    String result = SUPABASE_Client.getWithBody("group_members", "user_id=eq." + id);
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
                        utils.sendJsonResponse(exchange, "{\"error\":\"Ophalen groepen mislukt\"}", 500);
                    } catch (Exception ex) {
                        ex.printStackTrace();
                    }
                }
            }
        });
    }

    public void getGroupInfo(){
        server.createContext(conf._EXT_SUPA_GROUP_INFO, exchange -> {
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
                    JsonElement idEl = json.get("groupId");

                    if (idEl == null || idEl.isJsonNull()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Verplicht veld ontbreekt: id\"}", 400);
                        return;
                    }

                    String id = idEl.getAsString();
                    String result = SUPABASE_Client.getWithBody("groups", "id=eq." + id);

                    JsonArray resultArray = JsonParser.parseString(result).getAsJsonArray();
                    if (resultArray.isEmpty()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Groep niet gevonden\"}", 404);
                        return;
                    }

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
                        utils.sendJsonResponse(exchange, "{\"error\":\"Ophalen groepinfo mislukt\"}", 500);
                    } catch (Exception ex) {
                        ex.printStackTrace();
                    }
                }
            }
        });
    }

    public void getGroupMembers(){
        server.createContext(conf._EXT_SUPA_GROUP_MEMBERS, exchange -> {
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
                    JsonElement idEl = json.get("id");

                    if (idEl == null || idEl.isJsonNull()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Verplicht veld ontbreekt: id\"}", 400);
                        return;
                    }

                    String id = idEl.getAsString();
                    String result = SUPABASE_Client.getWithBody("group_members", "group_id=eq." + id);
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
                        utils.sendJsonResponse(exchange, "{\"error\":\"Ophalen leden mislukt\"}", 500);
                    } catch (Exception ex) {
                        ex.printStackTrace();
                    }
                }
            }
        });
    }

    public void joinGroup(){
        server.createContext(conf._EXT_SUPA_GROUP_JOIN, exchange -> {
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
                    JsonElement idEl   = json.get("userId");
                    JsonElement codeEl = json.get("groupCode");

                    if (idEl == null || idEl.isJsonNull() || codeEl == null || codeEl.isJsonNull()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Verplichte velden ontbreken: id, code\"}", 400);
                        return;
                    }

                    String userId = idEl.getAsString();
                    String code   = codeEl.getAsString().trim();

                    String getGroup = SUPABASE_Client.getWithBody("groups", "code=eq." + code);
                    JsonArray getGroupArray = JsonParser.parseString(getGroup).getAsJsonArray();

                    if (getGroupArray.isEmpty()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Groep niet gevonden met code: " + code + "\"}", 404);
                        return;
                    }

                    String groupId = getGroupArray.get(0).getAsJsonObject().get("id").getAsString();

                    JsonObject group = new JsonObject();
                    group.addProperty("user_id", userId);
                    group.addProperty("group_id", groupId);

                    String addMemberResult = SUPABASE_Client.post("group_members", group.toString());
                    utils.sendJsonResponse(exchange, addMemberResult, 201);

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
                        utils.sendJsonResponse(exchange, "{\"error\":\"Groep joinen mislukt\"}", 500);
                    } catch (Exception ex) {
                        ex.printStackTrace();
                    }
                }
            }
        });
    }

    public void leaveGroup(){
        server.createContext(conf._EXT_SUPA_GROUP_LEAVE, exchange -> {
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
                    JsonElement idEl   = json.get("userId");
                    JsonElement codeEl = json.get("groupCode");

                    if (idEl == null || idEl.isJsonNull() || codeEl == null || codeEl.isJsonNull()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Verplichte velden ontbreken: id, code\"}", 400);
                        return;
                    }

                    String userId = idEl.getAsString();
                    String code   = codeEl.getAsString().trim();

                    String getGroup = SUPABASE_Client.getWithBody("groups", "code=eq." + code);
                    JsonArray getGroupArray = JsonParser.parseString(getGroup).getAsJsonArray();

                    if (getGroupArray.isEmpty()) {
                        utils.sendJsonResponse(exchange, "{\"error\":\"Groep niet gevonden met code: " + code + "\"}", 404);
                        return;
                    }

                    JsonObject groupObj = getGroupArray.get(0).getAsJsonObject();
                    String groupId = groupObj.get("id").getAsString();

                    String removeMemberResult = SUPABASE_Client.deleteColumn("group_members", "group_id=eq." + groupId + "&user_id=eq." + userId);

                    // Als de vertrekkende user de owner is, verwijder de hele groep
                    JsonElement ownerEl = groupObj.get("owner_id");
                    if (ownerEl != null && Objects.equals(ownerEl.getAsString(), userId)) {
                        SUPABASE_Client.deleteColumn("groups", "id=eq." + groupId);
                    }

                    utils.sendJsonResponse(exchange, removeMemberResult, 200);

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
                        utils.sendJsonResponse(exchange, "{\"error\":\"Groep verlaten mislukt\"}", 500);
                    } catch (Exception ex) {
                        ex.printStackTrace();
                    }
                }
            }
        });
    }
}
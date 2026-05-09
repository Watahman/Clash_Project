package Java;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpServer;

public class SUPABASE_Group {
    private HttpServer server;
    private Config conf;
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
                    JsonObject json = JsonParser.parseString(body).getAsJsonObject();

                    String naam = json.get("name").getAsString();
                    String ownerId = json.get("ownerId").getAsString();
                    String code = API_Utils.generateCode();

                    JsonObject group = new JsonObject();
                    group.addProperty("name", naam);
                    group.addProperty("owner_id", ownerId);
                    group.addProperty("code", code);

                    String result = SUPABASE_Client.post("groups", group.toString());

                    JsonArray resultArray = JsonParser.parseString(result).getAsJsonArray();
                    String id = resultArray.get(0).getAsJsonObject().get("id").getAsString();

                    JsonObject groupMember = new JsonObject();
                    groupMember.addProperty("group_id", id);
                    groupMember.addProperty("user_id", ownerId);

                    String addMemberResult = SUPABASE_Client.post("group_members", groupMember.toString());

                    System.out.println(result);
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

    public void getUserGroups(){
        server.createContext(conf._EXT_SUPA_GROUP_MEMBER, exchange -> {
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

                    String result = SUPABASE_Client.getWithBody("group_members", "user_id=eq." + id);
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
                    JsonObject json = JsonParser.parseString(body).getAsJsonObject();

                    String id = json.get("id").getAsString();

                    String result = SUPABASE_Client.getWithBody("groups", "id=eq." + id);
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
                    JsonObject json = JsonParser.parseString(body).getAsJsonObject();
                    String id = json.get("id").getAsString();

                    String result = SUPABASE_Client.getWithBody("group_members", "group_id=eq." + id);
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
                    JsonObject json = JsonParser.parseString(body).getAsJsonObject();

                    String userId = json.get("id").getAsString();
                    String code = json.get("code").getAsString();

                    String getGroup = SUPABASE_Client.getWithBody("groups", "code=eq." + code);

                    JsonArray getGroupArray = JsonParser.parseString(getGroup).getAsJsonArray();
                    String groupId = getGroupArray.get(0).getAsJsonObject().get("id").getAsString();

                    JsonObject group = new JsonObject();
                    group.addProperty("user_id", userId);
                    group.addProperty("group_id", groupId);

                    String addMemberResult = SUPABASE_Client.post("group_members", group.toString());
                    utils.sendJsonResponse(exchange, addMemberResult, 201);
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
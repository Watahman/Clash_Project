package Java;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpServer;

public class SUPABASE_CWLPlanner {
    private HttpServer server;
    private Config conf;
    private final API_Utils utils;

    public SUPABASE_CWLPlanner(HttpServer server, Config conf){
        this.server = server;
        this.conf = conf;
        utils = new API_Utils(conf);
    }

    public void saveCWLPlanner(){
        server.createContext(conf._EXT_SUPA_CWLPLANNER_DATA_SET, exchange -> {
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
                    String planName = json.get("name").getAsString();
                    JsonArray clans = json.get("clans").getAsJsonArray();

                    JsonObject plan = new JsonObject();
                    plan.addProperty("name", planName);
                    plan.add("info", clans);
                    plan.addProperty("owner_id", userId);

                    String planResult = SUPABASE_Client.post("plans", plan.toString());
                    JsonArray planArray = JsonParser.parseString(planResult).getAsJsonArray();
                    String planId = planArray.get(0).getAsJsonObject().get("id").getAsString();


                    JsonObject link = new JsonObject();
                    link.addProperty("plan_id", planId);
                    link.addProperty("user_id", userId);

                    String linkResult = SUPABASE_Client.post("plan_users", link.toString());

                    utils.sendJsonResponse(exchange, "{\"success\":true, \"plan_id\":\"" + planId + "\"}", 200);

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

    public void getAllPlanners(){
        server.createContext(conf._EXT_SUPA_CWLPLANNER_DATA_GET_ALL, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    String body = new String(exchange.getRequestBody().readAllBytes());
                    JsonObject json = JsonParser.parseString(body).getAsJsonObject();

                    String userId = json.get("user").getAsString();

                    String userPlanIds = SUPABASE_Client.getWithBody("plan_users", "select=plan_id&user_id=eq."+ userId);

                    JsonArray userPlanIdArray = JsonParser.parseString(userPlanIds).getAsJsonArray();
                    JsonArray planNames = new JsonArray();

                    for (JsonElement element : userPlanIdArray) {
                        String planId = element.getAsJsonObject().get("plan_id").getAsString();
                        String planResult = SUPABASE_Client.getWithBody("plans", "select=name&id=eq." + planId);

                        JsonArray planArray = JsonParser.parseString(planResult).getAsJsonArray();
                        if (!planArray.isEmpty()) {
                            String name = planArray.get(0).getAsJsonObject().get("name").getAsString();
                            planNames.add(name);
                        }
                    }

                    utils.sendJsonResponse(exchange, String.valueOf(planNames), 200);
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

    public void getPlanner(){
        server.createContext(conf._EXT_SUPA_CWLPLANNER_DATA_GET, exchange -> {
            utils.addCORS(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                try {
                    String body = new String(exchange.getRequestBody().readAllBytes());
                    JsonObject json = JsonParser.parseString(body).getAsJsonObject();

                    String name = json.get("name").getAsString();

                    String result = SUPABASE_Client.getWithBody("plans", "name=eq." + name);
                    JsonArray planArray = JsonParser.parseString(result).getAsJsonArray();
                    JsonObject plan = planArray.get(0).getAsJsonObject();

                    JsonObject planInfo = new JsonObject();
                    planInfo.addProperty("name", plan.get("name").getAsString());
                    planInfo.add("info", plan.get("info").getAsJsonArray());

                    utils.sendJsonResponse(exchange, planInfo.toString(), 200);
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
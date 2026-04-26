package Java;

import com.google.gson.JsonArray;
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

    public void createCWLPlanner(){
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
}
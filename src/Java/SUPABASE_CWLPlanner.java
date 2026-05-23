package Java;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpServer;

public class SUPABASE_CWLPlanner {
    private final HttpServer server;
    private final Config conf;
    private final API_Utils utils;

    public SUPABASE_CWLPlanner(HttpServer server, Config conf){
        this.server = server;
        this.conf = conf;
        utils = new API_Utils(conf);
    }

    public void saveCWLPlanner() {
        server.createContext(conf._EXT_SUPA_CWLPLANNER_DATA_SET, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json  = utils.parseBody(ex);
            String userId    = utils.requireString(json, "userId");
            String planName  = utils.requireString(json, "name");
            JsonArray clans  = utils.requireArray(json, "planInfo");

            JsonElement planIdEl = json.get("planId");
            String plannerId     = (planIdEl != null && !planIdEl.isJsonNull()) ? planIdEl.getAsString() : "";

            String planId;

            if (!plannerId.isEmpty() && !plannerId.equals("undefined")) {
                JsonElement planExistsEl = JsonParser.parseString(
                        SUPABASE_Client.getWithBody("plans", "id=eq." + plannerId));

                if (!planExistsEl.isJsonArray() || planExistsEl.getAsJsonArray().isEmpty()) {
                    utils.sendJsonResponse(ex, "{\"error\":\"Plan niet gevonden met id: " + plannerId + "\"}", 404);
                    return;
                }

                JsonObject editPlan = new JsonObject();
                editPlan.add("info", clans);
                editPlan.addProperty("name", planName);

                JsonArray planArray = JsonParser.parseString(
                        SUPABASE_Client.patch("plans", "id=eq." + plannerId, editPlan.toString())).getAsJsonArray();

                if (planArray.isEmpty()) {
                    utils.sendJsonResponse(ex, "{\"error\":\"Plan updaten mislukt\"}", 500);
                    return;
                }

                planId = planArray.get(0).getAsJsonObject().get("id").getAsString();
            } else {
                JsonObject plan = new JsonObject();
                plan.addProperty("name",     planName);
                plan.add("info",             clans);
                plan.addProperty("owner_id", userId);

                JsonArray planArray = JsonParser.parseString(
                        SUPABASE_Client.post("plans", plan.toString())).getAsJsonArray();

                if (planArray.isEmpty()) {
                    utils.sendJsonResponse(ex, "{\"error\":\"Plan aanmaken mislukt\"}", 500);
                    return;
                }

                planId = planArray.get(0).getAsJsonObject().get("id").getAsString();

                JsonObject link = new JsonObject();
                link.addProperty("plan_id", planId);
                link.addProperty("user_id", userId);
                SUPABASE_Client.post("plan_users", link.toString());
            }

            utils.sendJsonResponse(ex, "{\"success\":true, \"uuid\": \"" + planId + "\"}", 200);
        }));
    }

    public void getAllPlanners() {
        server.createContext(conf._EXT_SUPA_CWLPLANNER_DATA_GET_ALL, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json = utils.parseBody(ex);
            String userId   = utils.requireString(json, "userId");

            JsonArray userPlanIds = JsonParser.parseString(
                    SUPABASE_Client.getWithBody("plan_users", "select=plan_id&user_id=eq." + userId)).getAsJsonArray();

            JsonArray planNames = new JsonArray();
            for (JsonElement element : userPlanIds) {
                String planId   = element.getAsJsonObject().get("plan_id").getAsString();
                JsonArray plans = JsonParser.parseString(
                        SUPABASE_Client.getWithBody("plans", "select=name&id=eq." + planId)).getAsJsonArray();

                if (!plans.isEmpty()) {
                    planNames.add(plans.get(0).getAsJsonObject().get("name").getAsString());
                }
            }

            utils.sendJsonResponse(ex, planNames.toString(), 200);
        }));
    }

    public void getPlanner() {
        server.createContext(conf._EXT_SUPA_CWLPLANNER_DATA_GET, exchange -> utils.handlePost(exchange, ex -> {
            JsonObject json = utils.parseBody(ex);
            String name     = utils.requireString(json, "name");

            JsonArray planArray = JsonParser.parseString(
                    SUPABASE_Client.getWithBody("plans", "name=eq." + name)).getAsJsonArray();

            if (planArray.isEmpty()) {
                utils.sendJsonResponse(ex, "{\"error\":\"Plan niet gevonden: " + name + "\"}", 404);
                return;
            }

            JsonObject plan     = planArray.get(0).getAsJsonObject();
            JsonObject planInfo = new JsonObject();
            planInfo.addProperty("name", plan.get("name").getAsString());
            planInfo.add("info",         plan.get("info").getAsJsonArray());
            planInfo.addProperty("id",   plan.get("id").getAsString());

            utils.sendJsonResponse(ex, planInfo.toString(), 200);
        }));
    }
}